
import React from 'react';
import { X, ClipboardList, CheckSquare } from 'lucide-react';

interface ReportChecklistProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_ITEMS = [
  "Unit identification and level of provider",
  "Estimated time of arrival (ETA)",
  "Patient’s age and sex",
  "Chief complaint",
  "Brief, pertinent history of present illness (HPI)",
  "Major past illnesses",
  "Mental Status (AVPU/GCS)",
  "Baseline vital signs",
  "Pertinent findings of the physical exam",
  "Emergency medical care given",
  "Request further orders (if applicable)"
];

const ReportChecklist: React.FC<ReportChecklistProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-end p-4 pointer-events-none">
      <div className="bg-slate-900 border border-blue-500/50 w-full max-w-xs rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-right-5">
        
        {/* Header */}
        <div className="bg-blue-900/20 p-3 border-b border-blue-800/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <ClipboardList size={18} className="text-blue-400" />
             <h3 className="font-bold text-slate-200 text-sm">Radio Report Checklist</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <ul className="space-y-3">
            {REPORT_ITEMS.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                <div className="mt-0.5 min-w-[16px]">
                  <CheckSquare size={16} className="text-blue-500/50" />
                </div>
                <span className="leading-tight">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="p-2 bg-blue-900/10 text-[10px] text-center text-blue-300/70">
          Be concise. Paint a picture of the patient.
        </div>
      </div>
    </div>
  );
};

export default ReportChecklist;
