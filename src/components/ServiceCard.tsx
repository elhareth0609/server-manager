import React, { useState } from 'react';
import { Service } from '../types';
import * as LucideIcons from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  onToggle: (id: string, status: boolean) => void;
  onVersionChange: (id: string, version: string) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onToggle, onVersionChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const Icon = LucideIcons[service.icon as keyof typeof LucideIcons];
  
  const statusColors = {
    running: 'bg-green-500',
    stopped: 'bg-red-500',
    error: 'bg-yellow-500'
  };
  
  const handleToggle = () => {
    onToggle(service.id, service.status !== 'running');
  };
  
  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVersionChange(service.id, e.target.value);
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-gray-600 transition-all duration-300">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md" style={{ backgroundColor: `${service.color}20` }}>
              <Icon size={24} color={service.color} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">{service.name}</h3>
              {service.port && (
                <p className="text-gray-400 text-sm">Port: {service.port}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${statusColors[service.status]}`}></div>
              <span className="text-sm text-gray-300 capitalize">{service.status}</span>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-full hover:bg-gray-700 transition-colors"
            >
              {isExpanded ? (
                <LucideIcons.ChevronUp size={16} className="text-gray-400" />
              ) : (
                <LucideIcons.ChevronDown size={16} className="text-gray-400" />
              )}
            </button>
          </div>
        </div>
        
        <div className={`mt-4 grid grid-cols-1 gap-3 transition-all duration-300 ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="flex items-center justify-between">
            <label htmlFor={`version-${service.id}`} className="text-sm text-gray-400">
              Version
            </label>
            <select
              id={`version-${service.id}`}
              value={service.selectedVersion}
              onChange={handleVersionChange}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              {service.versions.map(version => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {service.status === 'running' ? 'Running' : 'Stopped'}
            </span>
            <button
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                service.status === 'running' ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  service.status === 'running' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex justify-end mt-2">
            <button className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-3 rounded mr-2 transition-colors">
              Config
            </button>
            <button className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 px-3 rounded transition-colors">
              Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;