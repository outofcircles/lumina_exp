
import { Profile, Story, Language, ArchivedStory, AppMode, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry } from '../types';
import { supabase } from './supabaseClient';

// Fetch all shared stories from Supabase
export const getArchivedStories = async (): Promise<ArchivedStory[]> => {
  try {
    const { data, error } = await supabase
      .from('shared_stories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase error fetching stories:", error);
      return [];
    }
    
    if (!data) return [];

    // Map DB snake_case to our Typescript camelCase types
    return data.map((row: any) => ({
      id: row.id,
      type: row.type as AppMode,
      itemData: row.item_data,
      content: row.content,
      isFavorite: false, // Favorites are local-only overlay
      metadata: {
        ...row.metadata,
        createdAt: new Date(row.created_at).getTime()
      }
    }));

  } catch (e) {
    console.error("Failed to load archive from cloud:", e);
    return [];
  }
};

export const saveItemToArchive = async (
  mode: AppMode,
  itemData: Profile | ScienceItem | PhilosophyItem,
  content: Story | ScienceEntry | PhilosophyEntry,
  categoryId: string,
  metadataExtras: { styleName?: string, personaName?: string, primaryLanguage?: Language } = {}
): Promise<ArchivedStory | null> => {
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn("Cannot save story: User not authenticated");
    return null;
  }

  const newEntryPayload = {
    type: mode,
    item_data: itemData,
    content: content,
    metadata: {
      categoryId,
      styleName: metadataExtras.styleName,
      personaName: metadataExtras.personaName,
      primaryLanguage: metadataExtras.primaryLanguage,
    },
    created_by: user.id
  };

  try {
    const { data, error } = await supabase
      .from('shared_stories')
      .insert(newEntryPayload)
      .select()
      .single();

    if (error) {
      console.error("Supabase error saving story:", error);
      throw error;
    }

    // Return formatted object
    return {
      id: data.id,
      type: data.type as AppMode,
      itemData: data.item_data,
      content: data.content,
      isFavorite: false,
      metadata: {
        ...data.metadata,
        createdAt: new Date(data.created_at).getTime()
      }
    };

  } catch (e) {
    console.error("Failed to save to cloud archive:", e);
    // Do not alert here to avoid interrupting the flow, just log
    return null;
  }
};

export const deleteStoryFromArchive = async (id: string): Promise<void> => {
   // Supabase RLS ensures user can only delete their own
   const { error } = await supabase.from('shared_stories').delete().eq('id', id);
   if (error) console.error("Error deleting:", error);
};

// Local only for favorites now, since it's a personal preference on a shared item
export const toggleStoryFavorite = (id: string) => {
  const favsKey = 'lumina_favorites';
  const favs = JSON.parse(localStorage.getItem(favsKey) || '[]');
  
  if (favs.includes(id)) {
    const newFavs = favs.filter((fid: string) => fid !== id);
    localStorage.setItem(favsKey, JSON.stringify(newFavs));
  } else {
    favs.push(id);
    localStorage.setItem(favsKey, JSON.stringify(favs));
  }
};

export const getLocalFavorites = (): string[] => {
    return JSON.parse(localStorage.getItem('lumina_favorites') || '[]');
};
