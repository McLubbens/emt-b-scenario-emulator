import React from 'react';
import { X, Lightbulb } from 'lucide-react';

interface HintModalProps {
  isOpen: boolean;
  onClose: () => void;
  hint: string | null;
  isLoading: boolean;
}

const HintModal: React.FC<HintModalProps> = ({ isOpen, onClose, hint, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden relative transform transition-all">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-amber-900/20 rounded-full flex items-center justify-center shadow-inner border border-amber-500/20">
             <Lightbulb size={32} className="text-amber-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-100">Proctor Hint</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Assessment Assistance
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex flex-col items-center space-y-4 py-6 w-full">
               <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-slate-400 text-sm animate-pulse">Consulting NREMT protocols...</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 w-full shadow-inner">
              <p className="text-amber-100 text-lg leading-relaxed font-medium italic">
                "{hint}"
              </p>
            </div>
          )}
          
          <div className="text-xs text-slate-500 max-w-[280px]">
            Review your assessment pathway. Consider your ABCs and interventions.
          </div>
        </div>
        
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-center">
           <button 
             onClick={onClose}
             className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2 rounded-lg font-bold transition-colors text-sm uppercase tracking-wide border border-slate-700"
           >
             Return to Scenario
           </button>
        </div>
      </div>
    </div>
  );
};

export default HintModal;