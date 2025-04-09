
import React from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';

const AirspaceView = () => {
  const { drones } = useDroneSystem();
  
  return (
    <div className="p-4 border rounded-lg bg-gradient-to-b from-blue-50 to-blue-100 shadow-inner h-64 overflow-hidden relative">
      <h2 className="text-lg font-semibold mb-2">Airspace View</h2>
      
      {/* Airspace Layers */}
      <div className="absolute left-0 right-0 bottom-0 top-12 flex flex-col">
        <div className="flex-1 border-b border-dashed border-blue-200 relative">
          <span className="absolute -top-3 right-2 text-xs text-blue-500">Layer 5 (8m+)</span>
        </div>
        <div className="flex-1 border-b border-dashed border-blue-300 bg-airspace-layer5/10 relative">
          <span className="absolute -top-3 right-2 text-xs text-blue-500">Layer 4 (6-8m)</span>
        </div>
        <div className="flex-1 border-b border-dashed border-blue-300 bg-airspace-layer4/10 relative">
          <span className="absolute -top-3 right-2 text-xs text-blue-500">Layer 3 (4-6m)</span>
        </div>
        <div className="h-1/6 border-b border-dashed border-blue-300 bg-airspace-layer3/10 relative">
          <span className="absolute -top-3 right-2 text-xs text-blue-500">Layer 2 (2-4m)</span>
        </div>
        <div className="h-1/6 bg-airspace-layer2/10 relative">
          <span className="absolute -top-3 right-2 text-xs text-blue-500">Layer 1 (0-2m)</span>
        </div>
      </div>
      
      {/* Drone Representations */}
      <div className="absolute left-0 right-0 bottom-0 top-12">
        {drones.map(drone => {
          // Skip docked drones
          if (drone.operationPhase === 'docked') return null;
          
          // Calculate position in the view based on drone position
          // This is simplified and would need more complex mapping in a real application
          const heightPercentage = (drone.position.z / 10) * 100;
          const left = ((drone.position.x / 15) * 100);
          const top = 100 - heightPercentage;
          
          const droneColors = {
            idle: 'bg-drone-idle',
            active: 'bg-drone-active',
            warning: 'bg-drone-warning',
            emergency: 'bg-drone-emergency',
          };
          
          return (
            <div 
              key={drone.id}
              className={`absolute hexagon w-4 h-4 flex items-center justify-center text-white text-[10px] ${droneColors[drone.status]} z-10`}
              style={{ 
                left: `${Math.min(Math.max(left, 0), 98)}%`, 
                top: `${Math.min(Math.max(top, 0), 98)}%`
              }}
              title={`Drone ${drone.id} - ${drone.operationPhase} - Alt: ${drone.position.z}m`}
            >
              {drone.id}
            </div>
          );
        })}
      </div>
      
      <div className="absolute left-2 bottom-2 text-xs text-gray-500">
        Active drones: {drones.filter(d => d.operationPhase !== 'docked').length}
      </div>
    </div>
  );
};

export default AirspaceView;
