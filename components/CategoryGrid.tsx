
import React from 'react';
import { Category } from '../types';
import * as Icons from 'lucide-react';

interface CategoryGridProps {
  categories: Category[];
  onSelect: (categoryId: string) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({ categories, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {categories.map((cat) => {
        // Dynamically access icon component
        const IconComponent = (Icons as any)[cat.icon] || Icons.Star;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl border-2 border-transparent hover:border-black/10 group ${cat.color} bg-opacity-20`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <IconComponent size={80} />
            </div>
            
            <div className="relative z-10">
              <div className={`inline-flex p-3 rounded-full mb-4 bg-white shadow-sm`}>
                <IconComponent size={24} className={cat.color.split(' ')[1]} />
              </div>
              <h3 className="text-xl font-serif font-bold mb-2 text-ink">{cat.label}</h3>
              <p className="text-sm opacity-80 text-ink leading-relaxed">{cat.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
