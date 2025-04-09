
import React from 'react';

interface DroneIconProps {
  className?: string;
}

const DroneIcon = ({ className = "" }: DroneIconProps) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 9v-4" />
      <path d="M12 19v-4" />
      <path d="M9 12h-4" />
      <path d="M19 12h-4" />
      <circle cx="5" cy="5" r="1" />
      <circle cx="19" cy="5" r="1" />
      <circle cx="5" cy="19" r="1" />
      <circle cx="19" cy="19" r="1" />
    </svg>
  );
};

export default DroneIcon;
