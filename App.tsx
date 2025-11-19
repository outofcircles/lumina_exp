
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
import { Sparkles, BookOpen, Library, Atom, Scale, AlertTriangle, X, Hourglass, ShieldCheck, LogOut, Battery } from 'lucide-react';
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
          setError({ message: defaultMsg, type: 'general' });
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
    if (mode === AppMode.STORIES) setLanguage(Language.ENGLISH); 
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
        refreshQuota(); // Update quota usage display

        // Save to Shared Library immediately
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
      handleError(e, "Could not generate content. You may have reached your quota.");
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
      if (archivedItem.type === AppMode.STORIES) setLanguage(Language.ENGLISH);
  };

  if (checkingAuth) return <div className="h-screen flex items-center justify-center bg-parchment"><Sparkles className="animate-spin text-gold" size={48}/></div>;
  if (!session) return <LoginView onLoginSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-parchment font-sans selection:bg-gold selection:text-white pb-20 flex flex-col">
      
      {/* Header */}
      <header className="bg-white border-b border-parchment-dark sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            
            <div onClick={resetToHome} className="flex items-center gap-2 cursor-pointer group shrink-0">
              <div className="w-8 h-8 bg-gold rounded-lg flex items-center justify-center text-white transform group-hover:rotate-12 transition-transform">
                <Sparkles size={18} fill="currentColor" />
              </div>
              <h1 className="font-serif font-bold text-xl text-ink tracking-tight hidden sm:block">Lumina</h1>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl overflow-hidden shrink-0 max-w-[40vw] overflow-x-auto hide-scrollbar">
              <button onClick={() => handleTabChange(AppMode.STORIES)} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 ${mode === AppMode.STORIES ? 'bg-white text-ink shadow-sm' : 'text-gray-500'}`}>
                <Sparkles size={14} /> <span className="hidden sm:inline">Stories</span>
              </button>
              <button onClick={() => handleTabChange(AppMode.CONCEPTS)} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 ${mode === AppMode.CONCEPTS ? 'bg-white text-ink shadow-sm' : 'text-gray-500'}`}>
                <Atom size={14} /> <span className="hidden sm:inline">Science</span>
              </button>
              <button onClick={() => handleTabChange(AppMode.PHILOSOPHIES)} className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-2 ${mode === AppMode.PHILOSOPHIES ? 'bg-white text-ink shadow-sm' : 'text-gray-500'}`}>
                <Scale size={14} /> <span className="hidden sm:inline">Wisdom</span>
              </button>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
               {/* Quota Indicator */}
               <div className="hidden md:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100" title="Daily Generation Limit">
                  <Battery size={14} className={quota.usage >= quota.limit ? 'text-red-500' : 'text-blue-500'} />
                  <span>{quota.limit - quota.usage} left</span>
               </div>

               <button 
                 onClick={() => { setStep(AppStep.ARCHIVE_LIST); setError(null); }}
                 className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold transition-colors ${step === AppStep.ARCHIVE_LIST ? 'bg-ink text-white' : 'text-gray-600 hover:bg-gray-100'}`}
               >
                  <Library size={18} />
                  <span className="hidden sm:inline">Library</span>
               </button>
               
               <button onClick={handleLogout} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Logout">
                 <LogOut size={18} />
               </button>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        {error && (
            <div className={`max-w-4xl mx-auto mb-8 p-4 border rounded-xl flex items-start gap-3 animate-fadeIn shadow-sm ${error.type === 'rate_limit' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                    <h3 className="font-bold text-sm">{error.type === 'rate_limit' ? 'Quota Reached' : 'Error'}</h3>
                    <p className="text-sm opacity-90 mt-0.5">{error.message}</p>
                </div>
                <button onClick={() => setError(null)}><X size={16} /></button>
            </div>
        )}

        {step === AppStep.CATEGORY_SELECT && (
          <div className="animate-fadeIn">
             <div className="text-center max-w-2xl mx-auto mb-12">
                <h2 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-4">
                  {mode === AppMode.STORIES && "Discover a world of heroes."}
                  {mode === AppMode.CONCEPTS && "Explore the wonders of science."}
                  {mode === AppMode.PHILOSOPHIES && "Understand the great ideas."}
                </h2>
                <CategoryGrid categories={getActiveCategories()} onSelect={handleCategorySelect} />
             </div>
          </div>
        )}

        {step === AppStep.ITEM_SELECT && (
          <div className="animate-fadeIn">
            <div className="flex items-center mb-8">
               <button onClick={resetToHome} className="text-gray-400 hover:text-ink transition-colors text-sm font-bold uppercase">Categories</button>
               <span className="mx-2 text-gray-300">/</span>
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
              <BookOpen size={64} className="text-gold mb-6 animate-bounce" />
              <h3 className="text-2xl font-serif text-ink mb-2">Generating content...</h3>
              <p className="text-gray-400 text-sm">This counts towards your daily quota.</p>
           </div>
        )}

        {step === AppStep.ARCHIVE_LIST && (
            <div className="animate-fadeIn">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-ink mb-2">Shared Library</h2>
                    <p className="text-gray-600">Stories collected by your circle of friends.</p>
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

      <footer className="bg-white border-t border-gray-100 py-6 mt-8">
         <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-400 text-xs">
            <div className="flex items-center gap-6">
               <span>&copy; 2025 Lumina</span>
               <span className="flex items-center gap-1"><ShieldCheck size={12} /> Private Instance</span>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default App;
