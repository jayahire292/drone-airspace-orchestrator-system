
import React from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertTriangle, 
  Share2, 
  RotateCcw,
  AlertOctagon
} from 'lucide-react';

const ControlPanel = () => {
  const { selectedDrone, updateDroneStatus, executeEmergencyProtocol } = useDroneSystem();

  if (!selectedDrone) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Drone Control</h2>
        <p className="text-gray-500 text-center">Select a drone to control</p>
      </div>
    );
  }

  const handleTakeoff = () => {
    const targetPosition = {
      x: selectedDrone.position.x + (Math.random() * 10 - 5),
      y: selectedDrone.position.y + (Math.random() * 10 - 5),
      z: 0
    };
    
    updateDroneStatus(selectedDrone.id, 'active');
  };
  
  const handleEmergency = () => {
    executeEmergencyProtocol(selectedDrone.id);
  };
  
  const isFlying = selectedDrone.operationPhase !== 'docked';
  
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold mb-4">
        Drone Control - {selectedDrone.name}
      </h2>
      
      <div className="flex flex-col space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="default" 
            disabled={isFlying}
            className="flex gap-1 items-center"
            onClick={handleTakeoff}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Deploy Drone
          </Button>
          
          <Button 
            variant="secondary"
            disabled={!isFlying}
            className="flex gap-1 items-center"
          >
            <ArrowDownCircle className="h-4 w-4" />
            Return to Dock
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline"
            disabled={!isFlying}
            className="flex gap-1 items-center"
          >
            <Share2 className="h-4 w-4" />
            Update Path
          </Button>
          
          <Button 
            variant="outline"
            disabled={!isFlying}
            className="flex gap-1 items-center"
          >
            <RotateCcw className="h-4 w-4" />
            Hover in Place
          </Button>
        </div>
        
        <div className="pt-2">
          <Button 
            variant="destructive"
            className="w-full flex gap-1 items-center"
            onClick={handleEmergency}
          >
            <AlertOctagon className="h-4 w-4" />
            Emergency Protocol
          </Button>
        </div>
      </div>
      
      <div className="mt-4 p-2 bg-slate-100 rounded text-sm">
        <h3 className="font-semibold mb-1">Current Status:</h3>
        <div className="grid grid-cols-2 gap-y-1">
          <div>Operation:</div>
          <div className="font-medium">{selectedDrone.operationPhase}</div>
          <div>Battery:</div>
          <div className="font-medium">{Math.round(selectedDrone.battery)}%</div>
          <div>Layer:</div>
          <div className="font-medium">{selectedDrone.currentLayer}</div>
          <div>Quadrant:</div>
          <div className="font-medium">{selectedDrone.quadrant}</div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
