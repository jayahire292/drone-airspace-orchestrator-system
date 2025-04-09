
import React from 'react';
import { DroneData } from '@/types/drone';
import { Badge } from '@/components/ui/badge';
import { Drone, Battery, Signal } from 'lucide-react';

interface DroneDockProps {
  drone?: DroneData;
  isSelected: boolean;
  onClick: () => void;
}

const DroneDock: React.FC<DroneDockProps> = ({ drone, isSelected, onClick }) => {
  if (!drone) {
    return (
      <div 
        className="h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50"
        onClick={onClick}
      >
        <span className="text-gray-400">Empty Dock</span>
      </div>
    );
  }

  const statusColors = {
    idle: 'bg-drone-idle hover:bg-green-600',
    active: 'bg-drone-active hover:bg-blue-600',
    warning: 'bg-drone-warning hover:bg-yellow-600',
    emergency: 'bg-drone-emergency hover:bg-red-600',
  };

  const phaseLabels = {
    docked: 'Docked',
    takeoff: 'Takeoff',
    transit: 'In Transit',
    operation: 'Operating',
    returning: 'Returning',
    landing: 'Landing',
  };
  
  return (
    <div 
      className={`h-32 p-3 rounded-lg relative cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-md'
      } ${statusColors[drone.status]}`}
      onClick={onClick}
    >
      <div className="absolute top-0 left-0 p-1 text-white font-bold">
        {drone.id}
      </div>
      
      <div className="h-full flex flex-col justify-between text-white">
        <div className="flex justify-between items-start">
          <Drone className={`${drone.operationPhase !== 'docked' ? 'animate-fly' : ''}`} />
          <div className="flex flex-col items-end">
            <Battery className="h-4 w-4" />
            <span className="text-xs">{Math.round(drone.battery)}%</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold uppercase truncate">
              {drone.name}
            </span>
            <Signal className="h-3 w-3" />
          </div>
          <Badge variant="secondary" className="text-xs">
            {phaseLabels[drone.operationPhase]}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default DroneDock;
