import React, { useState } from 'react';
import { ScienceEntry, ScienceItem, Category } from '../types';
import { ArrowLeft, FlaskConical, Book, Flag, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ReportDialog } from './ReportDialog';
import { Typewriter } from './Typewriter';
import { FallbackIllustration } from './FallbackIllustration';
import { ParentalGate } from './ParentalGate';

interface ScienceViewProps {
  entry: ScienceEntry;
  item: ScienceItem;
  onBack: () => void;
  loadingImages?: boolean;
  category: Category;
}

export const ScienceView: React.FC<ScienceViewProps> = ({ entry, item, onBack, loadingImages, category }) => {
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
          className="hover:text-emerald-600 hover:underline decoration-emerald-300 underline-offset-2 transition-colors text-left flex items-center gap-1"
        >
            <span>{source}</span>
            <ExternalLink size={10} />
        </button>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fadeIn">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-gray-500 hover:text-ink transition-colors font-semibold"
      >
        <ArrowLeft size={20} />
        <span>Back to Lab</span>
      </button>

      <article className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        {/* Header Image */}
        <div className="relative h-64 md:h-80 bg-emerald-900">
          {loadingImages ? (
             <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-900/50 animate-pulse text-emerald-100">
                <ImageIcon size={48} className="mb-4 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-wider">Sketching Diagram...</p>
             </div>
          ) : (entry.generatedImageUrl && !imgError) ? (
             <img 
               src={entry.generatedImageUrl} 
               alt={entry.illustrationPrompt} 
               onError={() => setImgError(true)}
               className="w-full h-full object-cover opacity-90 animate-fadeIn"
             />
          ) : (
             <FallbackIllustration category={category} />
          )}
          
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-8 z-20">
             <div className="inline-block bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded mb-2 uppercase tracking-wide">
                {item.field}
             </div>
             <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-1 drop-shadow-md">
                <Typewriter text={entry.title} speed={30} />
             </h1>
             <p className="text-emerald-100 text-lg">{item.era}</p>
          </div>
        </div>

        <div className="p-8 md:p-12 space-y-10">
          
          {/* Concept Definition */}
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">The Concept</h2>
            <p className="text-2xl font-serif text-gray-800 leading-relaxed border-l-4 border-emerald-500 pl-6">
               <Typewriter text={entry.conceptDefinition} speed={20} />
            </p>
          </section>

          {/* The Human Story */}
          <section>
             <h2 className="flex items-center gap-2 text-xl font-bold text-ink mb-4">
                <Book className="text-emerald-600" />
                The Story Behind the Discovery
             </h2>
             <div className="prose prose-lg text-gray-600 leading-loose whitespace-pre-line">
                <Typewriter text={entry.humanStory} speed={5} />
             </div>
          </section>

          {/* Experiment / Activity */}
          <section className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100">
             <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-800 mb-4">
                <FlaskConical className="text-emerald-600" />
                Try This!
             </h2>
             <p className="text-emerald-900 leading-relaxed">
                <Typewriter text={entry.experimentOrActivity} speed={10} />
             </p>
          </section>

          {/* Sources */}
          <section className="pt-8 border-t border-gray-100">
             <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Sources & Further Reading</h2>
             <ul className="space-y-2">
                {entry.sources.map((source, idx) => (
                   <li key={idx} className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                      {renderSourceLink(source)}
                   </li>
                ))}
             </ul>
          </section>
          
          {/* Safety / Report Footer */}
          <div className="flex justify-center border-t border-gray-100 pt-8">
              <button 
                onClick={() => handleActionRequest('report')}
                className="flex items-center gap-2 text-gray-400 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-all text-sm font-semibold"
              >
                 <Flag size={16} />
                 Report Issue with this Entry
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