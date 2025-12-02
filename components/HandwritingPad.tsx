
import React, { useRef, useEffect, useState } from 'react';
import { Check, X, Trash2 } from 'lucide-react';

interface HandwritingPadProps {
  onSave: (imageData: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  className?: string;
}

const HandwritingPad: React.FC<HandwritingPadProps> = ({ onSave, onCancel, isProcessing, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    // Resize canvas to match container
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Restore context settings after resize
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1e293b'; // Dark slate for yellow paper
          ctx.lineWidth = 2; // Slightly thinner for pen feel
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture pointer to handle drawing even if cursor leaves canvas bounds
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className={`flex flex-col h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Handwriting Mode</span>
        <div className="flex gap-2">
          <button 
            onClick={clearCanvas}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Clear Pad"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Drawing Area */}
      <div ref={containerRef} className="flex-1 relative bg-yellow-100 touch-none cursor-crosshair">
         
         {/* Notebook lines */}
         <div className="absolute inset-0 flex flex-col pt-8 pointer-events-none">
            {[...Array(20)].map((_, i) => (
               <div key={i} className="w-full h-[1px] bg-blue-300/30 mb-8"></div>
            ))}
         </div>
         
         <canvas 
           ref={canvasRef}
           onPointerDown={startDrawing}
           onPointerMove={draw}
           onPointerUp={stopDrawing}
           onPointerLeave={stopDrawing}
           className="block w-full h-full touch-none relative z-10"
         />
      </div>

      {/* Footer Actions */}
      <div className="flex border-t border-slate-700">
        <button 
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 border-r border-slate-700"
        >
          <X size={16} /> Cancel
        </button>
        <button 
          onClick={handleSave}
          disabled={isProcessing}
          className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 text-blue-200 hover:text-white transition-colors flex items-center justify-center gap-2 font-bold"
        >
          {isProcessing ? (
             <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
             <Check size={16} />
          )}
          {isProcessing ? "Reading..." : "Convert to Text"}
        </button>
      </div>
    </div>
  );
};

export default HandwritingPad;
