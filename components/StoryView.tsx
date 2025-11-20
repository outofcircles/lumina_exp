import React, { useState } from 'react';
import { Story, Profile, Language, Category } from '../types';
import { AUTHOR_STYLES, HINDI_AUTHOR_STYLES } from '../constants';
import { ArrowLeft, Quote, Globe, MapPin, Feather, Scroll, Flag, Image as ImageIcon } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { ReportDialog } from './ReportDialog';
import { Typewriter } from './Typewriter';
import { FallbackIllustration } from './FallbackIllustration';
import { ParentalGate } from './ParentalGate';

interface StoryViewProps {
  story: Story;
  profile: Profile;
  category: Category;
  onBack: () => void;
  displayLanguage: Language;
  loadingImages?: boolean;
}

export const StoryView: React.FC<StoryViewProps> = ({ story, profile, category, onBack, displayLanguage, loadingImages }) => {
  const [reportOpen, setReportOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [mapImgError, setMapImgError] = useState(false);

  // Select content based on language
  const content = displayLanguage === Language.HINDI ? story.hindi : story.english;
  const currentStyleName = displayLanguage === Language.HINDI ? story.hindiStyle : story.englishStyle;
  
  // Find Author Info
  const authorList = displayLanguage === Language.HINDI ? HINDI_AUTHOR_STYLES : AUTHOR_STYLES;
  const authorInfo = authorList.find(a => a.name === currentStyleName) || authorList[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <button 
        onClick={onBack}
        className="group mb-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-ink transition-colors"
      >
        <div className="p-2 rounded-full bg-white border border-gray-200 group-hover:border-gray-300 transition-colors">
            <ArrowLeft size={16} />
        </div>
        <span>Back to Collection</span>
      </button>

      <article className="bg-white rounded-[2rem] shadow-2xl shadow-gray-200/50 overflow-hidden border border-parchment-dark relative">
        {/* Header Image Area */}
        <div className="relative h-[40vh] min-h-[300px] md:h-[500px] bg-gray-100 overflow-hidden">
          {loadingImages ? (
             <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 animate-pulse text-gray-400">
                <ImageIcon size={48} className="mb-4 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest">Illustrating Scene...</p>
             </div>
          ) : (story.generatedImageUrl && !imgError) ? (
             <img 
               src={story.generatedImageUrl} 
               alt={story.illustrationPrompt} 
               onError={() => setImgError(true)}
               className="w-full h-full object-cover animate-fadeIn"
             />
          ) : (
            <FallbackIllustration category={category} />
          )}
          
          {/* Hero Gradient Overlay */}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 sm:p-10 z-20">
             <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white mb-3 drop-shadow-lg leading-[1.1] tracking-tight">
                 <Typewriter text={content.title} speed={30} />
             </h1>
             <div className="flex flex-wrap items-center gap-3 text-white/90 text-sm sm:text-base font-medium">
                <span className="bg-gold text-ink px-3 py-1 rounded-full font-bold shadow-sm">{profile.name}</span>
                <span className="opacity-60 hidden sm:inline">&bull;</span>
                <span>{profile.region}</span>
                <span className="opacity-60 hidden sm:inline">&bull;</span>
                <span className="italic opacity-90">{profile.era}</span>
             </div>
          </div>
        </div>

        <div className="p-6 sm:p-10 md:p-14 max-w-4xl mx-auto">
          {/* Controls & Metadata */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-gray-100 pb-8 gap-6">
             <div className="space-y-4">
                 <div className="flex flex-wrap gap-2">
                    {profile.values.map(v => (
                        <span key={v} className="px-3 py-1 bg-blue-50 text-ocean text-xs sm:text-sm font-semibold rounded-full border border-blue-100 tracking-wide">
                            {v}
                        </span>
                    ))}
                 </div>
                 <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <Feather size={16} className="text-gold" />
                    <span>Storyteller: <span className="text-ink font-bold">{authorInfo.persona}</span> <span className="opacity-60">({currentStyleName})</span></span>
                 </div>
             </div>
             {/* Only show audio if available. */}
             {story.generatedAudioUrl && <AudioPlayer base64Audio={story.generatedAudioUrl} />}
          </div>

          {/* Intro */}
          <div className="text-xl sm:text-2xl font-serif text-gray-700 mb-10 italic leading-relaxed border-l-4 border-gold pl-6 py-2">
            <Typewriter text={content.introduction} speed={20} />
          </div>

          {/* Main Story */}
          <div className="story-content font-serif text-lg sm:text-xl text-gray-800 mb-14 whitespace-pre-line leading-[1.8] tracking-wide">
            <Typewriter text={content.mainBody} speed={5} />
          </div>

          {/* Value Reflection */}
          <div className="bg-parchment rounded-2xl p-8 sm:p-10 border border-gold/20 relative mb-14 shadow-sm">
             <Quote className="absolute top-6 left-6 text-gold opacity-20" size={64} />
             <div className="relative z-10 text-center max-w-2xl mx-auto">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-6">Wisdom for Today</h3>
                <p className="text-2xl sm:text-3xl font-serif text-ink italic leading-snug">
                  "{content.valueReflection}"
                </p>
             </div>
          </div>

          {/* Geography / Map Section */}
          {story.geography && (
             <div className="bg-blue-50/50 rounded-3xl p-8 sm:p-10 border border-blue-100 mb-14">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-white rounded-full shadow-sm text-ocean">
                        <Globe size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-ink font-serif tracking-tight">Where in the World?</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-10 items-center">
                    <div className="w-full md:w-1/2">
                        <div className="aspect-square bg-white rounded-2xl shadow-md p-3 rotate-1 transform hover:rotate-0 transition-transform duration-500 border border-gray-100 relative overflow-hidden">
                            {loadingImages ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50 animate-pulse rounded-xl">
                                    <MapPin size={32} className="text-gray-300 mb-2" />
                                </div>
                            ) : (story.generatedMapUrl && !mapImgError) ? (
                                <img 
                                  src={story.generatedMapUrl} 
                                  alt={`Map of ${story.geography.countryName}`} 
                                  onError={() => setMapImgError(true)}
                                  className="w-full h-full object-cover rounded-xl animate-fadeIn"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-50 rounded-xl flex flex-col items-center justify-center text-gray-400 p-4 text-center border border-dashed border-gray-200">
                                    <MapPin size={32} className="mb-2 opacity-50" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Map unavailable</span>
                                </div>
                            )}
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-4 font-bold uppercase tracking-[0.15em]">
                            {story.geography.countryName}
                        </p>
                    </div>
                    
                    <div className="w-full md:w-1/2 space-y-4">
                        <h4 className="font-bold text-ocean text-lg mb-2">Did you know?</h4>
                        <p className="text-gray-700 leading-relaxed text-lg">
                            <Typewriter text={story.geography.funFact} speed={20} />
                        </p>
                    </div>
                </div>
             </div>
          )}

          {/* Author Persona Section */}
          <div className="bg-ink text-parchment rounded-3xl p-8 sm:p-10 border border-gray-800 relative overflow-hidden mb-10">
             <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 pointer-events-none">
                <Scroll size={180} />
             </div>
             
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                   <Feather className="text-gold" size={24} />
                   <h3 className="text-xl font-bold font-serif text-gold tracking-wide">About the Storyteller</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-10">
                   <div className="flex-1 space-y-4">
                      <div>
                          <h4 className="text-3xl font-serif font-bold mb-1 leading-none">{authorInfo.persona}</h4>
                          <p className="text-gray-400 text-sm font-medium tracking-wide">Inspired by {authorInfo.name} &bull; {authorInfo.era}</p>
                      </div>
                      <p className="text-gray-300 leading-relaxed italic text-lg opacity-90">
                         "{authorInfo.description}"
                      </p>
                   </div>
                   
                   <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-gray-700 pt-6 md:pt-0 md:pl-10">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-[0.15em] mb-4">Major Works</h5>
                      <ul className="space-y-3">
                         {authorInfo.majorWorks.map((work, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-center gap-3">
                               <span className="w-1.5 h-1.5 bg-gold rounded-full shrink-0"></span>
                               <span className="font-medium">{work}</span>
                            </li>
                         ))}
                      </ul>
                   </div>
                </div>
             </div>
          </div>
          
          {/* Safety / Report Footer */}
          <div className="flex justify-center border-t border-gray-100 pt-10">
              <button 
                onClick={() => setGateOpen(true)}
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
        onSuccess={() => setReportOpen(true)} 
        actionName="submit a report"
      />

      <ReportDialog 
        isOpen={reportOpen} 
        onClose={() => setReportOpen(false)} 
        contentTitle={content.title} 
      />
    </div>
  );
};
