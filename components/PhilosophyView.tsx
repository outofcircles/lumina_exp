import React, { useState } from 'react';
import { PhilosophyEntry, PhilosophyItem, Category, StoryLength, ReadingLevel } from '../types';
import { PHILOSOPHY_NARRATOR_STYLES } from '../constants';
import { ArrowLeft, BookOpen, Scale, Globe, Flag, Image as ImageIcon, ExternalLink, Lightbulb, RefreshCw, Printer } from 'lucide-react';
import { ReportDialog } from './ReportDialog';
import { Typewriter } from './Typewriter';
import { FallbackIllustration } from './FallbackIllustration';
import { ReadingLevelToggle } from './ReadingLevelToggle';
import { SourcesPanel } from './SourcesPanel';

interface PhilosophyViewProps {
  entry: PhilosophyEntry;
  item: PhilosophyItem;
  onBack: () => void;
  loadingImages?: boolean;
  category: Category;
  storyLength: StoryLength;
  onRegenerate: (englishStyleId?: string, hindiStyleId?: string, length?: StoryLength, narratorStyleId?: string, readingLevel?: ReadingLevel) => void;
  readingLevel: ReadingLevel;
  onReadingLevelChange: (level: ReadingLevel) => void;
  currentNarratorStyleId: string;
}

const LENGTH_LABELS: Record<StoryLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' };

export const PhilosophyView: React.FC<PhilosophyViewProps> = ({
  entry, item, onBack, loadingImages, category, storyLength, onRegenerate,
  readingLevel, onReadingLevelChange, currentNarratorStyleId,
}) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [localNarratorStyleId, setLocalNarratorStyleId] = useState(currentNarratorStyleId || PHILOSOPHY_NARRATOR_STYLES[0].id);

  const renderSourceLink = (source: string) => {
    const isUrl = /^(http|www)/.test(source);
    const href = isUrl
      ? (source.startsWith('http') ? source : `https://${source}`)
      : `https://www.google.com/search?q=${encodeURIComponent(source)}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 transition-colors text-left flex items-center gap-1.5 font-medium">
        <span className="truncate max-w-[250px] sm:max-w-md">{source}</span>
        <ExternalLink size={12} className="shrink-0" />
      </a>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <button onClick={onBack} className="group mb-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-700 transition-colors no-print">
        <div className="p-2 rounded-full bg-white border border-gray-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors">
          <ArrowLeft size={16} />
        </div>
        <span>Back to Wisdom</span>
      </button>

      <article className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-900/5 overflow-hidden border border-gray-100">
        <div className="relative h-[35vh] min-h-[300px] md:h-[450px] bg-indigo-950">
          {loadingImages ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-900/50 animate-pulse text-indigo-100">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-widest">Visualizing Concept...</p>
            </div>
          ) : (entry.generatedImageUrl && !imgError) ? (
            <img src={entry.generatedImageUrl} alt={entry.illustrationPrompt} onError={() => setImgError(true)} className="w-full h-full object-cover opacity-80 mix-blend-overlay animate-fadeIn" />
          ) : (
            <FallbackIllustration category={category} />
          )}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/60 to-transparent p-8 md:p-12 z-20">
            <div className="flex gap-3 mb-3">
              <span className="inline-flex items-center bg-indigo-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider shadow-sm border border-indigo-400/30">{item.origin}</span>
              <span className="inline-flex items-center bg-black/40 backdrop-blur-sm text-indigo-100 text-xs font-medium px-3 py-1 rounded-md border border-white/10">{item.era}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-serif font-bold text-white mb-1 drop-shadow-lg leading-tight tracking-tight">
              <Typewriter text={entry.title} speed={30} />
            </h1>
          </div>
        </div>

        <div className="p-8 sm:p-12 space-y-10 max-w-4xl mx-auto">

          {/* Toolbar */}
          <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Length</span>
                {(['short', 'medium', 'long'] as StoryLength[]).map(l => (
                  <button key={l} onClick={() => onRegenerate(undefined, undefined, l)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${storyLength === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                    {LENGTH_LABELS[l]}
                  </button>
                ))}
              </div>
              <ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} accentColor="indigo" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Voice</span>
                <select
                  value={localNarratorStyleId}
                  onChange={e => setLocalNarratorStyleId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {PHILOSOPHY_NARRATOR_STYLES.map(s => <option key={s.id} value={s.id}>{s.persona} ({s.name})</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => onRegenerate(undefined, undefined, undefined, localNarratorStyleId)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-indigo-700 border border-indigo-200 hover:bg-indigo-50 transition-all">
                <RefreshCw size={15} /> Regenerate
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all">
                <Printer size={15} /> Print / PDF
              </button>
            </div>
          </div>

          <section className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-200 rounded-full"></div>
            <div className="pl-6 md:pl-8 py-1">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={16} className="text-indigo-600" />
                <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Core Concept</h2>
              </div>
              <div className="text-xl md:text-2xl font-serif text-gray-800 leading-relaxed font-medium text-justify md:text-left">
                <Typewriter text={entry.coreIdeaExplanation} speed={15} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="flex items-center gap-3 text-lg font-bold text-gray-900 mb-5 border-b border-gray-100 pb-2">
              <Globe size={18} className="text-indigo-500" /> Historical Context
            </h2>
            <div className="prose prose-lg md:prose-xl text-gray-600 leading-loose whitespace-pre-line font-serif text-justify md:text-left">
              <Typewriter text={entry.historicalEpisode} speed={5} />
            </div>
          </section>

          <section className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
            <h2 className="flex items-center gap-3 text-lg font-bold text-indigo-900 mb-4">
              <Scale size={18} className="text-indigo-600" /> Modern Relevance
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed font-sans">
              <Typewriter text={entry.modernrelevance} speed={10} />
            </p>
          </section>

          <section className="pt-8 border-t border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">References &amp; Further Reading</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
              {entry.sources.map((source, idx) => (
                <li key={idx} className="text-sm text-gray-500 flex items-start gap-3">
                  <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full mt-2 shrink-0"></span>
                  {renderSourceLink(source)}
                </li>
              ))}
            </ul>
          </section>

          {entry.research && (
            <SourcesPanel research={entry.research} accentColor="indigo" />
          )}

          <div className="no-print flex justify-center pt-6">
            <button onClick={() => setReportOpen(true)} className="group flex items-center gap-2 text-gray-400 hover:text-gray-600 px-4 py-2 rounded-full hover:bg-gray-50 transition-all text-xs font-semibold uppercase tracking-wider">
              <Flag size={14} className="group-hover:text-red-400 transition-colors" /> Report Content
            </button>
          </div>
        </div>
      </article>

      <ReportDialog isOpen={reportOpen} onClose={() => setReportOpen(false)} contentTitle={entry.title} />
    </div>
  );
};
