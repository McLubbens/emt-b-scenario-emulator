
import React from 'react';
import { Clock, Pause } from 'lucide-react';

interface TimerProps {
  timeLeft: number;
  isPaused?: boolean;
}

const Timer: React.FC<TimerProps> = ({ timeLeft, isPaused }) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft < 120; // 2 minutes warning

  return (
    <div className={`absolute top-4 right-4 z-30 flex items-center gap-2 px-4 py-2 rounded-lg border backdrop-blur-md shadow-lg transition-all duration-300 ${
      isPaused
        ? 'bg-amber-900/80 border-amber-500 text-amber-200'
        : isLow 
          ? 'bg-red-900/80 border-red-500 text-red-200 animate-pulse' 
          : 'bg-slate-900/80 border-slate-700 text-slate-300'
    }`}>
      {isPaused ? <Pause size={16} className="animate-pulse" /> : <Clock size={16} className={isLow ? 'text-red-400' : 'text-blue-400'} />}
      <span className={`font-mono text-xl font-bold tracking-widest ${
        isPaused ? 'text-amber-100' : isLow ? 'text-red-100' : 'text-white'
      }`}>
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>
      {isPaused && <span className="text-xs font-bold uppercase tracking-wider ml-1 hidden md:inline">Typing...</span>}
    </div>
  );
};

export default Timer;
