
import { Profile, Story, Language, ArchivedStory, AppMode, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry } from '../types';
import { supabase } from './supabaseClient';

export const getArchivedStories = async (): Promise<ArchivedStory[]> => {
  try {
    const [{ data: stories, error }, { data: { user } }] = await Promise.all([
      supabase.from('shared_stories').select('*').order('created_at', { ascending: false }),
      supabase.auth.getUser(),
    ]);

    if (error || !stories) return [];

    // Fetch this user's favorites
    const favoriteIds = new Set<string>();
    if (user) {
      const { data: favs } = await supabase
        .from('user_favorites')
        .select('story_id')
        .eq('user_id', user.id);
      favs?.forEach(f => favoriteIds.add(f.story_id));
    }

    return stories.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: row.type as AppMode,
      itemData: row.item_data as Profile | ScienceItem | PhilosophyItem,
      content: row.content as Story | ScienceEntry | PhilosophyEntry,
      isFavorite: favoriteIds.has(row.id as string),
      metadata: {
        ...(row.metadata as ArchivedStory['metadata']),
        createdAt: new Date(row.created_at as string).getTime(),
      },
    }));
  } catch (e) {
    console.error('Failed to load archive from cloud:', e);
    return [];
  }
};

export const saveItemToArchive = async (
  mode: AppMode,
  itemData: Profile | ScienceItem | PhilosophyItem,
  content: Story | ScienceEntry | PhilosophyEntry,
  categoryId: string,
  metadataExtras: { styleName?: string; personaName?: string; primaryLanguage?: Language; readingLevel?: import('../types').ReadingLevel } = {}
): Promise<ArchivedStory | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { console.warn('Cannot save: user not authenticated'); return null; }

  const payload = {
    type: mode,
    item_data: itemData,
    content,
    metadata: { categoryId, ...metadataExtras },
    created_by: user.id,
  };

  try {
    const { data, error } = await supabase.from('shared_stories').insert(payload).select().single();
    if (error) throw error;
    return {
      id: data.id,
      type: data.type as AppMode,
      itemData: data.item_data,
      content: data.content,
      isFavorite: false,
      metadata: { ...data.metadata, createdAt: new Date(data.created_at).getTime() },
    };
  } catch (e) {
    console.error('Failed to save to cloud archive:', e);
    return null;
  }
};

export const deleteStoryFromArchive = async (id: string): Promise<void> => {
  const { error } = await supabase.from('shared_stories').delete().eq('id', id);
  if (error) console.error('Error deleting:', error);
};

// Favorites — stored in user_favorites table (per-user, not per-story)
export const toggleStoryFavorite = async (id: string, currentlyFavorited: boolean): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (currentlyFavorited) {
    await supabase.from('user_favorites').delete().eq('user_id', user.id).eq('story_id', id);
  } else {
    await supabase.from('user_favorites').insert({ user_id: user.id, story_id: id });
  }
};
