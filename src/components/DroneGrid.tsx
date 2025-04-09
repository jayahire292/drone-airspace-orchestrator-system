
import React from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';
import DroneDock from './DroneDock';

const DroneGrid = () => {
  const { drones, selectDrone, selectedDrone } = useDroneSystem();
  
  return (
    <div className="p-4 border rounded-lg bg-slate-50 shadow-inner">
      <h2 className="text-lg font-semibold mb-4">Drone Dock Grid</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[...Array(16)].map((_, index) => {
          const droneId = index + 1;
          const drone = drones.find(d => d.id === droneId);
          return (
            <DroneDock 
              key={droneId} 
              drone={drone} 
              isSelected={selectedDrone?.id === droneId}
              onClick={() => selectDrone(droneId)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default DroneGrid;
