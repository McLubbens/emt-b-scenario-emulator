import React from 'react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAction, disabled }) => {
  const actions = [
    { label: "Scene Safety / BSI", text: "I am checking scene safety and putting on my BSI." },
    { label: "General Impression", text: "What is my general impression of the patient?" },
    { label: "Check Pulse", text: "I am checking the radial pulse." },
    { label: "Lung Sounds", text: "I am listening to lung sounds." },
    { label: "SAMPLE History", text: "I am asking for SAMPLE history." },
    { label: "Vitals", text: "I am taking a full set of vitals." },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
      {actions.map((act) => (
        <button
          key={act.label}
          onClick={() => onAction(act.text)}
          disabled={disabled}
          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 text-xs py-2 px-3 rounded border border-slate-700 transition-colors text-left"
        >
          {act.label}
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
