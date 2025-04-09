
import React from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';
import {
  Activity,
  Clock,
  Percent,
  ShieldAlert,
  Layers,
} from 'lucide-react';

const MetricsPanel = () => {
  const { metrics } = useDroneSystem();

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h2 className="text-lg font-semibold mb-4">System Metrics</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded-md shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-blue-600">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">Operational Throughput</span>
          </div>
          <div className="text-2xl font-bold">
            {metrics.operationalThroughput.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">operations/hour</div>
        </div>
        
        <div className="bg-white p-3 rounded-md shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-amber-600">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Average Wait Time</span>
          </div>
          <div className="text-2xl font-bold">
            {metrics.averageWaitTime.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">seconds</div>
        </div>
        
        <div className="bg-white p-3 rounded-md shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-green-600">
            <Percent className="h-4 w-4" />
            <span className="text-xs font-medium">Path Efficiency</span>
          </div>
          <div className="text-2xl font-bold">
            {metrics.pathEfficiency.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">optimal route</div>
        </div>
        
        <div className="bg-white p-3 rounded-md shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-red-600">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-medium">Collision Avoidance</span>
          </div>
          <div className="text-2xl font-bold">
            {metrics.collisionAvoidanceEvents}
          </div>
          <div className="text-xs text-gray-500">interventions</div>
        </div>
        
        <div className="col-span-2 bg-white p-3 rounded-md shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-violet-600">
            <Layers className="h-4 w-4" />
            <span className="text-xs font-medium">System Utilization</span>
          </div>
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-violet-500 rounded-full"
              style={{ width: `${metrics.systemUtilization}%` }}
            ></div>
          </div>
          <div className="mt-1 text-right text-xs">
            {metrics.systemUtilization.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsPanel;
