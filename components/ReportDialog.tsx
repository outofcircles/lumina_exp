
import React, { useState } from 'react';
import { X, Flag, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { mockReportIssue } from '../services/safety';

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contentTitle: string;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({ isOpen, onClose, contentTitle }) => {
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;

    setIsSubmitting(true);
    await mockReportIssue(contentTitle, reason, "User reported via UI");
    setIsSubmitting(false);
    setSubmitted(true);
    
    // Auto close after success
    setTimeout(() => {
      setSubmitted(false);
      setReason('');
      onClose();
    }, 2000);
  };

  const REASONS = [
    "Inappropriate Content",
    "Factual Error",
    "Scary or Intense",
    "Biased or Offensive",
    "Other"
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        
        {/* Header */}
        <div className="bg-red-50 p-4 flex justify-between items-center border-b border-red-100">
          <div className="flex items-center gap-2 text-red-800">
            <Flag size={20} />
            <h3 className="font-bold font-serif">Report Issue</h3>
          </div>
          <button onClick={onClose} className="text-red-800/50 hover:text-red-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-bold text-ink mb-2">Thank You</h4>
            <p className="text-gray-600">We've received your feedback and will review this content.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Help us make Lumina safer. Why are you reporting <span className="font-bold">"{contentTitle}"</span>?
            </p>

            <div className="space-y-3 mb-6">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 cursor-pointer transition-all group">
                  <input 
                    type="radio" 
                    name="reason" 
                    value={r} 
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300"
                  />
                  <span className="text-gray-700 font-medium group-hover:text-red-900">{r}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 mb-6">
              <AlertTriangle size={12} />
              <span>Flagged content is reviewed by our safety team.</span>
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={!reason || isSubmitting}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-all ${!reason || isSubmitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-lg hover:shadow-xl'}`}
              >
                {isSubmitting ? 'Sending...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
