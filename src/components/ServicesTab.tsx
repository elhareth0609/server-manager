import React, { useState } from 'react';
import { Service } from '../types';
import ServiceCard from './ServiceCard';
import * as LucideIcons from 'lucide-react';

interface ServicesTabProps {
  services: Service[];
  onServiceToggle: (id: string, status: boolean) => void;
  onVersionChange: (id: string, version: string) => void;
}

const ServicesTab: React.FC<ServicesTabProps> = ({ 
  services, 
  onServiceToggle, 
  onVersionChange 
}) => {
  const [filter, setFilter] = useState('all');
  
  const filteredServices = filter === 'all' 
    ? services 
    : filter === 'running' 
      ? services.filter(s => s.status === 'running')
      : services.filter(s => s.status !== 'running');
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Services</h2>
        <div className="flex space-x-2">
          <div className="bg-gray-800 rounded-md flex items-center p-1">
            <button 
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'running' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setFilter('running')}
            >
              Running
            </button>
            <button 
              className={`px-3 py-1 rounded-md text-sm ${
                filter === 'stopped' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setFilter('stopped')}
            >
              Stopped
            </button>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center">
            <LucideIcons.Download className="mr-2" size={16} />
            Install New
          </button>
        </div>
      </div>
      
      {filteredServices.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <LucideIcons.AlertCircle size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No {filter !== 'all' ? filter : ''} services found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              onToggle={onServiceToggle}
              onVersionChange={onVersionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesTab;