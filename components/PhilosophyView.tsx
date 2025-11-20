import React, { useState } from 'react';
import { PhilosophyEntry, PhilosophyItem, Category } from '../types';
import { ArrowLeft, BookOpen, Scale, Globe, Flag, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ReportDialog } from './ReportDialog';
import { Typewriter } from './Typewriter';
import { FallbackIllustration } from './FallbackIllustration';
import { ParentalGate } from './ParentalGate';

interface PhilosophyViewProps {
  entry: PhilosophyEntry;
  item: PhilosophyItem;
  onBack: () => void;
  loadingImages?: boolean;
  category: Category;
}

export const PhilosophyView: React.FC<PhilosophyViewProps> = ({ entry, item, onBack, loadingImages, category }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'report' | 'link' | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [imgError, setImgError] = useState(false);

  const handleActionRequest = (action: 'report' | 'link', url?: string) => {
    setPendingAction(action);
    if (url) setSelectedUrl(url);
    setGateOpen(true);
  };

  const handleGateSuccess = () => {
    if (pendingAction === 'report') {
      setReportOpen(true);
    } else if (pendingAction === 'link' && selectedUrl) {
      window.open(selectedUrl, '_blank', 'noopener,noreferrer');
    }
    setPendingAction(null);
  };
  
  const renderSourceLink = (source: string) => {
    const isUrl = /^(http|www)/.test(source);
    const href = isUrl 
        ? (source.startsWith('http') ? source : `https://${source}`) 
        : `https://www.google.com/search?q=${encodeURIComponent(source)}`;

    return (
        <button 
          onClick={() => handleActionRequest('link', href)}
          className="hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 transition-colors text-left flex items-center gap-1.5 font-medium"
        >
            <span className="truncate max-w-[250px] sm:max-w-md">{source}</span>
            <ExternalLink size={12} className="shrink-0" />
        </button>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <button 
        onClick={onBack}
        className="group mb-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-700 transition-colors"
      >
        <div className="p-2 rounded-full bg-white border border-gray-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors">
            <ArrowLeft size={16} />
        </div>
        <span>Back to Wisdom</span>
      </button>

      <article className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-900/5 overflow-hidden border border-gray-100">
        {/* Header Image */}
        <div className="relative h-[40vh] min-h-[300px] md:h-[500px] bg-indigo-950">
          {loadingImages ? (
             <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-900/50 animate-pulse text-indigo-100">
                <ImageIcon size={48} className="mb-4 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest">Painting Thought...</p>
             </div>
          ) : (entry.generatedImageUrl && !imgError) ? (
             <img 
               src={entry.generatedImageUrl} 
               alt={entry.illustrationPrompt} 
               onError={() => setImgError(true)}
               className="w-full h-full object-cover opacity-80 mix-blend-overlay animate-fadeIn"
             />
          ) : (
             <FallbackIllustration category={category} />
          )}
          
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-8 md:p-12 z-20">
             <div className="flex gap-2 mb-4">
                <span className="inline-block bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    {item.origin}
                </span>
             </div>
             <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-bold text-white mb-2 drop-shadow-lg leading-none tracking-tight">
                <Typewriter text={entry.title} speed={30} />
             </h1>
             <p className="text-indigo-200/90 text-lg sm:text-xl font-medium">{item.era}</p>
          </div>
        </div>

        <div className="p-8 sm:p-12 space-y-14 max-w-4xl mx-auto">
          
          {/* Core Idea - Hero Text */}
          <section className="text-center max-w-3xl mx-auto py-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">The Idea</h2>
            <p className="text-3xl sm:text-4xl md:text-5xl font-serif text-indigo-950 leading-tight italic tracking-tight">
               "<Typewriter text={entry.coreIdeaExplanation} speed={20} />"
            </p>
          </section>

          {/* Historical Episode */}
          <section>
             <h2 className="flex items-center gap-3 text-2xl font-bold text-ink mb-6 tracking-tight">
                <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-700">
                    <Globe size={20} strokeWidth={2.5} />
                </div>
                A Moment in History
             </h2>
             <div className="prose prose-lg md:prose-xl text-gray-700 leading-loose whitespace-pre-line font-serif">
                <Typewriter text={entry.historicalEpisode} speed={5} />
             </div>
          </section>

          {/* Modern Relevance */}
          <section className="bg-indigo-50/80 rounded-3xl p-8 sm:p-10 border border-indigo-100 shadow-sm">
             <h2 className="flex items-center gap-3 text-2xl font-bold text-indigo-900 mb-4 tracking-tight">
                <div className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm">
                    <Scale size={20} strokeWidth={2.5} />
                </div>
                Why it Matters Today
             </h2>
             <p className="text-indigo-900 text-lg leading-relaxed font-medium">
                <Typewriter text={entry.modernrelevance} speed={10} />
             </p>
          </section>

          {/* Sources */}
          <section className="pt-10 border-t border-gray-100">
             <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">References</h2>
             <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
                {entry.sources.map((source, idx) => (
                   <li key={idx} className="text-sm text-gray-500 flex items-start gap-3">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full mt-2 shrink-0"></span>
                      {renderSourceLink(source)}
                   </li>
                ))}
             </ul>
          </section>
          
          {/* Safety / Report Footer */}
          <div className="flex justify-center border-t border-gray-100 pt-10">
              <button 
                onClick={() => handleActionRequest('report')}
                className="group flex items-center gap-2 text-gray-400 hover:text-red-500 px-4 py-2 rounded-full hover:bg-red-50 transition-all text-xs font-bold uppercase tracking-wider"
              >
                 <Flag size={14} className="group-hover:fill-current" />
                 Report Issue
              </button>
          </div>

        </div>
      </article>

      <ParentalGate 
        isOpen={gateOpen} 
        onClose={() => setGateOpen(false)} 
        onSuccess={handleGateSuccess}
        actionName={pendingAction === 'link' ? "visit this external website" : "submit a report"}
      />

      <ReportDialog 
        isOpen={reportOpen} 
        onClose={() => setReportOpen(false)} 
        contentTitle={entry.title} 
      />
    </div>
  );
};
