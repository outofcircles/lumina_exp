import React from 'react';
import { Category } from '../types';
import * as Icons from 'lucide-react';

interface FallbackIllustrationProps {
  category: Category;
  className?: string;
}

export const FallbackIllustration: React.FC<FallbackIllustrationProps> = ({ category, className = "" }) => {
  // Dynamic icon
  const IconComponent = (Icons as any)[category.icon] || Icons.Star;
  
  // Extract color class for bg (e.g., "bg-blue-100 text-blue-600")
  // We want to handle the tailwind classes carefully
  const parts = category.color.split(' ');
  const baseColor = parts.find(c => c.startsWith('bg-')) || 'bg-gray-100';
  const textColor = parts.find(c => c.startsWith('text-')) || 'text-gray-600';

  return (
    <div className={`w-full h-full relative overflow-hidden ${baseColor} ${className}`}>
      {/* Decorative Patterns */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-white mix-blend-overlay blur-3xl"></div>
         <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-black mix-blend-overlay blur-3xl opacity-20"></div>
      </div>
      
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="currentColor" className={textColor} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10">
        <div className={`p-6 bg-white/40 backdrop-blur-md rounded-full shadow-sm mb-4 ring-4 ring-white/30`}>
           <IconComponent size={64} className={textColor} strokeWidth={1.5} />
        </div>
        <h3 className={`text-xl font-serif font-bold ${textColor} opacity-90 tracking-widest uppercase`}>
            {category.label}
        </h3>
      </div>
    </div>
  );
};