
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bell,
  Settings,
  HelpCircle,
  Menu,
} from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Menu className="h-5 w-5 text-gray-500 md:hidden" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-blue-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white">
                  <path 
                    fill="currentColor" 
                    d="M12,2L4,5v6.09c0,5.05,3.41,9.76,8,10.91c4.59-1.15,8-5.86,8-10.91V5L12,2z M15.94,12.06l-3.75,3.75 l-2.5-2.5L10.75,12l1.69,1.69l2.94-2.94L15.94,12.06z" 
                  />
                </svg>
              </div>
              <div>
                <div className="font-bold leading-tight text-gray-900">
                  FlytBase
                </div>
                <div className="text-xs text-gray-500">
                  Drone Airspace Orchestrator
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-gray-500">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-500">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-500">
              <Settings className="h-5 w-5" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
              UA
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
