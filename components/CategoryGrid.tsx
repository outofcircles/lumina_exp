import React from 'react';
import { Category } from '../types';
import * as Icons from 'lucide-react';

interface CategoryGridProps {
  categories: Category[];
  onSelect: (categoryId: string) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onSelect }) => {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
        {categories.map((cat) => {
          // Dynamically access icon component safely
          const IconComponent = (Icons as any)[cat.icon] || Icons.Star;

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              // DESIGN FIX 1: 'h-full' ensures card stretches to match tallest neighbor
              // DESIGN FIX 2: Focus rings added for accessibility
              className={`
                group relative flex flex-col h-full text-left
                rounded-3xl p-6 transition-all duration-300 ease-out
                border border-transparent hover:border-black/5
                hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black/10
                ${cat.color} bg-opacity-20
              `}
            >
              {/* Decorative Background Icon - Moved to bottom right for better text readability */}
              <div className="absolute -bottom-4 -right-4 opacity-[0.08] group-hover:opacity-15 transition-opacity duration-300 rotate-12">
                <IconComponent size={120} />
              </div>
              
              <div className="relative z-10 flex flex-col h-full">
                {/* Icon Container */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white shadow-sm mb-5 transition-transform group-hover:scale-110 duration-300">
                   {/* Assuming cat.color format includes text color class like 'text-blue-500' */}
                  <IconComponent size={24} className={cat.color.split(' ')[1] || 'text-gray-700'} />
                </div>

                {/* Text Content */}
                <h3 className="text-xl font-serif font-bold mb-3 text-gray-900 leading-tight">
                  {cat.label}
                </h3>
                
                {/* DESIGN FIX 3: line-clamp-3 limits description to 3 lines to preserve grid alignment */}
                <p className="text-sm text-gray-700/80 leading-relaxed line-clamp-3">
                  {cat.description}
                </p>

                {/* Visual anchor for the bottom (Optional "View" text or arrow) */}
                <div className="mt-auto pt-4 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 text-xs font-semibold uppercase tracking-wider text-gray-900/60">
                  View Category
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
