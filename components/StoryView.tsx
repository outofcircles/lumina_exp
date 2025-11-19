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
    <div className="max-w-4xl mx-auto p-6 animate-fadeIn">
      <button 
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-gray-500 hover:text-ink transition-colors font-semibold"
      >
        <ArrowLeft size={20} />
        <span>Back to Collection</span>
      </button>

      <article className="bg-white rounded-3xl shadow-xl overflow-hidden border border-parchment-dark relative">
        {/* Header Image Area */}
        <div className="relative h-64 md:h-96 bg-gray-100 overflow-hidden">
          {loadingImages ? (
             <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 animate-pulse text-gray-300">
                <ImageIcon size={48} className="mb-4" />
                <p className="text-xs font-bold uppercase tracking-wider">Illustrating Scene...</p>
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
          
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/60 to-transparent p-8 z-20">
             <h1 className="text-3xl md:text-5xl font-serif font-bold text-white mb-2 drop-shadow-md">
                 <Typewriter text={content.title} speed={30} />
             </h1>
             <div className="flex items-center gap-2 text-white/90 text-sm md:text-base">
                <span className="bg-gold px-2 py-0.5 rounded text-ink font-bold">{profile.name}</span>
                <span>&bull;</span>
                <span>{profile.region}</span>
                <span>&bull;</span>
                <span className="italic">{profile.era}</span>
             </div>
          </div>
        </div>

        <div className="p-8 md:p-12">
          {/* Controls & Metadata */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-100 pb-6 gap-4">
             <div className="space-y-3">
                 <div className="flex flex-wrap gap-2">
                    {profile.values.map(v => (
                        <span key={v} className="px-3 py-1 bg-blue-50 text-ocean text-sm font-semibold rounded-full border border-blue-100">
                            {v}
                        </span>
                    ))}
                 </div>
                 <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Feather size={14} />
                    <span>Storyteller: <span className="font-semibold text-ink">{authorInfo.persona}</span> ({currentStyleName})</span>
                 </div>
             </div>
             {/* Only show audio if available. */}
             {story.generatedAudioUrl && <AudioPlayer base64Audio={story.generatedAudioUrl} />}
          </div>

          {/* Intro */}
          <div className="text-xl md:text-2xl font-serif text-gray-700 mb-8 italic leading-relaxed border-l-4 border-gold pl-6">
            <Typewriter text={content.introduction} speed={20} />
          </div>

          {/* Main Story */}
          <div className="story-content font-serif text-gray-800 mb-12 whitespace-pre-line">
            <Typewriter text={content.mainBody} speed={5} />
          </div>

          {/* Value Reflection */}
          <div className="bg-parchment rounded-2xl p-8 border border-gold/20 relative mb-12">
             <Quote className="absolute top-4 left-4 text-gold opacity-20" size={48} />
             <div className="relative z-10 text-center">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Wisdom for Today</h3>
                <p className="text-xl md:text-2xl font-serif text-ink italic">
                  "{content.valueReflection}"
                </p>
             </div>
          </div>

          {/* Geography / Map Section */}
          {story.geography && (
             <div className="bg-blue-50/50 rounded-2xl p-8 border border-blue-100 mb-12">
                <div className="flex items-center gap-2 mb-6">
                    <Globe className="text-ocean" size={24} />
                    <h3 className="text-xl font-bold text-ink font-serif">Where in the World?</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="w-full md:w-1/2">
                        <div className="aspect-square bg-white rounded-xl shadow-sm p-2 rotate-2 transform hover:rotate-0 transition-transform duration-500 border border-gray-200 relative overflow-hidden">
                            {loadingImages ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50 animate-pulse">
                                    <MapPin size={32} className="text-gray-300 mb-2" />
                                </div>
                            ) : (story.generatedMapUrl && !mapImgError) ? (
                                <img 
                                  src={story.generatedMapUrl} 
                                  alt={`Map of ${story.geography.countryName}`} 
                                  onError={() => setMapImgError(true)}
                                  className="w-full h-full object-cover rounded-lg animate-fadeIn"
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                                    <MapPin size={32} className="mb-2 opacity-50" />
                                    <span className="text-xs">Map unavailable</span>
                                </div>
                            )}
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">
                            {story.geography.countryName}
                        </p>
                    </div>
                    
                    <div className="w-full md:w-1/2 space-y-4">
                        <h4 className="font-bold text-ocean text-lg">Did you know?</h4>
                        <p className="text-gray-700 leading-relaxed text-lg">
                            <Typewriter text={story.geography.funFact} speed={20} />
                        </p>
                    </div>
                </div>
             </div>
          )}

          {/* Author Persona Section */}
          <div className="bg-ink text-parchment rounded-2xl p-8 border border-gray-800 relative overflow-hidden mb-12">
             <div className="absolute top-0 right-0 p-12 opacity-5">
                <Scroll size={120} />
             </div>
             
             <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <Feather className="text-gold" size={24} />
                   <h3 className="text-xl font-bold font-serif text-gold">About the Storyteller</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8">
                   <div className="flex-1">
                      <h4 className="text-2xl font-serif font-bold mb-1">{authorInfo.persona}</h4>
                      <p className="text-gray-400 text-sm mb-4">Inspired by {authorInfo.name} &bull; {authorInfo.era}</p>
                      <p className="text-gray-300 leading-relaxed italic">
                         "{authorInfo.description}"
                      </p>
                   </div>
                   
                   <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-gray-700 pt-4 md:pt-0 md:pl-8">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Major Works</h5>
                      <ul className="space-y-2">
                         {authorInfo.majorWorks.map((work, i) => (
                            <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                               <span className="w-1.5 h-1.5 bg-gold rounded-full"></span>
                               {work}
                            </li>
                         ))}
                      </ul>
                   </div>
                </div>
             </div>
          </div>
          
          {/* Safety / Report Footer */}
          <div className="flex justify-center border-t border-gray-100 pt-8">
              <button 
                onClick={() => setGateOpen(true)}
                className="flex items-center gap-2 text-gray-400 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-all text-sm font-semibold"
              >
                 <Flag size={16} />
                 Report Issue with this Story
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