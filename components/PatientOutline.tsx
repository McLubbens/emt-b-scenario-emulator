import React from 'react';

interface PatientOutlineProps {
  className?: string;
}

const PatientOutline: React.FC<PatientOutlineProps> = ({ className }) => {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 500"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="M100,10 C115,10 125,20 125,35 C125,45 120,50 115,55 C125,60 145,70 160,90 C170,105 175,150 170,190 C165,230 160,240 155,245 C150,250 145,245 145,235 C145,235 140,300 135,350 C130,400 125,450 120,480 C115,490 105,490 105,480 C105,480 105,380 100,350 C95,380 95,480 95,480 C95,490 85,490 80,480 C75,450 70,400 65,350 C60,300 55,235 55,235 C55,245 50,250 45,245 C40,240 35,230 30,190 C25,150 30,105 40,90 C55,70 75,60 85,55 C80,50 75,45 75,35 C75,20 85,10 100,10 Z"
      />
    </svg>
  );
};

export default PatientOutline;
