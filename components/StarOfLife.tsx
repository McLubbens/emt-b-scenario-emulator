
import React from 'react';

const StarOfLife = ({ className, color = "currentColor" }: { className?: string, color?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* The Star Body - Standard six-barred cross */}
    <path 
      d="M42,5 L58,5 L58,32 L81.3,18.5 L89.3,32.4 L66,46 L89.3,59.6 L81.3,73.5 L58,60 L58,95 L42,95 L42,60 L18.7,73.5 L10.7,59.6 L34,46 L10.7,32.4 L18.7,18.5 L42,32 Z" 
      fill={color} 
      stroke="white" 
      strokeWidth="2"
      strokeLinejoin="round"
    />
    
    {/* EMT Text */}
    <text 
      x="50" 
      y="58" 
      fontSize="28" 
      fontWeight="900" 
      fill="#fbbf24" 
      textAnchor="middle" 
      dominantBaseline="middle"
      style={{ fontFamily: 'Arial, sans-serif', letterSpacing: '1px' }}
    >
      EMT
    </text>
  </svg>
);

export default StarOfLife;