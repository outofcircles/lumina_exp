
import React from 'react';
import { Profile, ScienceItem, PhilosophyItem, AppMode } from '../types';
import { User, MapPin, Calendar, Sparkles, Atom, BookOpen } from 'lucide-react';

interface ItemPickerProps {
  items: (Profile | ScienceItem | PhilosophyItem)[];
  onSelect: (item: any) => void;
  loading: boolean;
  mode: AppMode;
}

export const ItemPicker: React.FC<ItemPickerProps> = ({ items, onSelect, loading, mode }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] animate-pulse space-y-6">
        <div className="w-24 h-24 rounded-full bg-gray-200"></div>
        <div className="h-4 w-48 bg-gray-200 rounded"></div>
        <div className="text-gray-500 font-serif text-lg">Consulting the archives...</div>
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
    <div className="w-full max-w-6xl mx-auto p-4">
      <h2 className="text-3xl font-serif text-center mb-2 text-ink">
        {mode === AppMode.STORIES && "Who would you like to meet?"}
        {mode === AppMode.CONCEPTS && "What would you like to discover?"}
        {mode === AppMode.PHILOSOPHIES && "Which idea sparks your curiosity?"}
      </h2>
      <p className="text-center text-gray-600 mb-10">Select a card to begin the journey.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((item, index) => {
          const data = getDisplayData(item);
          const MetaIcon = data.metaIcon;

          return (
            <div 
              key={index}
              onClick={() => onSelect(item)}
              className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-gold transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                   <div className="bg-gold-light text-yellow-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {data.era}
                   </div>
                </div>
                
                <h3 className="text-xl font-bold text-ink mb-1 group-hover:text-ocean transition-colors">{data.title}</h3>
                <p className="text-sm text-gray-500 italic mb-4">{data.subtitle}</p>
                <p className="text-gray-700 leading-relaxed mb-6 text-sm">{data.desc}</p>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MetaIcon size={16} className="text-gray-400" />
                    <span>{data.meta1}</span>
                  </div>
                  <div className="flex items-start gap-2 mt-3">
                    <Sparkles size={16} className="text-gold mt-0.5" />
                    <div className="flex flex-wrap gap-2">
                      {data.tags.map(v => (
                        <span key={v} className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600">{v}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 border-t border-gray-100 group-hover:bg-ocean group-hover:text-white transition-colors text-center text-sm font-semibold flex items-center justify-center gap-2">
                <span>{data.action}</span>
                <User size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
