import React, { useEffect, useState, useRef } from 'react';
import { Volume2, PauseCircle, PlayCircle } from 'lucide-react';

interface AudioPlayerProps {
  base64Audio: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ base64Audio }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (sourceRef.current) {
        sourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Reset if audio source changes
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
    pauseTimeRef.current = 0;
    startTimeRef.current = 0;
    audioBufferRef.current = null;

    const initAudio = async () => {
        try {
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // The instructions use sampleRate 24000 for TTS
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioContextRef.current = ctx;

            // Decode
            const dataInt16 = new Int16Array(bytes.buffer);
            // Mono channel usually from TTS unless configured otherwise
            const numChannels = 1; 
            const frameCount = dataInt16.length / numChannels;
            const buffer = ctx.createBuffer(numChannels, frameCount, 24000);

            for (let channel = 0; channel < numChannels; channel++) {
                const channelData = buffer.getChannelData(channel);
                for (let i = 0; i < frameCount; i++) {
                    // Convert Int16 to Float32
                    channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
                }
            }
            audioBufferRef.current = buffer;
        } catch (e) {
            console.error("Error preparing audio", e);
        }
    };

    if (base64Audio) {
        initAudio();
    }

  }, [base64Audio]);

  const togglePlay = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    if (isPlaying) {
      // Pause
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      pauseTimeRef.current += audioContextRef.current.currentTime - startTimeRef.current;
      setIsPlaying(false);
    } else {
      // Play
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);
      
      // If completed, reset
      if (pauseTimeRef.current >= audioBufferRef.current.duration) {
          pauseTimeRef.current = 0;
      }

      source.start(0, pauseTimeRef.current);
      startTimeRef.current = audioContextRef.current.currentTime;
      sourceRef.current = source;
      
      source.onended = () => {
        // Simple check: if it stopped naturally (not by user), reset state
        // Note: this fires on .stop() too, so we might need better logic for "finished" vs "paused"
        // For simplicity, we just let the UI toggle handle the visual state mostly
      };
      
      setIsPlaying(true);
    }
  };

  return (
    <button 
      onClick={togglePlay}
      className="flex items-center gap-2 bg-ink text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors shadow-md"
    >
      {isPlaying ? <PauseCircle size={20} /> : <PlayCircle size={20} />}
      <span className="text-sm font-semibold">Listen</span>
    </button>
  );
};