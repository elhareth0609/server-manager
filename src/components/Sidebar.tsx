import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'services', label: 'Services', icon: 'Server' },
    { id: 'tools', label: 'Tools', icon: 'Wrench' },
    { id: 'files', label: 'Files', icon: 'Folder' },
    { id: 'logs', label: 'Logs', icon: 'FileText' },
    { id: 'settings', label: 'Settings', icon: 'Settings' }
  ];

  return (
    <div 
      className={`bg-gray-900 text-white h-screen transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center">
            <LucideIcons.Server className="text-blue-500 mr-2\" size={24} />
            <h1 className="text-xl font-semibold">ServerManager</h1>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <LucideIcons.Server className="text-blue-500" size={24} />
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-full hover:bg-gray-800 transition-colors"
        >
          {collapsed ? (
            <LucideIcons.ChevronRight size={18} className="text-gray-400" />
          ) : (
            <LucideIcons.ChevronLeft size={18} className="text-gray-400" />
          )}
        </button>
      </div>
      
      <nav className="mt-6">
        <ul>
          {tabs.map(tab => {
            const IconComponent = LucideIcons[tab.icon as keyof typeof LucideIcons];
            return (
              <li key={tab.id} className="mb-2">
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center py-3 px-4 w-full transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-gray-800 text-blue-500 border-l-4 border-blue-500' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                  }`}
                >
                  <IconComponent 
                    size={20} 
                    className={collapsed ? 'mx-auto' : 'mr-3'} 
                  />
                  {!collapsed && <span>{tab.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="right-0 px-4">
        {!collapsed && (
          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400">
            <div className="flex justify-between mb-2">
              <span>Status</span>
              <span className="text-green-500">Online</span>
            </div>
            <div className="flex justify-between">
              <span>Version</span>
              <span>1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;