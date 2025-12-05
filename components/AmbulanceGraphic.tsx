
import React from 'react';

const AmbulanceGraphic = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 120" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Body */}
    <path d="M10,40 L10,100 L190,100 L190,40 L160,40 L140,15 L40,15 L40,40 Z" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
    
    {/* Red Stripe */}
    <rect x="10" y="55" width="180" height="15" fill="#dc2626" />
    
    {/* Windows */}
    <path d="M142,18 L158,38 L142,38 Z" fill="#94a3b8" stroke="#1e293b" strokeWidth="1" />
    <rect x="50" y="20" width="30" height="15" fill="#94a3b8" stroke="#1e293b" strokeWidth="1" rx="2" />
    <rect x="90" y="20" width="30" height="15" fill="#94a3b8" stroke="#1e293b" strokeWidth="1" rx="2" />

    {/* Wheels */}
    <circle cx="50" cy="100" r="14" fill="#1e293b" />
    <circle cx="50" cy="100" r="6" fill="#64748b" />
    <circle cx="150" cy="100" r="14" fill="#1e293b" />
    <circle cx="150" cy="100" r="6" fill="#64748b" />

    {/* Lights */}
    <rect x="60" y="10" width="20" height="5" fill="#ef4444" className="animate-pulse" /> {/* Red Light */}
    <rect x="120" y="10" width="20" height="5" fill="#3b82f6" className="animate-pulse" style={{animationDelay: '0.5s'}}/> {/* Blue Light */}

    {/* Text */}
    <text x="100" y="66" fontSize="8" fontWeight="bold" fill="white" textAnchor="middle" letterSpacing="2">AMBULANCE</text>
    <text x="30" y="32" fontSize="12" fontWeight="bold" fill="#0f172a" opacity="0.5">*</text>
  </svg>
);

export default AmbulanceGraphic;
