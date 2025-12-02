
import React from 'react';
import { BriefcaseMedical, Wind, Bone } from 'lucide-react';

interface EquipmentToolbarProps {
  onOpenBag: (bagName: string) => void;
  disabled: boolean;
  vertical?: boolean;
}

const EquipmentToolbar: React.FC<EquipmentToolbarProps> = ({ onOpenBag, disabled, vertical = false }) => {
  const bags = [
    { 
      id: 'jump', 
      label: 'Jump Bag', 
      icon: BriefcaseMedical, 
      color: 'text-red-400', 
      bg: 'bg-red-900/20 border-red-800 hover:bg-red-900/40' 
    },
    { 
      id: 'airway', 
      label: 'Airway / O2', 
      icon: Wind, 
      color: 'text-blue-400', 
      bg: 'bg-blue-900/20 border-blue-800 hover:bg-blue-900/40' 
    },
    { 
      id: 'splint', 
      label: 'Splint / Trauma', 
      icon: Bone, 
      color: 'text-amber-400', 
      bg: 'bg-amber-900/20 border-amber-800 hover:bg-amber-900/40' 
    },
  ];

  return (
    <div className={vertical ? "flex flex-col gap-3" : "flex gap-3 mb-3 overflow-x-auto pb-1"}>
      {bags.map((bag) => (
        <button
          key={bag.id}
          onClick={() => onOpenBag(bag.id)}
          disabled={disabled}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
            vertical ? 'w-full' : 'flex-1 min-w-[140px]'
          } ${bag.bg} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`p-2 rounded-full bg-black/40 ${bag.color}`}>
            <bag.icon size={20} />
          </div>
          <div className="flex flex-col items-start">
            <span className={`text-sm font-bold ${bag.color}`}>{bag.label}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Equipment</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default EquipmentToolbar;
