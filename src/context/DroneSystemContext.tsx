
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DroneData, TrafficAlert, SystemMetrics, Position, DroneStatus } from '@/types/drone';
import { 
  generateMockDrones, 
  generateMockAlerts, 
  calculateSystemMetrics, 
  calculateFlightPath,
  detectPathConflicts,
  resolvePathConflicts
} from '@/utils/mockData';

interface DroneSystemContextType {
  drones: DroneData[];
  alerts: TrafficAlert[];
  metrics: SystemMetrics;
  selectedDrone: DroneData | null;
  selectDrone: (droneId: number | null) => void;
  updateDroneStatus: (droneId: number, status: DroneData['status']) => void;
  planFlightPath: (droneId: number, targetPosition: Position) => void;
  executeEmergencyProtocol: (droneId: number) => void;
  resolveAlert: (alertId: string) => void;
}

const DroneSystemContext = createContext<DroneSystemContextType | undefined>(undefined);

export const DroneSystemProvider = ({ children }: { children: ReactNode }) => {
  const [drones, setDrones] = useState<DroneData[]>([]);
  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    operationalThroughput: 0,
    averageWaitTime: 0,
    pathEfficiency: 0,
    collisionAvoidanceEvents: 0,
    systemUtilization: 0,
  });
  const [selectedDrone, setSelectedDrone] = useState<DroneData | null>(null);

  // Initialize the system with mock data
  useEffect(() => {
    const mockDrones = generateMockDrones();
    setDrones(mockDrones);
    
    const mockAlerts = generateMockAlerts();
    setAlerts(mockAlerts);
    
    const initialMetrics = calculateSystemMetrics(mockDrones, mockAlerts);
    setMetrics(initialMetrics);

    // Simulate real-time updates
    const interval = setInterval(() => {
      setDrones(prev => {
        return prev.map(drone => {
          // Simulate drone movement and battery drainage
          const updatedDrone = { ...drone };
          
          if (drone.operationPhase !== 'docked') {
            updatedDrone.battery = Math.max(0, drone.battery - 0.1);
            
            // Simple movement simulation
            if (drone.flightPath && drone.flightPath.length > 0) {
              const nextPosition = drone.flightPath[0];
              updatedDrone.position = {
                x: drone.position.x + (nextPosition.x - drone.position.x) * 0.1,
                y: drone.position.y + (nextPosition.y - drone.position.y) * 0.1,
                z: drone.position.z + (nextPosition.z - drone.position.z) * 0.1,
              };
              
              // Update current layer based on altitude
              if (updatedDrone.position.z <= 2) updatedDrone.currentLayer = 1;
              else if (updatedDrone.position.z <= 4) updatedDrone.currentLayer = 2;
              else if (updatedDrone.position.z <= 6) updatedDrone.currentLayer = 3;
              else if (updatedDrone.position.z <= 8) updatedDrone.currentLayer = 4;
              else updatedDrone.currentLayer = 5;
              
              // If close enough to next waypoint, remove it
              if (
                Math.abs(updatedDrone.position.x - nextPosition.x) < 0.1 &&
                Math.abs(updatedDrone.position.y - nextPosition.y) < 0.1 &&
                Math.abs(updatedDrone.position.z - nextPosition.z) < 0.1
              ) {
                updatedDrone.flightPath = drone.flightPath.slice(1);
                
                // Update operation phase based on waypoint transitions
                if (updatedDrone.flightPath.length === 0) {
                  // Flight complete
                  updatedDrone.operationPhase = 'docked';
                  updatedDrone.status = 'idle';
                } else if (updatedDrone.position.z === 0 && updatedDrone.flightPath[0].z > 0) {
                  // Just starting to take off
                  updatedDrone.operationPhase = 'takeoff';
                } else if (updatedDrone.flightPath[0].z === 0) {
                  // About to land
                  updatedDrone.operationPhase = 'landing';
                } else if (updatedDrone.position.z >= 4) {
                  // In transit at operational layers
                  updatedDrone.operationPhase = 'transit';
                }
              }
            }
            
            // Update operation phase based on progress
            if (updatedDrone.battery < 20 && updatedDrone.operationPhase !== 'returning' && updatedDrone.operationPhase !== 'landing') {
              updatedDrone.operationPhase = 'returning';
              updatedDrone.status = 'warning';
              
              // Emergency return to dock
              const dockPosition = {
                x: Math.ceil(drone.id / 4) * 3 - 1.5,
                y: ((drone.id - 1) % 4 + 1) * 3 - 1.5,
                z: 0
              };
              
              // Create direct return path
              updatedDrone.flightPath = [
                // Move to transition layer if not already there
                { x: updatedDrone.position.x, y: updatedDrone.position.y, z: 3 },
                // Go directly to dock position at transition layer
                { x: dockPosition.x, y: dockPosition.y, z: 3 },
                // Descend to dock
                { ...dockPosition }
              ];
            }
            
            // Update last updated timestamp
            updatedDrone.lastUpdated = new Date();
          }
          
          return updatedDrone;
        });
      });
      
      // Detect potential conflicts between drones in flight
      detectConflictsBetweenDrones();
      
      // Occasionally generate new alerts
      if (Math.random() < 0.2) {
        const newAlert: TrafficAlert = {
          id: `alert-${Date.now()}`,
          timestamp: new Date(),
          severity: Math.random() < 0.7 ? 'info' : Math.random() < 0.9 ? 'warning' : 'critical',
          message: `Potential conflict detected between drones`,
          droneIds: [
            Math.floor(Math.random() * 16) + 1,
            Math.floor(Math.random() * 16) + 1,
          ],
          resolved: false,
        };
        
        setAlerts(prev => [...prev, newAlert].slice(-10)); // Keep only the last 10 alerts
      }
      
      // Update metrics
      setMetrics(prevMetrics => ({
        operationalThroughput: prevMetrics.operationalThroughput + Math.random() * 0.2 - 0.1,
        averageWaitTime: Math.max(0, prevMetrics.averageWaitTime + Math.random() * 0.5 - 0.25),
        pathEfficiency: Math.min(100, Math.max(70, prevMetrics.pathEfficiency + Math.random() * 2 - 1)),
        collisionAvoidanceEvents: prevMetrics.collisionAvoidanceEvents + (Math.random() < 0.1 ? 1 : 0),
        systemUtilization: Math.min(100, Math.max(0, prevMetrics.systemUtilization + Math.random() * 4 - 2)),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  
  // Function to detect conflicts between active drones
  const detectConflictsBetweenDrones = () => {
    // Get all active drones
    const activeDrones = drones.filter(d => d.operationPhase !== 'docked');
    
    // Don't bother checking if less than 2 drones are active
    if (activeDrones.length < 2) return;
    
    // Check for close proximity between any two drones
    for (let i = 0; i < activeDrones.length; i++) {
      for (let j = i + 1; j < activeDrones.length; j++) {
        const drone1 = activeDrones[i];
        const drone2 = activeDrones[j];
        
        // Calculate distance between drones
        const horizontalDist = Math.sqrt(
          Math.pow(drone1.position.x - drone2.position.x, 2) + 
          Math.pow(drone1.position.y - drone2.position.y, 2)
        );
        
        const verticalDist = Math.abs(drone1.position.z - drone2.position.z);
        
        // Check if drones are too close (within safety margin)
        if (horizontalDist < 1.5 && verticalDist < 1.0) {
          // Create conflict alert
          const newAlert: TrafficAlert = {
            id: `conflict-${Date.now()}`,
            timestamp: new Date(),
            severity: 'critical',
            message: `Proximity warning between Drone ${drone1.id} and Drone ${drone2.id}`,
            droneIds: [drone1.id, drone2.id],
            resolved: false,
          };
          
          // Add the alert if not already present
          setAlerts(prev => {
            if (!prev.some(a => 
              !a.resolved && 
              a.droneIds.includes(drone1.id) && 
              a.droneIds.includes(drone2.id))
            ) {
              return [...prev, newAlert].slice(-10);
            }
            return prev;
          });
          
          // Trigger evasive action for lower priority drone (lower ID yields)
          if (drone1.id < drone2.id) {
            executeEvasiveManeuver(drone1.id);
          } else {
            executeEvasiveManeuver(drone2.id);
          }
        }
      }
    }
  };
  
  // Execute evasive maneuver for a drone
  const executeEvasiveManeuver = (droneId: number) => {
    setDrones(prevDrones => 
      prevDrones.map(drone => {
        if (drone.id === droneId) {
          // Set status to warning
          const updatedDrone = { ...drone, status: 'warning' as DroneStatus };
          
          // If drone has flight path, modify it to hover in place temporarily
          if (drone.flightPath && drone.flightPath.length > 0) {
            // Hold position at current altitude for safety
            updatedDrone.flightPath = [
              { x: drone.position.x, y: drone.position.y, z: drone.position.z },
              ...drone.flightPath
            ];
          }
          
          return updatedDrone;
        }
        return drone;
      })
    );
  };

  const selectDrone = (droneId: number | null) => {
    if (!droneId) {
      setSelectedDrone(null);
      return;
    }
    
    const drone = drones.find(d => d.id === droneId) || null;
    setSelectedDrone(drone);
  };

  const updateDroneStatus = (droneId: number, status: DroneData['status']) => {
    setDrones(prevDrones => 
      prevDrones.map(drone => 
        drone.id === droneId ? { ...drone, status } : drone
      )
    );
  };

  const planFlightPath = (droneId: number, targetPosition: Position) => {
    setDrones(prevDrones => {
      // Find the current drone
      const currentDrones = [...prevDrones];
      const droneIndex = currentDrones.findIndex(d => d.id === droneId);
      
      if (droneIndex === -1) return prevDrones;
      
      const drone = currentDrones[droneIndex];
      
      // Calculate initial flight path
      const start = drone.position;
      const plannedPath = calculateFlightPath(start, targetPosition, droneId);
      
      // Check for conflicts with other drones' paths
      const conflictingDrones = detectPathConflicts(currentDrones, plannedPath, droneId);
      
      // If conflicts found, try to resolve them
      const finalPath = conflictingDrones.length > 0
        ? resolvePathConflicts(plannedPath, droneId, conflictingDrones)
        : plannedPath;
        
      // If conflicts were found, create an alert
      if (conflictingDrones.length > 0) {
        const newAlert: TrafficAlert = {
          id: `path-conflict-${Date.now()}`,
          timestamp: new Date(),
          severity: 'warning',
          message: `Path conflict resolved for Drone ${droneId}`,
          droneIds: [droneId, ...conflictingDrones.map(d => d.id)],
          resolved: true,
        };
        
        setAlerts(prev => [...prev, newAlert].slice(-10));
      }
      
      // Update the drone with new flight path and status
      currentDrones[droneIndex] = {
        ...drone,
        targetPosition,
        flightPath: finalPath,
        operationPhase: 'takeoff',
        status: 'active',
      };
      
      return currentDrones;
    });
  };

  const executeEmergencyProtocol = (droneId: number) => {
    setDrones(prevDrones => 
      prevDrones.map(drone => {
        if (drone.id === droneId) {
          // Emergency landing - go directly to ground from current position
          return {
            ...drone,
            status: 'emergency',
            operationPhase: 'landing',
            flightPath: [
              // Emergency descent path - direct vertical path down
              { x: drone.position.x, y: drone.position.y, z: 0 },
            ],
          };
        }
        return drone;
      })
    );
    
    // Create emergency alert
    const newAlert: TrafficAlert = {
      id: `emergency-${Date.now()}`,
      timestamp: new Date(),
      severity: 'critical',
      message: `Emergency landing protocol activated for Drone ${droneId}`,
      droneIds: [droneId],
      resolved: false,
    };
    
    setAlerts(prev => [...prev, newAlert]);
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.map(alert =>
        alert.id === alertId ? { ...alert, resolved: true } : alert
      )
    );
  };

  return (
    <DroneSystemContext.Provider
      value={{
        drones,
        alerts,
        metrics,
        selectedDrone,
        selectDrone,
        updateDroneStatus,
        planFlightPath,
        executeEmergencyProtocol,
        resolveAlert,
      }}
    >
      {children}
    </DroneSystemContext.Provider>
  );
};

export const useDroneSystem = () => {
  const context = useContext(DroneSystemContext);
  if (context === undefined) {
    throw new Error('useDroneSystem must be used within a DroneSystemProvider');
  }
  return context;
};
