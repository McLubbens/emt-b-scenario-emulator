import React from 'react';
import { X, Package } from 'lucide-react';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: string[];
  onSelectItem: (item: string) => void;
}

const EquipmentModal: React.FC<EquipmentModalProps> = ({ isOpen, onClose, title, items, onSelectItem }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
             <div className="bg-blue-600 p-2 rounded-lg">
               <Package size={20} className="text-white" />
             </div>
             <h2 className="text-xl font-bold text-slate-100">{title} Contents</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {items.map((item) => (
              <button
                key={item}
                onClick={() => onSelectItem(item)}
                className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-blue-900/30 border border-slate-700 hover:border-blue-500 rounded-xl transition-all text-center group h-24"
              >
                <span className="font-semibold text-slate-300 group-hover:text-blue-400 text-sm">{item}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center text-xs text-slate-500">
           Select an item to retrieve it.
        </div>
      </div>
    </div>
  );
};

export default EquipmentModal;