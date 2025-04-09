
import React from 'react';
import Header from './Header';
import DroneGrid from './DroneGrid';
import AirspaceView from './AirspaceView';
import ControlPanel from './ControlPanel';
import AlertPanel from './AlertPanel';
import MetricsPanel from './MetricsPanel';

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <h1 className="text-2xl font-bold">Drone Airspace Orchestrator System</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DroneGrid />
              <AirspaceView />
            </div>
            
            <AlertPanel />
          </div>
          
          <div className="md:col-span-4 space-y-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 shadow">
              <h2 className="text-lg font-semibold">System Status</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
                <span>Operational</span>
              </div>
              <p className="mt-2 text-sm text-blue-100">
                All systems are functioning normally
              </p>
            </div>
            
            <ControlPanel />
            <MetricsPanel />
          </div>
        </div>
      </main>
      
      <footer className="bg-gray-800 text-white py-4 px-6">
        <div className="container mx-auto text-center text-sm">
          <p>&copy; 2025 FlytBase - Drone Airspace Orchestrator</p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
