import React, { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 10, onComplete, className = '' }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    // Reset display when text changes
    setDisplayedText('');
    
    if (!text) return;

    let currentIndex = 0;
    
    const intervalId = setInterval(() => {
      // Ideally we would increment first or check length
      if (currentIndex < text.length) {
        currentIndex++;
        // Using slice guarantees we never "skip" a letter or mis-order them.
        // It forces the display to match exactly the first N characters of the source.
        setDisplayedText(text.slice(0, currentIndex));
      } else {
        clearInterval(intervalId);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed, onComplete]);

  // Use a min-height or preserve space to prevent layout shifts if needed, 
  // but for inline text, simple return is fine.
  return <span className={className}>{displayedText}</span>;
};
