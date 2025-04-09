
import { DroneData, TrafficAlert, SystemMetrics, Quadrant, Position } from '@/types/drone';

export const generateMockDrones = (): DroneData[] => {
  const drones: DroneData[] = [];
  
  // Create 16 drones in a 4x4 grid
  for (let i = 1; i <= 16; i++) {
    const row = Math.ceil(i / 4);
    const col = ((i - 1) % 4) + 1;
    
    // Determine quadrant
    let quadrant: Quadrant = 'Q1';
    if (row <= 2 && col >= 3) quadrant = 'Q2';
    else if (row >= 3 && col <= 2) quadrant = 'Q3';
    else if (row >= 3 && col >= 3) quadrant = 'Q4';
    
    drones.push({
      id: i,
      name: `Drone ${i}`,
      status: Math.random() > 0.8 ? 'active' : 'idle',
      battery: 80 + Math.random() * 20,
      position: {
        x: col * 3 - 1.5, // 3m spacing with 1.5m offset
        y: row * 3 - 1.5,
        z: 0, // Docked at ground level
      },
      operationPhase: 'docked',
      currentLayer: 1,
      quadrant,
      lastUpdated: new Date(),
    });
  }
  
  return drones;
};

export const generateMockAlerts = (): TrafficAlert[] => {
  const alerts: TrafficAlert[] = [];
  
  // Generate a few sample alerts
  alerts.push({
    id: 'alert-1',
    timestamp: new Date(Date.now() - 120000), // 2 minutes ago
    severity: 'info',
    message: 'Close proximity detected between Drone 3 and Drone 7',
    droneIds: [3, 7],
    resolved: true,
  });
  
  alerts.push({
    id: 'alert-2',
    timestamp: new Date(Date.now() - 60000), // 1 minute ago
    severity: 'warning',
    message: 'Path conflict predicted between Drone 12 and Drone 9',
    droneIds: [12, 9],
    resolved: false,
  });
  
  alerts.push({
    id: 'alert-3',
    timestamp: new Date(),
    severity: 'info',
    message: 'Low battery warning for Drone 5',
    droneIds: [5],
    resolved: false,
  });
  
  return alerts;
};

export const calculateSystemMetrics = (drones: DroneData[], alerts: TrafficAlert[]): SystemMetrics => {
  // Count active drones
  const activeDrones = drones.filter(d => d.status === 'active').length;
  
  // Calculate metrics
  return {
    operationalThroughput: activeDrones * 2.5, // Operations per hour
    averageWaitTime: 25 + Math.random() * 10, // seconds
    pathEfficiency: 85 + Math.random() * 10, // percentage
    collisionAvoidanceEvents: alerts.filter(a => a.severity !== 'info').length,
    systemUtilization: (activeDrones / drones.length) * 100, // percentage
  };
};

export const calculateFlightPath = (start: Position, end: Position, droneId: number): Position[] => {
  // Assign altitude based on drone ID (even vs odd)
  const transitAltitude = droneId % 2 === 0 ? 4 : 6; // Layer 3 or Layer 4
  
  return [
    // Takeoff - vertical movement to Layer 2
    { x: start.x, y: start.y, z: 3 },
    
    // Transit - move to assigned layer
    { x: start.x, y: start.y, z: transitAltitude },
    
    // Horizontal movement to target position
    { x: end.x, y: end.y, z: transitAltitude },
    
    // Descend to Layer 2 above target
    { x: end.x, y: end.y, z: 3 },
    
    // Landing
    { x: end.x, y: end.y, z: 0 },
  ];
};
