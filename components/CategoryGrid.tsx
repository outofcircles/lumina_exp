
import React from 'react';
import { Category } from '../types';
import * as Icons from 'lucide-react';

interface CategoryGridProps {
  categories: Category[];
  onSelect: (categoryId: string) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {categories.map((cat) => {
        // Dynamically access icon component
        const IconComponent = (Icons as any)[cat.icon] || Icons.Star;
        
        // Extract colors assuming format 'bg-color-100 text-color-600'
        // We'll apply these to specific elements instead of the whole card
        const parts = cat.color.split(' ');
        const bgColorClass = parts.find(c => c.startsWith('bg-')) || 'bg-gray-100';
        const textColorClass = parts.find(c => c.startsWith('text-')) || 'text-gray-600';

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="group relative flex flex-col items-start p-8 bg-white rounded-[2rem] text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-xl border border-gray-100 hover:border-transparent h-full overflow-hidden"
          >
            {/* Hover Gradient Background (Subtle Fade in) */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 ${textColorClass.replace('text', 'bg')}`}></div>
            
            {/* Large Watermark Icon */}
            <div className={`absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500 rotate-12`}>
              <IconComponent size={140} className={textColorClass} strokeWidth={1} />
            </div>
            
            {/* Icon Container */}
            <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300 shadow-sm ${bgColorClass} ${textColorClass}`}>
              <IconComponent size={32} strokeWidth={2} />
            </div>

            {/* Text Content */}
            <div className="relative z-10">
              <h3 className="text-2xl font-serif font-bold mb-3 text-ink group-hover:text-black transition-colors tracking-tight">
                {cat.label}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed font-medium group-hover:text-gray-600 pr-4">
                {cat.description}
              </p>
            </div>
            
            {/* Decorative Arrow (Optional, appears on hover) */}
            <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                 <Icons.ArrowRight className={textColorClass} size={20} />
            </div>
          </button>
        );
      })}
    </div>
  );
};
