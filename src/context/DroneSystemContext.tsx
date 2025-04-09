
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DroneData, TrafficAlert, SystemMetrics, Position } from '@/types/drone';
import { generateMockDrones, generateMockAlerts, calculateSystemMetrics } from '@/utils/mockData';

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
              
              // If close enough to next waypoint, remove it
              if (
                Math.abs(updatedDrone.position.x - nextPosition.x) < 0.1 &&
                Math.abs(updatedDrone.position.y - nextPosition.y) < 0.1 &&
                Math.abs(updatedDrone.position.z - nextPosition.z) < 0.1
              ) {
                updatedDrone.flightPath = drone.flightPath.slice(1);
              }
            }
            
            // Update operation phase based on progress
            if (updatedDrone.battery < 20 && updatedDrone.operationPhase !== 'returning' && updatedDrone.operationPhase !== 'landing') {
              updatedDrone.operationPhase = 'returning';
              updatedDrone.status = 'warning';
            }
            
            // Update last updated timestamp
            updatedDrone.lastUpdated = new Date();
          }
          
          return updatedDrone;
        });
      });
      
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
    setDrones(prevDrones => 
      prevDrones.map(drone => {
        if (drone.id === droneId) {
          // Simple direct path for demonstration
          const start = drone.position;
          
          // Generate waypoints for takeoff, transit, and landing
          const waypoints: Position[] = [
            // Takeoff - vertical movement to Layer 2
            { x: start.x, y: start.y, z: 3 },
            
            // Transit - move to Layer 3/4 based on drone ID
            { x: start.x, y: start.y, z: drone.id % 2 === 0 ? 4 : 6 },
            
            // Horizontal movement to target position
            { x: targetPosition.x, y: targetPosition.y, z: drone.id % 2 === 0 ? 4 : 6 },
            
            // Descend to Layer 2 above target
            { x: targetPosition.x, y: targetPosition.y, z: 3 },
            
            // Landing
            { x: targetPosition.x, y: targetPosition.y, z: 0 },
          ];
          
          return {
            ...drone,
            targetPosition,
            flightPath: waypoints,
            operationPhase: 'takeoff',
            status: 'active',
          };
        }
        return drone;
      })
    );
  };

  const executeEmergencyProtocol = (droneId: number) => {
    setDrones(prevDrones => 
      prevDrones.map(drone => {
        if (drone.id === droneId) {
          return {
            ...drone,
            status: 'emergency',
            operationPhase: 'landing',
            flightPath: [
              // Emergency landing - direct descent
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
