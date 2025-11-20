import React, { useState, useEffect } from 'react';
import { CategoryGrid } from './components/CategoryGrid';
import { ItemPicker } from './components/ProfilePicker';
import { StoryView } from './components/StoryView';
import { ScienceView } from './components/ScienceView';
import { PhilosophyView } from './components/PhilosophyView';
import { ArchiveGrid } from './components/ArchiveGrid';
import { LoginView } from './components/LoginView';
import { AppStep, AppMode, Language, Profile, Story, ArchivedStory, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry } from './types';
import { discoverProfiles, generateStory, generateStoryImage, discoverConcepts, generateScienceEntry, discoverPhilosophies, generatePhilosophyEntry, getUserQuota } from './services/gemini';
import { saveItemToArchive, getArchivedStories, deleteStoryFromArchive, toggleStoryFavorite, getLocalFavorites } from './services/storage';
import { CATEGORIES, SCIENCE_CATEGORIES, PHILOSOPHY_CATEGORIES, AUTHOR_STYLES, HINDI_AUTHOR_STYLES, DEFAULT_LANGUAGE } from './constants';
import { Sparkles, BookOpen, Library, Atom, Scale, AlertTriangle, X, Hourglass, ShieldCheck, LogOut, Battery, Globe } from 'lucide-react';
import { RateLimitError } from './services/rateLimit';
import { SafetyError } from './services/safety';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Quota State
  const [quota, setQuota] = useState({ usage: 0, limit: 10 });

  const [mode, setMode] = useState<AppMode>(AppMode.STORIES);
  const [step, setStep] = useState<AppStep>(AppStep.CATEGORY_SELECT);
  const [error, setError] = useState<{message: string, type: 'general' | 'rate_limit' | 'safety'} | null>(null);
  
  // Content States
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Items
  const [items, setItems] = useState<(Profile | ScienceItem | PhilosophyItem)[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Generated Content
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);

  // Archive
  const [archivedStories, setArchivedStories] = useState<ArchivedStory[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

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

  // Refresh Archive & Quota when session active
  useEffect(() => {
    if (session) {
      refreshLibrary();
      refreshQuota();
      setFavorites(getLocalFavorites());
    }
  }, [session, step]);

  const refreshLibrary = async () => {
    const stories = await getArchivedStories();
    // Apply local favorites overlay
    const localFavs = getLocalFavorites();
    const storiesWithFavs = stories.map(s => ({...s, isFavorite: localFavs.includes(s.id)}));
    setArchivedStories(storiesWithFavs);
  };

  const refreshQuota = async () => {
      const q = await getUserQuota();
      setQuota(q);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetToHome();
  };

  const handleError = (e: any, defaultMsg: string) => {
      console.error(e);
      if (e instanceof RateLimitError) {
          setError({ message: e.message, type: 'rate_limit' });
      } else if (e instanceof SafetyError) {
          setError({ message: e.message, type: 'safety' });
      } else {
          const msg = e.message?.includes('Timeout') || 
                      e.message?.includes('too long') || 
                      e.message?.includes('overloaded') || 
                      e.message?.includes('503') 
                      ? e.message : defaultMsg;
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
    // Note: We do NOT reset language here so user preference persists
  };

  const handleTabChange = (newMode: AppMode) => {
    setMode(newMode);
    resetToHome();
  };

  const getActiveCategories = () => {
    switch(mode) {
      case AppMode.CONCEPTS: return SCIENCE_CATEGORIES;
      case AppMode.PHILOSOPHIES: return PHILOSOPHY_CATEGORIES;
      default: return CATEGORIES;
    }
  };

  const getCurrentCategoryObj = () => {
     return getActiveCategories().find(c => c.id === selectedCategory) || CATEGORIES[0];
  };

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
      handleError(e, "Connection issue. Please try again.");
    } finally {
      setLoadingItems(false);
    }
  };

  const handleItemSelect = async (item: any) => {
    setSelectedItem(item);
    setGeneratedContent(null);
    setStep(AppStep.CONTENT_VIEW);
    setLoadingContent(true);
    setLoadingImages(false);
    setError(null);

    try {
      if (mode === AppMode.STORIES) {
        const profile = item as Profile;
        const englishStyle = AUTHOR_STYLES[Math.floor(Math.random() * AUTHOR_STYLES.length)];
        const hindiStyle = HINDI_AUTHOR_STYLES[Math.floor(Math.random() * HINDI_AUTHOR_STYLES.length)];
        
        const story = await generateStory(profile, englishStyle.name, englishStyle.description, hindiStyle.name, hindiStyle.description);
        setGeneratedContent(story);
        setLoadingContent(false);
        refreshQuota();

        if (selectedCategory) {
             await saveItemToArchive(AppMode.STORIES, profile, story, selectedCategory, { styleName: englishStyle.name, personaName: englishStyle.persona, primaryLanguage: language });
             refreshLibrary();
        }
        
        setLoadingImages(true);
        Promise.all([
          generateStoryImage(story.illustrationPrompt, false),
          generateStoryImage(story.geography.mapPrompt, true)
        ]).then(([imageUrl, mapUrl]) => {
            setGeneratedContent((prev: any) => ({ ...prev, generatedImageUrl: imageUrl, generatedMapUrl: mapUrl }));
            setLoadingImages(false);
        });

      } else if (mode === AppMode.CONCEPTS) {
        const scienceItem = item as ScienceItem;
        const entry = await generateScienceEntry(scienceItem);
        setGeneratedContent(entry);
        setLoadingContent(false);
        refreshQuota();

        if (selectedCategory) {
            await saveItemToArchive(AppMode.CONCEPTS, scienceItem, entry, selectedCategory);
            refreshLibrary();
        }

        setLoadingImages(true);
        generateStoryImage(entry.illustrationPrompt, false).then((img) => {
            setGeneratedContent((prev: any) => ({ ...prev, generatedImageUrl: img }));
            setLoadingImages(false);
        });

      } else if (mode === AppMode.PHILOSOPHIES) {
        const philoItem = item as PhilosophyItem;
        const entry = await generatePhilosophyEntry(philoItem);
        setGeneratedContent(entry);
        setLoadingContent(false);
        refreshQuota();

        if (selectedCategory) {
            await saveItemToArchive(AppMode.PHILOSOPHIES, philoItem, entry, selectedCategory);
            refreshLibrary();
        }

        setLoadingImages(true);
        generateStoryImage(entry.illustrationPrompt, false).then((img) => {
            setGeneratedContent((prev: any) => ({ ...prev, generatedImageUrl: img }));
            setLoadingImages(false);
        });
      }
    } catch (e) {
      handleError(e, "Could not generate content. Please try again.");
      setStep(AppStep.ITEM_SELECT);
      setLoadingContent(false);
    }
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
      // Restore the language used when saving, if available
      if (archivedItem.type === AppMode.STORIES && archivedItem.metadata.primaryLanguage) {
          setLanguage(archivedItem.metadata.primaryLanguage as Language);
      }
  };

  if (checkingAuth) return <div className="h-screen flex items-center justify-center bg-parchment"><Sparkles className="animate-spin text-gold" size={48}/></div>;
  if (!session) return <LoginView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-parchment font-sans selection:bg-gold selection:text-white pb-20 flex flex-col antialiased">
      
      {/* Header */}
      <header className="bg-white border-b border-parchment-dark sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/95 supports-[backdrop-filter]:bg-white/80">
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
               {/* Language Switcher - Restored */}
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

               {/* Quota Indicator */}
               <div className="hidden md:flex items-center gap-2 text-xs font-bold px-4 py-2 bg-blue-50 text-blue-700 rounded-full border border-blue-100 shadow-sm" title="Daily Generation Limit">
                  <Battery size={16} className={quota.usage >= quota.limit ? 'text-red-500' : 'text-blue-500'} />
                  <span>{quota.limit - quota.usage} left</span>
               </div>

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
                  {mode === AppMode.STORIES && "Discover a world of heroes."}
                  {mode === AppMode.CONCEPTS && "Explore the wonders of science."}
                  {mode === AppMode.PHILOSOPHIES && "Understand the great ideas."}
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
            {mode === AppMode.STORIES && <StoryView story={generatedContent} profile={selectedItem} onBack={handleBackFromView} displayLanguage={language} loadingImages={loadingImages} category={getCurrentCategoryObj()} />}
            {mode === AppMode.CONCEPTS && <ScienceView entry={generatedContent} item={selectedItem} onBack={handleBackFromView} loadingImages={loadingImages} category={getCurrentCategoryObj()} />}
            {mode === AppMode.PHILOSOPHIES && <PhilosophyView entry={generatedContent} item={selectedItem} onBack={handleBackFromView} loadingImages={loadingImages} category={getCurrentCategoryObj()} />}
          </>
        )}

        {step === AppStep.CONTENT_VIEW && loadingContent && (
           <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
              <BookOpen size={80} className="text-gold mb-8 animate-bounce opacity-80" strokeWidth={1.5} />
              <h3 className="text-3xl font-serif text-ink mb-3 font-medium">Generating content...</h3>
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
                    onToggleFavorite={(id) => { toggleStoryFavorite(id); refreshLibrary(); }}
                    displayLanguage={language}
                />
            </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 py-8 mt-12">
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
