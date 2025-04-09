
import React, { useState } from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertTriangle, 
  Share2, 
  RotateCcw,
  AlertOctagon,
  MapPin,
  Compass
} from 'lucide-react';
import { Position } from '@/types/drone';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ControlPanel = () => {
  const { selectedDrone, planFlightPath, executeEmergencyProtocol } = useDroneSystem();
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  if (!selectedDrone) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Drone Control</h2>
        <p className="text-gray-500 text-center">Select a drone to control</p>
      </div>
    );
  }

  const handleTakeoff = () => {
    // Generate random target outside grid
    const randomDirection = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 5; // 10-15m from grid
    
    const targetPosition: Position = {
      x: Math.cos(randomDirection) * distance,
      y: Math.sin(randomDirection) * distance,
      z: 0
    };
    
    planFlightPath(selectedDrone.id, targetPosition);
    setOperationMessage(`Drone ${selectedDrone.id} deployed to target (${targetPosition.x.toFixed(1)}, ${targetPosition.y.toFixed(1)})`);
  };
  
  const handleReturnToDock = () => {
    // Calculate dock position based on drone ID
    const row = Math.ceil(selectedDrone.id / 4);
    const col = ((selectedDrone.id - 1) % 4) + 1;
    
    const dockPosition: Position = {
      x: col * 3 - 1.5,
      y: row * 3 - 1.5,
      z: 0
    };
    
    planFlightPath(selectedDrone.id, dockPosition);
    setOperationMessage(`Drone ${selectedDrone.id} returning to dock`);
  };
  
  const handleEmergency = () => {
    executeEmergencyProtocol(selectedDrone.id);
    setOperationMessage(`EMERGENCY protocol activated for Drone ${selectedDrone.id}`);
  };
  
  const handleSelectTarget = (quadrant: string) => {
    // Generate target position in selected quadrant
    let targetX, targetY;
    
    switch(quadrant) {
      case 'NE':
        targetX = 10 + Math.random() * 5;
        targetY = -10 - Math.random() * 5;
        break;
      case 'SE':
        targetX = 10 + Math.random() * 5;
        targetY = 10 + Math.random() * 5;
        break;
      case 'SW':
        targetX = -10 - Math.random() * 5;
        targetY = 10 + Math.random() * 5;
        break;
      case 'NW':
      default:
        targetX = -10 - Math.random() * 5;
        targetY = -10 - Math.random() * 5;
        break;
    }
    
    const targetPosition: Position = {
      x: targetX,
      y: targetY,
      z: 0
    };
    
    planFlightPath(selectedDrone.id, targetPosition);
    setShowTargetSelector(false);
    setOperationMessage(`Drone ${selectedDrone.id} deployed to ${quadrant} target (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);
  };
  
  const handleHover = () => {
    // Modify flight path to hover in place
    const currentPosition = selectedDrone.position;
    
    // Create a new flight path that first hovers, then returns to dock
    const row = Math.ceil(selectedDrone.id / 4);
    const col = ((selectedDrone.id - 1) % 4) + 1;
    
    const dockPosition: Position = {
      x: col * 3 - 1.5,
      y: row * 3 - 1.5,
      z: 0
    };
    
    const hoverPath = [
      // First hover at current position for a bit
      { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z },
      
      // Then return to transition layer
      { x: currentPosition.x, y: currentPosition.y, z: 3 },
      
      // Then to dock position at transition layer
      { x: dockPosition.x, y: dockPosition.y, z: 3 },
      
      // Finally descent to dock
      dockPosition
    ];
    
    // Update drone's flight path
    planFlightPath(selectedDrone.id, dockPosition);
    setOperationMessage(`Drone ${selectedDrone.id} will hover and then return to dock`);
  };
  
  const isFlying = selectedDrone.operationPhase !== 'docked';
  const isEmergency = selectedDrone.status === 'emergency';
  
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold mb-4">
        Drone Control - {selectedDrone.name}
      </h2>
      
      {operationMessage && (
        <Alert 
          className="mb-4 bg-blue-50 text-sm" 
          variant="default"
        >
          <AlertDescription>
            {operationMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {showTargetSelector ? (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Select Target Direction:</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="flex gap-1 items-center"
              onClick={() => handleSelectTarget('NW')}
            >
              <MapPin className="h-4 w-4" />
              North-West
            </Button>
            <Button 
              variant="outline" 
              className="flex gap-1 items-center"
              onClick={() => handleSelectTarget('NE')}
            >
              <MapPin className="h-4 w-4" />
              North-East
            </Button>
            <Button 
              variant="outline" 
              className="flex gap-1 items-center"
              onClick={() => handleSelectTarget('SW')}
            >
              <MapPin className="h-4 w-4" />
              South-West
            </Button>
            <Button 
              variant="outline" 
              className="flex gap-1 items-center"
              onClick={() => handleSelectTarget('SE')}
            >
              <MapPin className="h-4 w-4" />
              South-East
            </Button>
          </div>
          <Button 
            variant="ghost" 
            className="w-full mt-2 text-xs"
            onClick={() => setShowTargetSelector(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="default" 
              disabled={isFlying || isEmergency}
              className="flex gap-1 items-center"
              onClick={() => setShowTargetSelector(true)}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Deploy Drone
            </Button>
            
            <Button 
              variant="secondary"
              disabled={!isFlying || isEmergency}
              className="flex gap-1 items-center"
              onClick={handleReturnToDock}
            >
              <ArrowDownCircle className="h-4 w-4" />
              Return to Dock
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline"
              disabled={!isFlying || isEmergency}
              className="flex gap-1 items-center"
              onClick={() => setShowTargetSelector(true)}
            >
              <Share2 className="h-4 w-4" />
              Update Path
            </Button>
            
            <Button 
              variant="outline"
              disabled={!isFlying || isEmergency}
              className="flex gap-1 items-center"
              onClick={handleHover}
            >
              <RotateCcw className="h-4 w-4" />
              Hover in Place
            </Button>
          </div>
          
          <div className="pt-2">
            <Button 
              variant="destructive"
              disabled={isEmergency}
              className="w-full flex gap-1 items-center"
              onClick={handleEmergency}
            >
              <AlertOctagon className="h-4 w-4" />
              Emergency Protocol
            </Button>
          </div>
        </div>
      )}
      
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
          {selectedDrone.position && (
            <>
              <div>Position:</div>
              <div className="font-medium">
                ({selectedDrone.position.x.toFixed(1)}, 
                {selectedDrone.position.y.toFixed(1)}, 
                {selectedDrone.position.z.toFixed(1)})
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
