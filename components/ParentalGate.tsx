import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Lock } from 'lucide-react';

interface ParentalGateProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionName: string; // e.g., "access external links"
}

export const ParentalGate: React.FC<ParentalGateProps> = ({ isOpen, onClose, onSuccess, actionName }) => {
  const [question, setQuestion] = useState({ a: 0, b: 0 });
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Simple arithmetic challenge acceptable for basic COPPA compliance (neutral age gate)
      // For higher security, this would require credit card or ID, but for a free edu app,
      // a cognitive challenge helps prevent accidental clicks by very young children.
      setQuestion({
        a: Math.floor(Math.random() * 10) + 1,
        b: Math.floor(Math.random() * 10) + 1
      });
      setAnswer('');
      setError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(answer) === question.a + question.b) {
      onSuccess();
      onClose();
    } else {
      setError(true);
      setAnswer('');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-gold">
        <div className="bg-gold/10 p-4 flex justify-between items-center border-b border-gold/20">
          <div className="flex items-center gap-2 text-ink">
            <ShieldCheck size={20} className="text-gold" />
            <h3 className="font-bold font-serif">Parental Gate</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-ink">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-gray-500" />
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            To {actionName}, please verify you are an adult by solving this:
          </p>
          
          <div className="text-2xl font-bold font-serif text-ink mb-6">
            {question.a} + {question.b} = ?
          </div>

          <input 
            type="number" 
            value={answer}
            onChange={(e) => { setAnswer(e.target.value); setError(false); }}
            className={`w-24 text-center text-xl font-bold p-2 border-b-2 focus:outline-none mb-2 ${error ? 'border-red-500 text-red-600' : 'border-gray-300 focus:border-gold'}`}
            autoFocus
          />
          
          {error && <p className="text-xs text-red-500 font-bold mb-4">Incorrect, please try again.</p>}

          <button 
            type="submit"
            className="w-full bg-ink text-white font-bold py-3 rounded-xl mt-4 hover:bg-gray-800 transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
};