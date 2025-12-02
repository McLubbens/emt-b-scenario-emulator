
import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, FileText, ShieldAlert } from 'lucide-react';
import { DebriefReport, NREMT_CRITICAL_CRITERIA } from '../types';

interface DebriefModalProps {
  isOpen: boolean;
  report: DebriefReport | null;
  onClose: () => void;
  isLoading: boolean;
}

const DebriefModal: React.FC<DebriefModalProps> = ({ isOpen, report, onClose, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <h2 className="text-2xl font-bold text-slate-200">Evaluator is Reviewing...</h2>
            <p className="text-slate-400">Analyzing scene safety, assessment order, and critical interventions.</p>
          </div>
        ) : report ? (
          <>
            {/* Header */}
            <div className={`p-6 border-b ${report.passed ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'} flex justify-between items-start`}>
              <div>
                <h2 className={`text-3xl font-bold flex items-center gap-3 ${report.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {report.passed ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                  {report.passed ? 'PASSED' : 'FAILED'}
                </h2>
                <p className="text-slate-400 mt-1 text-sm uppercase tracking-wider font-mono">
                  Score: <span className="text-white font-bold">{report.score}/100</span>
                </p>
              </div>
              <div className="bg-slate-950/50 p-2 rounded border border-slate-800 text-xs text-slate-400 font-mono">
                NREMT SKILLS EXAM
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Critical Failures Section */}
              {report.criticalFailures.length > 0 && (
                <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
                  <h3 className="text-red-400 font-bold flex items-center gap-2 mb-3 uppercase tracking-wide text-sm">
                    <ShieldAlert size={16} /> Critical Criteria Violations
                  </h3>
                  <ul className="space-y-2">
                    {report.criticalFailures.map((fail, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-red-200 text-sm bg-red-900/20 p-2 rounded">
                        <XCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                        {fail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clinical Reasoning */}
              <div>
                <h3 className="text-slate-300 font-bold flex items-center gap-2 mb-2 uppercase tracking-wide text-sm">
                  <FileText size={16} /> Clinical Reasoning
                </h3>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-slate-300 leading-relaxed text-sm">
                  {report.clinicalReasoning}
                </div>
              </div>

              {/* Feedback Summary */}
              <div>
                <h3 className="text-slate-300 font-bold flex items-center gap-2 mb-2 uppercase tracking-wide text-sm">
                  <AlertTriangle size={16} /> Evaluator Feedback
                </h3>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-slate-300 leading-relaxed text-sm">
                  {report.feedbackSummary}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
              <button 
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
              >
                Close & Restart
              </button>
            </div>
          </>
        ) : (
           <div className="p-8 text-center text-red-400">Error generating report.</div>
        )}
      </div>
    </div>
  );
};

export default DebriefModal;
