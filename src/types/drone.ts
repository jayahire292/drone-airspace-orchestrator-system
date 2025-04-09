
export type DroneStatus = 'idle' | 'active' | 'warning' | 'emergency';

export type OperationPhase = 'docked' | 'takeoff' | 'transit' | 'operation' | 'returning' | 'landing';

export type AirspaceLayer = 1 | 2 | 3 | 4 | 5;

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface DroneData {
  id: number;
  name: string;
  status: DroneStatus;
  battery: number;
  position: Position;
  targetPosition?: Position;
  operationPhase: OperationPhase;
  currentLayer: AirspaceLayer;
  quadrant: Quadrant;
  lastUpdated: Date;
  flightPath?: Position[];
}

export interface TrafficAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  droneIds: number[];
  resolved: boolean;
}

export interface SystemMetrics {
  operationalThroughput: number;
  averageWaitTime: number;
  pathEfficiency: number;
  collisionAvoidanceEvents: number;
  systemUtilization: number;
}
