import React from 'react';
import { Profile, ScienceItem, PhilosophyItem, AppMode } from '../types';
import { User, MapPin, Calendar, Sparkles, Atom, BookOpen, ArrowRight } from 'lucide-react';

interface ItemPickerProps {
  items: (Profile | ScienceItem | PhilosophyItem)[];
  onSelect: (item: any) => void;
  loading: boolean;
  mode: AppMode;
}

export const ItemPicker: React.FC<ItemPickerProps> = ({ items, onSelect, loading, mode }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse space-y-8">
        <div className="w-20 h-20 rounded-full bg-gold/20 animate-bounce"></div>
        <div className="text-center space-y-2">
            <div className="h-4 w-48 bg-gray-200 rounded mx-auto"></div>
            <div className="text-gold font-serif text-xl font-medium">Consulting the archives...</div>
        </div>
      </div>
    );
  }

  // Helper to normalize data for display
  const getDisplayData = (item: any) => {
    if (mode === AppMode.STORIES) {
      const p = item as Profile;
      return {
        title: p.name,
        subtitle: p.title,
        desc: p.description,
        era: p.era,
        meta1: p.region,
        metaIcon: MapPin,
        tags: p.values,
        action: "Read Story"
      };
    } else if (mode === AppMode.CONCEPTS) {
      const s = item as ScienceItem;
      return {
        title: s.name,
        subtitle: s.field,
        desc: s.description,
        era: s.era,
        meta1: s.field,
        metaIcon: Atom,
        tags: s.tags,
        action: "Explore Concept"
      };
    } else {
      const ph = item as PhilosophyItem;
      return {
        title: ph.name,
        subtitle: ph.origin,
        desc: ph.coreIdea,
        era: ph.era,
        meta1: ph.origin,
        metaIcon: BookOpen,
        tags: ph.tags,
        action: "Read History"
      };
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <h2 className="text-4xl md:text-5xl font-serif text-center mb-4 text-ink font-medium tracking-tight">
        {mode === AppMode.STORIES && "Who would you like to meet?"}
        {mode === AppMode.CONCEPTS && "What would you like to discover?"}
        {mode === AppMode.PHILOSOPHIES && "Which idea sparks your curiosity?"}
      </h2>
      <p className="text-center text-gray-500 mb-16 text-lg">Select a card to begin the journey.</p>
      
      {/* CHANGED: Using Flex with justify-center instead of Grid to ensure centering */}
      <div className="flex flex-wrap justify-center gap-8">
        {items.map((item, index) => {
          const data = getDisplayData(item);
          const MetaIcon = data.metaIcon;

          return (
            <div 
              key={index}
              onClick={() => onSelect(item)}
              className="group bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl border border-gray-100 hover:border-gold/30 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col w-full md:w-[380px] relative"
            >
              {/* Hover Accent Line */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gold/0 via-gold to-gold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="p-8 flex-1 flex flex-col items-center text-center">
                <div className="mb-6">
                   <div className="bg-amber-50 text-amber-900 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest border border-amber-100 shadow-sm">
                      {data.era}
                   </div>
                </div>
                
                <h3 className="text-3xl font-serif font-bold text-ink mb-2 group-hover:text-gold transition-colors leading-tight">
                    {data.title}
                </h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">{data.subtitle}</p>
                
                <p className="text-gray-600 leading-relaxed mb-8 text-base line-clamp-4">
                    {data.desc}
                </p>
                
                <div className="mt-auto space-y-5 w-full pt-6 border-t border-dashed border-gray-100">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 font-medium">
                    <MetaIcon size={16} className="text-gold" />
                    <span>{data.meta1}</span>
                  </div>
                  
                  <div className="flex flex-wrap justify-center gap-2">
                    {data.tags.slice(0, 3).map(v => (
                      <span key={v} className="bg-gray-50 px-3 py-1 rounded-lg text-xs font-bold text-gray-500 border border-gray-200/50">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-5 border-t border-gray-100 group-hover:bg-ink group-hover:text-white transition-colors duration-300 text-center text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-3">
                <span>{data.action}</span>
                <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
