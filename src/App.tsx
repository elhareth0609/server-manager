import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ServicesTab from './components/ServicesTab';
import LogsTab from './components/LogsTab';
import FilesTab from './components/FilesTab';
import ToolsTab from './components/ToolsTab';
import SettingsTab from './components/SettingsTab';
import { services as initialServices, tools, logs, websiteFiles } from './data/services';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [services, setServices] = useState(initialServices);

  const handleServiceToggle = (id: string, shouldRun: boolean) => {
    setServices(prevServices => 
      prevServices.map(service => 
        service.id === id 
          ? { ...service, status: shouldRun ? 'running' : 'stopped' } 
          : service
      )
    );
  };

  const handleVersionChange = (id: string, version: string) => {
    setServices(prevServices => 
      prevServices.map(service => 
        service.id === id 
          ? { ...service, selectedVersion: version } 
          : service
      )
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            services={services} 
            tools={tools} 
            onServiceToggle={handleServiceToggle}
            onVersionChange={handleVersionChange}
          />
        );
      case 'services':
        return (
          <ServicesTab 
            services={services} 
            onServiceToggle={handleServiceToggle}
            onVersionChange={handleVersionChange}
          />
        );
      case 'logs':
        return <LogsTab logs={logs} services={services} />;
      case 'files':
        return <FilesTab files={websiteFiles} />;
      case 'tools':
        return <ToolsTab tools={tools} />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <Dashboard 
          services={services} 
          tools={tools} 
          onServiceToggle={handleServiceToggle}
          onVersionChange={handleVersionChange}
        />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default App;