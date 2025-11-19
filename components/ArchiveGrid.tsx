
import React, { useState, useMemo } from 'react';
import { ArchivedStory, Language, Story, AppMode } from '../types';
import { CATEGORIES, SCIENCE_CATEGORIES, PHILOSOPHY_CATEGORIES } from '../constants';
import { Trash2, Calendar, MapPin, Feather, BookOpen, Search, Filter, Heart, ChevronDown, X, Atom, Scale } from 'lucide-react';

interface ArchiveGridProps {
  stories: ArchivedStory[];
  onSelect: (story: ArchivedStory) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  displayLanguage: Language;
}

export const ArchiveGrid: React.FC<ArchiveGridProps> = ({ stories, onSelect, onDelete, onToggleFavorite, displayLanguage }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az'>('newest');
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  
  const getTitle = (s: ArchivedStory) => {
    if (s.type === AppMode.STORIES) {
        return displayLanguage === Language.HINDI ? (s.content as Story).hindi.title : (s.content as Story).english.title;
    }
    return (s.content as any).title || 'Untitled';
  };

  const getItemDescription = (s: ArchivedStory) => {
     if (s.type === AppMode.STORIES) return (s.itemData as any).title;
     if (s.type === AppMode.CONCEPTS) return (s.itemData as any).field;
     if (s.type === AppMode.PHILOSOPHIES) return (s.itemData as any).origin;
     return '';
  };

  const getAllCategories = () => [...CATEGORIES, ...SCIENCE_CATEGORIES, ...PHILOSOPHY_CATEGORIES];
  const getCategoryLabel = (id: string) => getAllCategories().find(c => c.id === id)?.label || id;

  const filteredStories = useMemo(() => {
    return stories.filter(item => {
      const title = getTitle(item).toLowerCase();
      const itemData = item.itemData as any;
      
      // Search matches title or item name
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        title.includes(query) || 
        itemData.name.toLowerCase().includes(query);

      // Favorites
      const matchesFav = showFavoritesOnly ? item.isFavorite : true;

      // Filters
      const matchesCategory = filterCategory === 'all' || item.metadata.categoryId === filterCategory;
      const matchesType = filterType === 'all' || item.type === filterType;

      return matchesSearch && matchesFav && matchesCategory && matchesType;
    }).sort((a, b) => {
      if (sortBy === 'newest') return b.metadata.createdAt - a.metadata.createdAt;
      if (sortBy === 'oldest') return a.metadata.createdAt - b.metadata.createdAt;
      if (sortBy === 'az') return getTitle(a).localeCompare(getTitle(b));
      return 0;
    });
  }, [stories, searchQuery, showFavoritesOnly, sortBy, filterCategory, filterType, displayLanguage]);

  const clearFilters = () => {
    setFilterCategory('all');
    setFilterType('all');
    setSearchQuery('');
    setShowFavoritesOnly(false);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      
      {/* Toolbar */}
      <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 mb-10 flex flex-col gap-6">
         
         {/* Row 1: Search & Type Toggles */}
         <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            {/* Search */}
            <div className="relative w-full lg:w-96 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gold transition-colors" size={20} />
                <input 
                   type="text" 
                   placeholder="Search titles or names..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:bg-white focus:border-gold/20 rounded-2xl focus:outline-none transition-all text-gray-700 placeholder-gray-400 font-semibold"
                />
            </div>

            {/* Type Toggles */}
            <div className="flex bg-gray-100 p-1.5 rounded-xl w-full lg:w-auto">
                 {[
                   { id: 'all', label: 'All' },
                   { id: AppMode.STORIES, label: 'Stories' },
                   { id: AppMode.CONCEPTS, label: 'Science' },
                   { id: AppMode.PHILOSOPHIES, label: 'Wisdom' }
                 ].map((type) => (
                   <button
                     key={type.id}
                     onClick={() => setFilterType(type.id)}
                     className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === type.id ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                   >
                     {type.label}
                   </button>
                 ))}
            </div>
         </div>

         {/* Row 2: Secondary Filters */}
         <div className="flex flex-wrap justify-between items-center gap-4 pt-4 border-t border-gray-50">
             
             <div className="flex flex-wrap items-center gap-3">
                {/* Category Filter */}
                <div className="relative">
                   <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                   <select 
                     value={filterCategory} 
                     onChange={(e) => setFilterCategory(e.target.value)}
                     className="pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-gold/20 hover:border-gray-300 appearance-none cursor-pointer min-w-[180px]"
                   >
                       <option value="all">All Categories</option>
                       <optgroup label="Stories">
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                       </optgroup>
                       <optgroup label="Science">
                          {SCIENCE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                       </optgroup>
                       <optgroup label="Philosophy">
                          {PHILOSOPHY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                       </optgroup>
                   </select>
                   <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                </div>

                {/* Sort Filter */}
                <div className="relative">
                   <select 
                     value={sortBy} 
                     onChange={(e) => setSortBy(e.target.value as any)}
                     className="pl-4 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-gold/20 hover:border-gray-300 appearance-none cursor-pointer"
                   >
                       <option value="newest">Newest First</option>
                       <option value="oldest">Oldest First</option>
                       <option value="az">A-Z</option>
                   </select>
                   <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                </div>
             </div>

             <button 
               onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
               className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-bold transition-all ${showFavoritesOnly ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
             >
                <Heart size={16} fill={showFavoritesOnly ? "currentColor" : "none"} />
                <span>Favorites Only</span>
             </button>
         </div>
      </div>

      {/* Grid */}
      {filteredStories.length === 0 ? (
         <div className="text-center py-20 opacity-60">
             <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
             <p className="text-lg font-serif text-gray-500">No items found matching your filters.</p>
             <button onClick={clearFilters} className="mt-4 text-gold font-bold hover:underline">Clear all filters</button>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStories.map((story) => {
             const Icon = story.type === AppMode.STORIES ? Feather : story.type === AppMode.CONCEPTS ? Atom : Scale;
             const accentColor = story.type === AppMode.STORIES ? 'text-gold' : story.type === AppMode.CONCEPTS ? 'text-emerald-500' : 'text-indigo-500';

             return (
              <div key={story.id} className="bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 hover:border-gray-200 transition-all duration-300 overflow-hidden group flex flex-col">
                  <div className="p-6 flex-1 cursor-pointer" onClick={() => onSelect(story)}>
                      <div className="flex justify-between items-start mb-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-xs font-bold uppercase tracking-wide ${accentColor}`}>
                              <Icon size={14} />
                              <span>{getCategoryLabel(story.metadata.categoryId)}</span>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{formatDate(story.metadata.createdAt)}</span>
                      </div>

                      <h3 className="text-xl font-bold font-serif text-ink mb-2 group-hover:text-ocean transition-colors line-clamp-2">
                          {getTitle(story)}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                          <span className="font-bold text-gray-700">{(story.itemData as any).name}</span>
                          <span className="text-gray-300">|</span>
                          <span>{getItemDescription(story)}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                          {/* Tags preview */}
                          {(story.itemData as any).values?.slice(0, 2).map((v: string) => (
                              <span key={v} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-100">{v}</span>
                          ))}
                          {(story.itemData as any).tags?.slice(0, 2).map((v: string) => (
                              <span key={v} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-100">{v}</span>
                          ))}
                      </div>
                  </div>

                  <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-between items-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(story.id); }}
                        className={`p-2 rounded-full transition-colors ${story.isFavorite ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-white'}`}
                        title="Favorite"
                      >
                          <Heart size={18} fill={story.isFavorite ? "currentColor" : "none"} />
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(story.id); }}
                        className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete from Library"
                      >
                          <Trash2 size={18} />
                      </button>
                  </div>
              </div>
             );
          })}
        </div>
      )}
    </div>
  );
};
