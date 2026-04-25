import React from 'react';
import { ReadingLevel } from '../types';
import { BookOpen } from 'lucide-react';

interface ReadingLevelToggleProps {
  value: ReadingLevel;
  onChange: (level: ReadingLevel) => void;
  accentColor?: string;
}

const LEVEL_LABELS: Record<ReadingLevel, string> = {
  young: 'Ages 6–10',
  middle: 'Ages 10–14',
  teen: 'Ages 14+',
};

export const ReadingLevelToggle: React.FC<ReadingLevelToggleProps> = ({
  value, onChange, accentColor = 'indigo',
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    <BookOpen size={14} className={`text-${accentColor}-400 shrink-0`} />
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Age</span>
    {(['young', 'middle', 'teen'] as ReadingLevel[]).map(level => (
      <button
        key={level}
        onClick={() => onChange(level)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
          value === level
            ? `bg-${accentColor}-600 text-white border-${accentColor}-600`
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
        }`}
      >
        {LEVEL_LABELS[level]}
      </button>
    ))}
  </div>
);
