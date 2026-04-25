import React, { useState } from 'react';
import { ScienceEntry, ScienceItem, Category, StoryLength, ReadingLevel } from '../types';
import { SCIENCE_NARRATOR_STYLES } from '../constants';
import { ArrowLeft, FlaskConical, Book, Flag, Image as ImageIcon, ExternalLink, RefreshCw, Printer } from 'lucide-react';
import { ReportDialog } from './ReportDialog';
import { Typewriter } from './Typewriter';
import { FallbackIllustration } from './FallbackIllustration';
import { ReadingLevelToggle } from './ReadingLevelToggle';
import { SourcesPanel } from './SourcesPanel';

interface ScienceViewProps {
  entry: ScienceEntry;
  item: ScienceItem;
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

export const ScienceView: React.FC<ScienceViewProps> = ({
  entry, item, onBack, loadingImages, category, storyLength, onRegenerate,
  readingLevel, onReadingLevelChange, currentNarratorStyleId,
}) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [localNarratorStyleId, setLocalNarratorStyleId] = useState(currentNarratorStyleId || SCIENCE_NARRATOR_STYLES[0].id);

  const renderSourceLink = (source: string) => {
    const isUrl = /^(http|www)/.test(source);
    const href = isUrl
      ? (source.startsWith('http') ? source : `https://${source}`)
      : `https://www.google.com/search?q=${encodeURIComponent(source)}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="hover:text-emerald-600 hover:underline decoration-emerald-300 underline-offset-2 transition-colors text-left flex items-center gap-1.5 font-medium">
        <span className="truncate max-w-[250px] sm:max-w-md">{source}</span>
        <ExternalLink size={12} className="shrink-0" />
      </a>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <button onClick={onBack} className="group mb-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-emerald-700 transition-colors no-print">
        <div className="p-2 rounded-full bg-white border border-gray-200 group-hover:border-emerald-200 group-hover:bg-emerald-50 transition-colors">
          <ArrowLeft size={16} />
        </div>
        <span>Back to Lab</span>
      </button>

      <article className="bg-white rounded-[2rem] shadow-2xl shadow-emerald-900/5 overflow-hidden border border-gray-100">
        <div className="relative h-[40vh] min-h-[300px] md:h-[500px] bg-emerald-950">
          {loadingImages ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-900/50 animate-pulse text-emerald-100">
              <ImageIcon size={48} className="mb-4 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-widest">Sketching Diagram...</p>
            </div>
          ) : (entry.generatedImageUrl && !imgError) ? (
            <img src={entry.generatedImageUrl} alt={entry.illustrationPrompt} onError={() => setImgError(true)} className="w-full h-full object-cover opacity-90 animate-fadeIn" />
          ) : (
            <FallbackIllustration category={category} />
          )}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-emerald-950/90 via-emerald-950/50 to-transparent p-8 md:p-12 z-20">
            <div className="inline-block bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider shadow-lg">{item.field}</div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-bold text-white mb-2 drop-shadow-lg leading-none tracking-tight">
              <Typewriter text={entry.title} speed={30} />
            </h1>
            <p className="text-emerald-100/90 text-lg sm:text-xl font-medium">{item.era}</p>
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${storyLength === l ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                    {LENGTH_LABELS[l]}
                  </button>
                ))}
              </div>
              <ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} accentColor="emerald" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Voice</span>
                <select
                  value={localNarratorStyleId}
                  onChange={e => setLocalNarratorStyleId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  {SCIENCE_NARRATOR_STYLES.map(s => <option key={s.id} value={s.id}>{s.persona} ({s.name})</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => onRegenerate(undefined, undefined, undefined, localNarratorStyleId)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-all">
                <RefreshCw size={15} /> Regenerate
              </button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all">
                <Printer size={15} /> Print / PDF
              </button>
            </div>
          </div>

          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">The Concept</h2>
            <div className="text-xl sm:text-3xl font-serif text-gray-800 leading-relaxed border-l-[6px] border-emerald-500 pl-8 py-2">
              <Typewriter text={entry.conceptDefinition} speed={20} />
            </div>
          </section>

          <section>
            <h2 className="flex items-center gap-3 text-2xl font-bold text-ink mb-6 tracking-tight">
              <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700"><Book size={20} strokeWidth={2.5} /></div>
              The Story Behind the Discovery
            </h2>
            <div className="prose prose-lg md:prose-xl text-gray-600 leading-loose whitespace-pre-line max-w-none font-serif">
              <Typewriter text={entry.humanStory} speed={5} />
            </div>
          </section>

          <section className="bg-emerald-50/80 rounded-3xl p-8 sm:p-10 border border-emerald-100 shadow-sm">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-emerald-900 mb-4 tracking-tight">
              <div className="p-1.5 bg-white rounded-lg text-emerald-600 shadow-sm"><FlaskConical size={20} strokeWidth={2.5} /></div>
              Try This!
            </h2>
            <p className="text-emerald-900 text-lg leading-relaxed font-medium">
              <Typewriter text={entry.experimentOrActivity} speed={10} />
            </p>
          </section>

          <section className="pt-10 border-t border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">Sources &amp; Further Reading</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
              {entry.sources.map((source, idx) => (
                <li key={idx} className="text-sm text-gray-500 flex items-start gap-3">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full mt-2 shrink-0"></span>
                  {renderSourceLink(source)}
                </li>
              ))}
            </ul>
          </section>

          {entry.research && (
            <SourcesPanel research={entry.research} accentColor="emerald" />
          )}

          <div className="no-print flex justify-center border-t border-gray-100 pt-10">
            <button onClick={() => setReportOpen(true)} className="group flex items-center gap-2 text-gray-400 hover:text-red-500 px-4 py-2 rounded-full hover:bg-red-50 transition-all text-xs font-bold uppercase tracking-wider">
              <Flag size={14} className="group-hover:fill-current" /> Report Issue
            </button>
          </div>
        </div>
      </article>

      <ReportDialog isOpen={reportOpen} onClose={() => setReportOpen(false)} contentTitle={entry.title} />
    </div>
  );
};
