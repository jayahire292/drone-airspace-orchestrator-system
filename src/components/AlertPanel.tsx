
import React from 'react';
import { useDroneSystem } from '@/context/DroneSystemContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info, Check } from 'lucide-react';
import { format } from 'date-fns';

const AlertPanel = () => {
  const { alerts, resolveAlert } = useDroneSystem();
  
  // Sort alerts by timestamp, most recent first
  const sortedAlerts = [...alerts].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getAlertBorder = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-l-4 border-red-500';
      case 'warning':
        return 'border-l-4 border-amber-500';
      default:
        return 'border-l-4 border-blue-500';
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50 max-h-[350px] overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">System Alerts</h2>
      
      {sortedAlerts.length === 0 ? (
        <div className="text-center text-gray-500 py-4">
          No alerts at this time
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAlerts.map(alert => (
            <Alert
              key={alert.id}
              className={`py-3 ${getAlertBorder(alert.severity)} ${alert.resolved ? 'bg-gray-100 opacity-60' : ''}`}
            >
              <div className="flex items-center">
                {getAlertIcon(alert.severity)}
                <AlertTitle className="ml-2 text-sm font-medium">
                  {alert.severity === 'critical' ? 'Critical Alert' : 
                   alert.severity === 'warning' ? 'Warning' : 'Information'}
                </AlertTitle>
                <div className="ml-auto text-xs text-gray-500">
                  {format(alert.timestamp, 'HH:mm:ss')}
                </div>
              </div>
              <AlertDescription className="text-sm mt-1">
                {alert.message}
              </AlertDescription>
              <div className="flex justify-between items-center mt-2">
                <div className="text-xs">
                  {alert.droneIds.length > 1 ? 
                    `Drones: ${alert.droneIds.join(', ')}` : 
                    `Drone: ${alert.droneIds[0]}`}
                </div>
                {!alert.resolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2 flex gap-1 items-center"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    <Check className="h-3 w-3" />
                    Acknowledge
                  </Button>
                )}
              </div>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertPanel;
