
import React from 'react';
import { DroneSystemProvider } from '@/context/DroneSystemContext';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  return (
    <DroneSystemProvider>
      <Dashboard />
    </DroneSystemProvider>
  );
};

export default Index;
