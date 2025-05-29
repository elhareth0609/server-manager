import React, { useState } from 'react';
import { LogEntry, ServiceType } from '../types';
import * as LucideIcons from 'lucide-react';

interface LogsTabProps {
  logs: LogEntry[];
  services: { id: ServiceType; name: string }[];
}

const LogsTab: React.FC<LogsTabProps> = ({ logs, services }) => {
  const [filter, setFilter] = useState<ServiceType | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  
  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.service !== filter) return false;
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    return true;
  });
  
  const getIconForLevel = (level: string) => {
    switch (level) {
      case 'info': return <LucideIcons.Info size={16} className="text-blue-500" />;
      case 'warning': return <LucideIcons.AlertTriangle size={16} className="text-yellow-500" />;
      case 'error': return <LucideIcons.AlertOctagon size={16} className="text-red-500" />;
      default: return <LucideIcons.Circle size={16} className="text-gray-500" />;
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Service Logs</h2>
        <div className="flex space-x-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ServiceType | 'all')}
            className="bg-gray-800 text-white rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Services</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as 'all' | 'info' | 'warning' | 'error')}
            className="bg-gray-800 text-white rounded-md px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <button className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-md border border-gray-700">
            <LucideIcons.RefreshCw size={18} />
          </button>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="border-b border-gray-700 px-4 py-3 flex justify-between items-center">
          <h3 className="text-white font-medium">Recent Logs</h3>
          <div className="text-gray-400 text-sm">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
        
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <LucideIcons.FileX size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No logs match your filter criteria</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <table className="min-w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredLogs.map(log => {
                  const service = services.find(s => s.id === log.service);
                  return (
                    <tr key={log.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {getIconForLevel(log.level)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-300">{service?.name || log.service}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-400">{log.timestamp}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-300">{log.message}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsTab;