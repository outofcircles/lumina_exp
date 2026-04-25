import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react';
import { StoryResearch, ScienceResearch, PhilosophyResearch } from '../types';

type Research = StoryResearch | ScienceResearch | PhilosophyResearch;

interface SourcesPanelProps {
  research: Research;
  accentColor?: string;
}

const isStoryResearch = (r: Research): r is StoryResearch => 'keyEvents' in r;
const isScienceResearch = (r: Research): r is ScienceResearch => 'discoveryContext' in r;

const renderSourceLink = (source: string, accentColor: string) => {
  const isUrl = /^(http|www)/.test(source);
  const href = isUrl
    ? (source.startsWith('http') ? source : `https://${source}`)
    : `https://www.google.com/search?q=${encodeURIComponent(source)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`hover:text-${accentColor}-600 hover:underline transition-colors flex items-center gap-1 font-medium text-gray-600`}>
      <span className="truncate max-w-[260px]">{source}</span>
      <ExternalLink size={10} className="shrink-0" />
    </a>
  );
};

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ research, accentColor = 'indigo' }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Search size={14} className={`text-${accentColor}-500`} />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Research Sources</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="p-6 space-y-6 bg-white">
          {isStoryResearch(research) && (
            <>
              {research.keyEvents.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Key Events</h4>
                  <ul className="space-y-2">
                    {research.keyEvents.map((e, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className={`w-1 h-1 bg-${accentColor}-300 rounded-full mt-2 shrink-0`}></span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {research.quotes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Documented Quotes</h4>
                  <ul className="space-y-2">
                    {research.quotes.map((q, i) => (
                      <li key={i} className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {isScienceResearch(research) && (
            <>
              {research.realWorldApplications.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Real-World Applications</h4>
                  <ul className="space-y-2">
                    {research.realWorldApplications.map((a, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className={`w-1 h-1 bg-${accentColor}-300 rounded-full mt-2 shrink-0`}></span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!isStoryResearch(research) && !isScienceResearch(research) && (
            <>
              {'societalImpacts' in research && (research as PhilosophyResearch).societalImpacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Societal Impacts</h4>
                  <ul className="space-y-2">
                    {(research as PhilosophyResearch).societalImpacts.map((s, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className={`w-1 h-1 bg-${accentColor}-300 rounded-full mt-2 shrink-0`}></span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {research.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sources</h4>
              <ul className="space-y-2">
                {research.sources.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-gray-400">·</span>
                    {renderSourceLink(s, accentColor)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
