
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
  // Determine which transit layer based on drone ID (even vs odd)
  const transitAltitude = droneId % 2 === 0 ? 5 : 7; // Layer 3 (4-6m) or Layer 4 (6-8m)
  
  // Get drone's quadrant for path planning
  const getQuadrant = (id: number): Quadrant => {
    if ([1, 2, 5, 6].includes(id)) return 'Q1';
    if ([3, 4, 7, 8].includes(id)) return 'Q2';
    if ([9, 10, 13, 14].includes(id)) return 'Q3';
    return 'Q4';
  };
  
  const droneQuadrant = getQuadrant(droneId);
  
  // Create waypoints for the flight path
  const path: Position[] = [];
  
  // Step 1: Takeoff - vertical movement to Layer 2 (transition layer)
  path.push({ x: start.x, y: start.y, z: 3 });
  
  // Step 2: Ascend to assigned transit layer
  path.push({ x: start.x, y: start.y, z: transitAltitude });
  
  // Step 3: Move to boundary of current quadrant based on target direction
  // This uses corridors along the grid boundaries to reduce path conflicts
  let boundaryPoint: Position;
  
  switch(droneQuadrant) {
    case 'Q1':
      // For Q1, exit through top or right depending on target direction
      boundaryPoint = { 
        x: end.x < start.x ? start.x : 9,  // Use right edge if going east
        y: end.y < start.y ? 3 : start.y,  // Use top edge if going south
        z: transitAltitude 
      };
      break;
    case 'Q2':
      // For Q2, exit through top or left depending on target direction
      boundaryPoint = { 
        x: end.x > start.x ? start.x : 9,  // Use left edge if going west
        y: end.y < start.y ? 3 : start.y,  // Use top edge if going south
        z: transitAltitude 
      };
      break;
    case 'Q3':
      // For Q3, exit through bottom or right depending on target direction
      boundaryPoint = { 
        x: end.x < start.x ? start.x : 9,  // Use right edge if going east
        y: end.y > start.y ? 9 : start.y,  // Use bottom edge if going north
        z: transitAltitude 
      };
      break;
    case 'Q4':
    default:
      // For Q4, exit through bottom or left depending on target direction
      boundaryPoint = { 
        x: end.x > start.x ? start.x : 9,  // Use left edge if going west
        y: end.y > start.y ? 9 : start.y,  // Use bottom edge if going north
        z: transitAltitude 
      };
      break;
  }
  
  // Add boundary transit point to path
  path.push(boundaryPoint);
  
  // Step 4: Move to position above target
  path.push({ x: end.x, y: end.y, z: transitAltitude });
  
  // Step 5: Descend to transition layer above target
  path.push({ x: end.x, y: end.y, z: 3 });
  
  // Step 6: Final descent to target
  path.push({ x: end.x, y: end.y, z: 0 });
  
  return path;
};

// Function to check for potential path conflicts
export const detectPathConflicts = (
  drones: DroneData[],
  newPath: Position[],
  newDroneId: number
): DroneData[] => {
  const conflictingDrones: DroneData[] = [];
  
  // Min safe distance requirements
  const MIN_HORIZONTAL_SEPARATION = 1.5; // meters
  const MIN_VERTICAL_SEPARATION = 1.0; // meters
  
  // Check against each active drone's path
  drones.forEach(drone => {
    // Skip if same drone or no flight path
    if (drone.id === newDroneId || !drone.flightPath || drone.operationPhase === 'docked') {
      return;
    }
    
    // Simple path conflict detection - check if any waypoints come too close
    for (const newPoint of newPath) {
      for (const existingPoint of drone.flightPath) {
        const horizontalDist = Math.sqrt(
          Math.pow(newPoint.x - existingPoint.x, 2) + 
          Math.pow(newPoint.y - existingPoint.y, 2)
        );
        
        const verticalDist = Math.abs(newPoint.z - existingPoint.z);
        
        // Check if paths come too close
        if (horizontalDist < MIN_HORIZONTAL_SEPARATION && verticalDist < MIN_VERTICAL_SEPARATION) {
          conflictingDrones.push(drone);
          break;
        }
      }
      
      // If conflict already found with this drone, move to next
      if (conflictingDrones.includes(drone)) {
        break;
      }
    }
  });
  
  return conflictingDrones;
};

// Resolve path conflicts by adjusting timing or path
export const resolvePathConflicts = (
  path: Position[],
  droneId: number,
  conflictingDrones: DroneData[]
): Position[] => {
  // If no conflicts, return original path
  if (conflictingDrones.length === 0) {
    return path;
  }
  
  // For this demo, add a waiting waypoint to delay the drone
  // In a real system, this would be more sophisticated
  const modifiedPath = [...path];
  
  // Add a hover point at the transition layer
  modifiedPath.splice(2, 0, {
    x: path[1].x,
    y: path[1].y,
    z: path[1].z
  });
  
  // Apply priority rules based on drone ID
  const highestPriorityDroneId = Math.max(...conflictingDrones.map(d => d.id));
  
  // If this drone has higher priority, create alternate route
  if (droneId > highestPriorityDroneId) {
    // Try alternate route - add waypoint with slight horizontal offset
    modifiedPath.splice(3, 0, {
      x: path[2].x + 2, // 2m horizontal offset
      y: path[2].y + 2,
      z: path[2].z
    });
  }
  
  return modifiedPath;
};
