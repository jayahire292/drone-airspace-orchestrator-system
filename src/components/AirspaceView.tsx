
import React from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';
import { AlertTriangle } from 'lucide-react';

const AirspaceView = () => {
  const { drones, alerts } = useDroneSystem();
  
  // Get active alerts for visualization
  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
  
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
      
      {/* Grid Markers for Quadrants */}
      <div className="absolute top-12 left-0 bottom-0 right-0">
        {/* Vertical divider */}
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-blue-300 opacity-40" />
        {/* Horizontal divider */}
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-blue-300 opacity-40" />
        
        {/* Quadrant labels */}
        <div className="absolute top-1 left-1 text-[10px] text-blue-600 opacity-70">Q1</div>
        <div className="absolute top-1 right-1 text-[10px] text-blue-600 opacity-70">Q2</div>
        <div className="absolute bottom-1 left-1 text-[10px] text-blue-600 opacity-70">Q3</div>
        <div className="absolute bottom-1 right-1 text-[10px] text-blue-600 opacity-70">Q4</div>
      </div>
      
      {/* Drone Representations */}
      <div className="absolute left-0 right-0 bottom-0 top-12">
        {drones.map(drone => {
          // Skip docked drones
          if (drone.operationPhase === 'docked') return null;
          
          // Calculate position in the view based on drone position
          const heightPercentage = (drone.position.z / 10) * 100;
          const left = ((drone.position.x + 7.5) / 15) * 100; // Adjusted for grid size
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
              className={`absolute h-4 w-4 flex items-center justify-center text-white text-[10px] ${droneColors[drone.status]} rounded-full shadow-md z-10 transition-all duration-300`}
              style={{ 
                left: `${Math.min(Math.max(left, 0), 98)}%`, 
                top: `${Math.min(Math.max(top, 0), 98)}%`
              }}
              title={`Drone ${drone.id} - ${drone.operationPhase} - Alt: ${drone.position.z.toFixed(1)}m`}
            >
              {drone.id}
            </div>
          );
        })}
        
        {/* Flight paths visualization - simplified version */}
        {drones.map(drone => {
          if (!drone.flightPath || drone.flightPath.length === 0 || drone.operationPhase === 'docked') return null;
          
          // Draw just the next waypoint as a target
          const nextWaypoint = drone.flightPath[0];
          const targetLeft = ((nextWaypoint.x + 7.5) / 15) * 100;
          const targetTop = 100 - ((nextWaypoint.z / 10) * 100);
          
          return (
            <div 
              key={`target-${drone.id}`}
              className="absolute h-2 w-2 rounded-full border border-white opacity-70"
              style={{ 
                left: `${Math.min(Math.max(targetLeft, 0), 98)}%`, 
                top: `${Math.min(Math.max(targetTop, 0), 98)}%`,
                backgroundColor: drone.id % 2 === 0 ? '#3b82f6' : '#ec4899'
              }}
            />
          );
        })}
        
        {/* Alert visualizations */}
        {criticalAlerts.map(alert => {
          // Show conflict alerts
          if (alert.message.includes('Proximity')) {
            const droneIdsInvolved = alert.droneIds;
            // Find involved drones
            const involvedDrones = drones.filter(d => droneIdsInvolved.includes(d.id));
            
            // If either drone is not found, skip this alert
            if (involvedDrones.length < 2) return null;
            
            // Calculate average position of conflict
            const avgX = involvedDrones.reduce((sum, d) => sum + d.position.x, 0) / involvedDrones.length;
            const avgY = involvedDrones.reduce((sum, d) => sum + d.position.y, 0) / involvedDrones.length;
            const avgZ = involvedDrones.reduce((sum, d) => sum + d.position.z, 0) / involvedDrones.length;
            
            const left = ((avgX + 7.5) / 15) * 100;
            const top = 100 - ((avgZ / 10) * 100);
            
            return (
              <div 
                key={`alert-${alert.id}`}
                className="absolute animate-pulse"
                style={{ 
                  left: `${Math.min(Math.max(left, 0), 98)}%`, 
                  top: `${Math.min(Math.max(top, 0), 98)}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            );
          }
          return null;
        })}
      </div>
      
      <div className="absolute left-2 bottom-2 bg-white/80 rounded px-1 py-0.5 text-xs">
        <div className="font-medium">Active drones: {drones.filter(d => d.operationPhase !== 'docked').length}</div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="inline-block h-2 w-2 bg-blue-500 rounded-full"></span> Layer 3 (even)
          <span className="inline-block h-2 w-2 bg-pink-500 rounded-full ml-1"></span> Layer 4 (odd)
        </div>
      </div>
    </div>
  );
};

export default AirspaceView;
