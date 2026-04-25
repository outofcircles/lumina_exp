import React, { useState, useEffect, useCallback } from 'react';
import { CategoryGrid } from './components/CategoryGrid';
import { ItemPicker } from './components/ProfilePicker';
import { StoryView } from './components/StoryView';
import { ScienceView } from './components/ScienceView';
import { PhilosophyView } from './components/PhilosophyView';
import { ArchiveGrid } from './components/ArchiveGrid';
import { LoginView } from './components/LoginView';
import type { Session } from '@supabase/supabase-js';
import { AppStep, AppMode, Language, Profile, Story, ArchivedStory, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry, StoryLength, ReadingLevel, NarratorStyle } from './types';
import { discoverProfiles, generateStory, generateStoryImage, discoverConcepts, generateScienceEntry, discoverPhilosophies, generatePhilosophyEntry, getUserQuota, researchStory, researchScience, researchPhilosophy, RateLimitError, SafetyError } from './services/gemini';
import { saveItemToArchive, getArchivedStories, deleteStoryFromArchive, toggleStoryFavorite } from './services/storage';
import { CATEGORIES, SCIENCE_CATEGORIES, PHILOSOPHY_CATEGORIES, AUTHOR_STYLES, HINDI_AUTHOR_STYLES, SCIENCE_NARRATOR_STYLES, PHILOSOPHY_NARRATOR_STYLES, DEFAULT_LANGUAGE } from './constants';
import { Sparkles, BookOpen, Library, Atom, Scale, AlertTriangle, X, ShieldCheck, LogOut, Battery, Globe } from 'lucide-react';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [quota, setQuota] = useState<{ usage: number; limit: number }>({ usage: 0, limit: 1000 });
  const [mode, setMode] = useState<AppMode>(AppMode.STORIES);
  const [step, setStep] = useState<AppStep>(AppStep.CATEGORY_SELECT);
  const [error, setError] = useState<{ message: string; type: 'general' | 'rate_limit' | 'safety' } | null>(null);

  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [storyLength, setStoryLength] = useState<StoryLength>('medium');

  const [items, setItems] = useState<(Profile | ScienceItem | PhilosophyItem)[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Profile | ScienceItem | PhilosophyItem | null>(null);

  const [generatedContent, setGeneratedContent] = useState<Story | ScienceEntry | PhilosophyEntry | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);

  const [currentEnglishStyleId, setCurrentEnglishStyleId] = useState<string>('');
  const [currentHindiStyleId, setCurrentHindiStyleId] = useState<string>('');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>(() => {
    return (localStorage.getItem('lumina_reading_level') as ReadingLevel) || 'middle';
  });
  const [currentNarratorStyleId, setCurrentNarratorStyleId] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<string>('Generating content...');

  const [archivedStories, setArchivedStories] = useState<ArchivedStory[]>([]);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshLibrary = useCallback(async () => {
    const stories = await getArchivedStories();
    setArchivedStories(stories);
  }, []);

  const refreshQuota = useCallback(async () => {
    try {
      const q = await getUserQuota();
      if (q && typeof q.usage === 'number') setQuota(q);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (session) refreshQuota();
  }, [session, refreshQuota]);

  useEffect(() => {
    if (session && step === AppStep.ARCHIVE_LIST) refreshLibrary();
  }, [session, step, refreshLibrary]);

  // Dynamic page title
  useEffect(() => {
    const titles: Record<AppMode, string> = {
      [AppMode.STORIES]: 'Lumina — Stories of Values',
      [AppMode.CONCEPTS]: 'Lumina — Science & Discovery',
      [AppMode.PHILOSOPHIES]: 'Lumina — Wisdom & Philosophy',
    };
    document.title = titles[mode];
  }, [mode]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetToHome();
  };

  const handleError = (e: unknown, defaultMsg: string) => {
    console.error(e);
    if (e instanceof RateLimitError) {
      setError({ message: (e as Error).message, type: 'rate_limit' });
    } else if (e instanceof SafetyError) {
      setError({ message: (e as Error).message, type: 'safety' });
    } else {
      const msg = e instanceof Error && (
        e.message?.includes('Timeout') || e.message?.includes('too long') ||
        e.message?.includes('overloaded') || e.message?.includes('503')
      ) ? e.message : defaultMsg;
      setError({ message: msg, type: 'general' });
    }
  };

  const resetToHome = () => {
    setStep(AppStep.CATEGORY_SELECT);
    setSelectedCategory(null);
    setItems([]);
    setSelectedItem(null);
    setGeneratedContent(null);
    setError(null);
    setLoadingImages(false);
    setCurrentEnglishStyleId('');
    setCurrentHindiStyleId('');
  };

  useEffect(() => {
    localStorage.setItem('lumina_reading_level', readingLevel);
  }, [readingLevel]);

  const handleTabChange = (newMode: AppMode) => {
    setMode(newMode);
    resetToHome();
  };

  const getActiveCategories = () => {
    switch (mode) {
      case AppMode.CONCEPTS: return SCIENCE_CATEGORIES;
      case AppMode.PHILOSOPHIES: return PHILOSOPHY_CATEGORIES;
      default: return CATEGORIES;
    }
  };

  const getCurrentCategoryObj = () =>
    getActiveCategories().find(c => c.id === selectedCategory) || CATEGORIES[0];

  const handleCategorySelect = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setStep(AppStep.ITEM_SELECT);
    setLoadingItems(true);
    setItems([]);
    setError(null);
    try {
      let results;
      if (mode === AppMode.STORIES) results = await discoverProfiles(categoryId, language);
      else if (mode === AppMode.CONCEPTS) results = await discoverConcepts(categoryId);
      else results = await discoverPhilosophies(categoryId);
      setItems(results);
    } catch (e) {
      handleError(e, 'Connection issue. Please try again.');
    } finally {
      setLoadingItems(false);
    }
  };

  const generateForItem = useCallback(async (
    item: Profile | ScienceItem | PhilosophyItem,
    englishStyleId: string,
    hindiStyleId: string,
    length: StoryLength,
    currentMode: AppMode,
    catId: string | null,
    narratorStyleId?: string,
    isRegenerate?: boolean,
  ) => {
    setGeneratedContent(null);
    setLoadingContent(true);
    setLoadingImages(false);
    setError(null);
    let textGenSucceeded = false;

    try {
      if (currentMode === AppMode.STORIES) {
        const profile = item as Profile;
        const englishStyle = AUTHOR_STYLES.find(s => s.id === englishStyleId) || AUTHOR_STYLES[0];
        const hindiStyle = HINDI_AUTHOR_STYLES.find(s => s.id === hindiStyleId) || HINDI_AUTHOR_STYLES[0];

        setLoadingMessage(`Researching ${profile.name}...`);
        let research;
        try { research = await researchStory(profile); } catch { research = undefined; }

        setLoadingMessage(`Writing story in the style of ${englishStyle.name}...`);
        const story = await generateStory(
          profile, englishStyle.name, englishStyle.description,
          hindiStyle.name, hindiStyle.description,
          length, readingLevel, research, isRegenerate,
        );
        setGeneratedContent(story);
        textGenSucceeded = true;
        setLoadingContent(false);
        setCurrentEnglishStyleId(englishStyle.id);
        setCurrentHindiStyleId(hindiStyle.id);
        refreshQuota();

        if (catId) {
          await saveItemToArchive(AppMode.STORIES, profile, story, catId, {
            styleName: englishStyle.name, personaName: englishStyle.persona,
            primaryLanguage: language, readingLevel,
          });
          refreshLibrary();
        }

        setLoadingImages(true);
        const imageUrl = await generateStoryImage(story.illustrationPrompt, false);
        setGeneratedContent(prev => prev ? { ...prev, generatedImageUrl: imageUrl } : prev);
        if (story.geography) {
          const mapUrl = await generateStoryImage(story.geography.mapPrompt, true);
          setGeneratedContent(prev => prev ? { ...prev, generatedMapUrl: mapUrl } : prev);
        }
        setLoadingImages(false);

      } else if (currentMode === AppMode.CONCEPTS) {
        const scienceItem = item as ScienceItem;
        const narratorStyle = SCIENCE_NARRATOR_STYLES.find(s => s.id === narratorStyleId) || SCIENCE_NARRATOR_STYLES[0];
        setCurrentNarratorStyleId(narratorStyle.id);

        setLoadingMessage(`Researching ${scienceItem.name}...`);
        let research;
        try { research = await researchScience(scienceItem); } catch { research = undefined; }

        setLoadingMessage(`Writing science entry...`);
        const entry = await generateScienceEntry(scienceItem, length, readingLevel, narratorStyle, research, isRegenerate);
        setGeneratedContent(entry);
        textGenSucceeded = true;
        setLoadingContent(false);
        refreshQuota();
        if (catId) { await saveItemToArchive(AppMode.CONCEPTS, scienceItem, entry, catId, { readingLevel }); refreshLibrary(); }

        setLoadingImages(true);
        const img = await generateStoryImage(entry.illustrationPrompt, false);
        setGeneratedContent(prev => prev ? { ...prev, generatedImageUrl: img } : prev);
        setLoadingImages(false);

      } else if (currentMode === AppMode.PHILOSOPHIES) {
        const philoItem = item as PhilosophyItem;
        const narratorStyle = PHILOSOPHY_NARRATOR_STYLES.find(s => s.id === narratorStyleId) || PHILOSOPHY_NARRATOR_STYLES[0];
        setCurrentNarratorStyleId(narratorStyle.id);

        setLoadingMessage(`Researching ${philoItem.name}...`);
        let research;
        try { research = await researchPhilosophy(philoItem); } catch { research = undefined; }

        setLoadingMessage(`Writing philosophy entry...`);
        const entry = await generatePhilosophyEntry(philoItem, length, readingLevel, narratorStyle, research, isRegenerate);
        setGeneratedContent(entry);
        textGenSucceeded = true;
        setLoadingContent(false);
        refreshQuota();
        if (catId) { await saveItemToArchive(AppMode.PHILOSOPHIES, philoItem, entry, catId, { readingLevel }); refreshLibrary(); }

        setLoadingImages(true);
        const img = await generateStoryImage(entry.illustrationPrompt, false);
        setGeneratedContent(prev => prev ? { ...prev, generatedImageUrl: img } : prev);
        setLoadingImages(false);
      }
    } catch (e) {
      handleError(e, 'Could not generate content. Please try again.');
      if (!textGenSucceeded) setStep(AppStep.ITEM_SELECT);
      setLoadingContent(false);
      setLoadingImages(false);
    }
  }, [language, readingLevel, refreshQuota, refreshLibrary]);

  const handleItemSelect = async (item: Profile | ScienceItem | PhilosophyItem) => {
    setSelectedItem(item);
    setStep(AppStep.CONTENT_VIEW);
    const englishStyle = AUTHOR_STYLES[Math.floor(Math.random() * AUTHOR_STYLES.length)];
    const hindiStyle = HINDI_AUTHOR_STYLES[Math.floor(Math.random() * HINDI_AUTHOR_STYLES.length)];
    const scienceNarrator = SCIENCE_NARRATOR_STYLES[Math.floor(Math.random() * SCIENCE_NARRATOR_STYLES.length)];
    const philoNarrator = PHILOSOPHY_NARRATOR_STYLES[Math.floor(Math.random() * PHILOSOPHY_NARRATOR_STYLES.length)];
    const narratorId = mode === AppMode.CONCEPTS ? scienceNarrator.id : philoNarrator.id;
    await generateForItem(item, englishStyle.id, hindiStyle.id, storyLength, mode, selectedCategory, narratorId, false);
  };

  const handleRegenerate = async (newEnglishStyleId?: string, newHindiStyleId?: string, newLength?: StoryLength, newNarratorStyleId?: string, newReadingLevel?: ReadingLevel) => {
    if (!selectedItem) return;
    const effectiveLength = newLength ?? storyLength;
    if (newLength) setStoryLength(newLength);
    if (newReadingLevel) setReadingLevel(newReadingLevel);
    await generateForItem(
      selectedItem,
      newEnglishStyleId || currentEnglishStyleId,
      newHindiStyleId || currentHindiStyleId,
      effectiveLength,
      mode,
      selectedCategory,
      newNarratorStyleId || currentNarratorStyleId,
      true,
    );
  };

  const handleBackFromView = () => {
    if (items.length > 0) setStep(AppStep.ITEM_SELECT);
    else setStep(AppStep.CATEGORY_SELECT);
  };

  const handleRestoreFromArchive = (archivedItem: ArchivedStory) => {
    setMode(archivedItem.type);
    setSelectedItem(archivedItem.itemData);
    setGeneratedContent(archivedItem.content);
    setSelectedCategory(archivedItem.metadata.categoryId);
    setStep(AppStep.CONTENT_VIEW);
    setError(null);
    setLoadingImages(false);
    if (archivedItem.type === AppMode.STORIES && archivedItem.metadata.primaryLanguage) {
      setLanguage(archivedItem.metadata.primaryLanguage as Language);
    }
  };

  if (checkingAuth) return <div className="h-screen flex items-center justify-center bg-parchment"><Sparkles className="animate-spin text-gold" size={48}/></div>;
  if (!session) return <LoginView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-parchment font-sans selection:bg-gold selection:text-white pb-20 flex flex-col antialiased">

      <header className="bg-white border-b border-parchment-dark sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/95 supports-[backdrop-filter]:bg-white/80 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4 py-4">
          <div onClick={resetToHome} className="flex items-center gap-3 cursor-pointer group shrink-0">
            <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center text-white shadow-md transform group-hover:rotate-12 transition-transform duration-300">
              <Sparkles size={20} fill="currentColor" />
            </div>
            <h1 className="font-serif font-bold text-2xl text-ink tracking-tight hidden sm:block">Lumina</h1>
          </div>

          <div className="flex bg-gray-100/80 p-1.5 rounded-2xl overflow-hidden shrink-0 max-w-[50vw] overflow-x-auto hide-scrollbar">
            <button onClick={() => handleTabChange(AppMode.STORIES)} className={`px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${mode === AppMode.STORIES ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Sparkles size={16} /> <span className="hidden sm:inline">Stories</span>
            </button>
            <button onClick={() => handleTabChange(AppMode.CONCEPTS)} className={`px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${mode === AppMode.CONCEPTS ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Atom size={16} /> <span className="hidden sm:inline">Science</span>
            </button>
            <button onClick={() => handleTabChange(AppMode.PHILOSOPHIES)} className={`px-4 py-2 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${mode === AppMode.PHILOSOPHIES ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Scale size={16} /> <span className="hidden sm:inline">Wisdom</span>
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {mode === AppMode.STORIES && (
              <button
                onClick={() => setLanguage(language === Language.ENGLISH ? Language.HINDI : Language.ENGLISH)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-ink"
                title="Switch Language"
              >
                <Globe size={18} />
                <span className="hidden md:inline">{language === Language.ENGLISH ? 'EN' : 'HI'}</span>
              </button>
            )}
            {quota && (
              <div className="hidden md:flex items-center gap-2 text-xs font-bold px-4 py-2 bg-blue-50 text-blue-700 rounded-full border border-blue-100 shadow-sm" title="Daily Generation Limit">
                <Battery size={16} className={(quota.usage || 0) >= (quota.limit || 10) ? 'text-red-500' : 'text-blue-500'} />
                <span>{(quota.limit || 10) - (quota.usage || 0)} left</span>
              </div>
            )}
            <button
              onClick={() => { setStep(AppStep.ARCHIVE_LIST); setError(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border border-transparent ${step === AppStep.ARCHIVE_LIST ? 'bg-ink text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:border-gray-200'}`}
            >
              <Library size={18} />
              <span className="hidden lg:inline">Library</span>
            </button>
            <button onClick={handleLogout} className="p-2.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        {error && (
          <div className={`max-w-4xl mx-auto mb-10 p-5 border rounded-2xl flex items-start gap-4 animate-fadeIn shadow-sm ${error.type === 'rate_limit' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
            <AlertTriangle className="shrink-0 mt-0.5" size={22} />
            <div className="flex-1">
              <h3 className="font-bold text-base">{error.type === 'rate_limit' ? 'Quota Reached' : 'Something went wrong'}</h3>
              <p className="text-sm opacity-90 mt-1 leading-relaxed">{error.message}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-black/5 rounded"><X size={18} /></button>
          </div>
        )}

        {step === AppStep.CATEGORY_SELECT && (
          <div className="animate-fadeIn w-full">
            <div className="text-center max-w-3xl mx-auto mb-20 pt-8">
              <h2 className="text-5xl sm:text-6xl md:text-7xl font-serif font-medium text-ink mb-8 tracking-tight leading-[1.1]">
                {mode === AppMode.STORIES && 'Discover a world of heroes.'}
                {mode === AppMode.CONCEPTS && 'Explore the wonders of science.'}
                {mode === AppMode.PHILOSOPHIES && 'Understand the great ideas.'}
              </h2>
              <p className="text-xl sm:text-2xl text-gray-500 leading-relaxed max-w-2xl mx-auto font-light">
                Select a path below to begin a journey of discovery, tailored for young minds.
              </p>
            </div>
            <CategoryGrid categories={getActiveCategories()} onSelect={handleCategorySelect} />
          </div>
        )}

        {step === AppStep.ITEM_SELECT && (
          <div className="animate-fadeIn">
            <div className="flex items-center mb-10 text-sm sm:text-base">
              <button onClick={resetToHome} className="text-gray-400 hover:text-ink transition-colors font-bold uppercase tracking-wider">Categories</button>
              <span className="mx-3 text-gray-300">/</span>
              <span className="font-bold uppercase tracking-wider text-gold">{getCurrentCategoryObj().label}</span>
            </div>
            <ItemPicker items={items} onSelect={handleItemSelect} loading={loadingItems} mode={mode} />
          </div>
        )}

        {step === AppStep.CONTENT_VIEW && generatedContent && selectedItem && (
          <>
            {mode === AppMode.STORIES && (
              <StoryView
                story={generatedContent as Story}
                profile={selectedItem as Profile}
                onBack={handleBackFromView}
                displayLanguage={language}
                loadingImages={loadingImages}
                category={getCurrentCategoryObj()}
                storyLength={storyLength}
                currentEnglishStyleId={currentEnglishStyleId}
                currentHindiStyleId={currentHindiStyleId}
                onRegenerate={handleRegenerate}
                readingLevel={readingLevel}
                onReadingLevelChange={(level: ReadingLevel) => handleRegenerate(undefined, undefined, undefined, undefined, level)}
              />
            )}
            {mode === AppMode.CONCEPTS && (
              <ScienceView
                entry={generatedContent as ScienceEntry}
                item={selectedItem as ScienceItem}
                onBack={handleBackFromView}
                loadingImages={loadingImages}
                category={getCurrentCategoryObj()}
                storyLength={storyLength}
                onRegenerate={handleRegenerate}
                readingLevel={readingLevel}
                onReadingLevelChange={(level: ReadingLevel) => handleRegenerate(undefined, undefined, undefined, undefined, level)}
                currentNarratorStyleId={currentNarratorStyleId}
              />
            )}
            {mode === AppMode.PHILOSOPHIES && (
              <PhilosophyView
                entry={generatedContent as PhilosophyEntry}
                item={selectedItem as PhilosophyItem}
                onBack={handleBackFromView}
                loadingImages={loadingImages}
                category={getCurrentCategoryObj()}
                storyLength={storyLength}
                onRegenerate={handleRegenerate}
                readingLevel={readingLevel}
                onReadingLevelChange={(level: ReadingLevel) => handleRegenerate(undefined, undefined, undefined, undefined, level)}
                currentNarratorStyleId={currentNarratorStyleId}
              />
            )}
          </>
        )}

        {step === AppStep.CONTENT_VIEW && loadingContent && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
            <BookOpen size={80} className="text-gold mb-8 animate-bounce opacity-80" strokeWidth={1.5} />
            <h3 className="text-3xl font-serif text-ink mb-3 font-medium">{loadingMessage}</h3>
            <p className="text-gray-400 text-base font-medium">This counts towards your daily quota.</p>
          </div>
        )}

        {step === AppStep.ARCHIVE_LIST && (
          <div className="animate-fadeIn pt-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-4 tracking-tight">Shared Library</h2>
              <p className="text-xl text-gray-500 leading-relaxed">Stories collected by your circle of friends.</p>
            </div>
            <ArchiveGrid
              stories={archivedStories}
              onSelect={handleRestoreFromArchive}
              onDelete={(id) => { deleteStoryFromArchive(id); refreshLibrary(); }}
              onToggleFavorite={(id, isFav) => toggleStoryFavorite(id, isFav).then(() => refreshLibrary())}
              displayLanguage={language}
            />
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 py-8 mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-gray-400 text-sm font-medium">
          <div className="flex items-center gap-8">
            <span>&copy; 2025 Lumina</span>
            <span className="flex items-center gap-1.5 text-gray-300"><ShieldCheck size={14} /> Private Instance</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
