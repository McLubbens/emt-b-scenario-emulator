
import React from 'react';
import { Activity, Heart, Wind, Droplets, Thermometer, Eye } from 'lucide-react';
import { Vitals } from '../types';

interface VitalMonitorProps {
  vitals: Vitals;
  className?: string;
}

const VitalBox = ({ label, value, unit, color, icon: Icon }: any) => (
  <div className="bg-black border border-gray-800 p-3 rounded flex flex-col justify-between relative overflow-hidden">
    <div className={`text-xs font-bold ${color} uppercase flex items-center gap-1`}>
      <Icon size={12} /> {label}
    </div>
    <div className={`text-3xl font-mono-display font-bold ${color} tabular-nums leading-none mt-1`}>
      {value !== undefined && value !== null ? value : '--'}
    </div>
    {unit && <div className="text-[10px] text-gray-500 absolute bottom-1 right-2">{unit}</div>}
  </div>
);

const VitalMonitor: React.FC<VitalMonitorProps> = ({ vitals, className }) => {
  
  // Handle composite displays safely
  const bpDisplay = (vitals.bpSystolic && vitals.bpDiastolic) 
    ? `${vitals.bpSystolic}/${vitals.bpDiastolic}` 
    : undefined;

  return (
    <div className={`bg-gray-900 border-4 border-gray-800 rounded-xl p-4 shadow-2xl ${className}`}>
      <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
        <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <Activity className="text-green-500" size={16} /> LifePak Monitor
        </h3>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <div className="text-xs text-green-500">LIVE</div>
        </div>
      </div>

      {/* ECG Strip Simulation */}
      <div className="h-24 bg-black mb-4 rounded border border-gray-800 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 grid grid-cols-[repeat(40,1fr)] grid-rows-[repeat(10,1fr)] opacity-20 pointer-events-none">
           {/* Grid lines for realism */}
           {[...Array(40)].map((_, i) => <div key={`v-${i}`} className="border-r border-green-900 h-full absolute" style={{left: `${i * 2.5}%`}}></div>)}
           {[...Array(10)].map((_, i) => <div key={`h-${i}`} className="border-b border-green-900 w-full absolute" style={{top: `${i * 10}%`}}></div>)}
        </div>
        
        {/* Simple SVG Waveform representation - only show line if HR is present */}
        {vitals.hr ? (
          <svg className="w-full h-full ecg-line" viewBox="0 0 500 100" preserveAspectRatio="none">
            <polyline 
              points="0,50 20,50 30,20 40,80 50,50 70,50 80,45 90,50 120,50 140,50 150,20 160,80 170,50 190,50 200,45 210,50 240,50 260,50 270,20 280,80 290,50 310,50 320,45 330,50 360,50 380,50 390,20 400,80 410,50 430,50 440,45 450,50 500,50" 
              fill="none" 
              stroke="#22c55e" 
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <div className="w-full h-[1px] bg-green-900/50"></div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <VitalBox label="HR" value={vitals.hr} unit="BPM" color="text-green-500" icon={Heart} />
        <VitalBox label="NIBP" value={bpDisplay} unit="mmHg" color="text-red-500" icon={Activity} />
        <VitalBox label="SpO2" value={vitals.spo2} unit="%" color="text-cyan-400" icon={Droplets} />
        <VitalBox label="RR" value={vitals.rr} unit="RPM" color="text-yellow-400" icon={Wind} />
        <VitalBox label="EtCO2" value={vitals.etco2} unit="mmHg" color="text-purple-400" icon={Wind} />
        <div className="bg-black border border-gray-800 p-2 rounded flex flex-col justify-center gap-1">
          <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1"><Thermometer size={10} /> Skin</div>
          <div className="text-xs text-white leading-tight">{vitals.skin || '--'}</div>
          
          <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1 mt-1"><Eye size={10} /> Pupils</div>
          <div className="text-xs text-white leading-tight">{vitals.pupils || '--'}</div>
        </div>
      </div>
    </div>
  );
};

export default VitalMonitor;
