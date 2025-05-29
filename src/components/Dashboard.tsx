import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';

// Types and Interfaces
interface Service {
  id: string;
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'unknown';
  port?: number;
  versions?: string[];
  selectedVersion?: string;
  icon: string;
  color: string;
}

interface Tool {
  id: string;
  name: string;
  icon: string;
  url: string;
  description: string;
  action: () => void;
}

interface LogEntry {
  id: string;
  service: string;
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

// Updated API interface to match what should be exposed from preload
interface ServerManagerAPI {
  startService: (service: string) => Promise<boolean>;
  stopService: (service: string) => Promise<boolean>;
  getServiceStatus: (service: string) => Promise<string>;
  getAllServicesStatus?: () => Promise<Record<string, string>>;
  openFileExplorer: (path?: string) => Promise<void>;
  openCmder: () => Promise<void>;
  openHeidiSQL: () => Promise<void>; // Note the correct casing
  openPHPMyAdmin: () => Promise<void>; // Note the correct casing
}

declare global {
  interface Window {
    serverManagerAPI?: ServerManagerAPI;
  }
}

// Mock data
const initialServices: Service[] = [
  {
    id: 'php',
    name: 'php',
    displayName: 'PHP',
    status: 'unknown',
    port: 9000,
    versions: ['8.3.0', '8.2.8', '8.1.12', '7.4.30'],
    selectedVersion: '8.3.0',
    icon: 'FileCode',
    color: '#777BB3'
  },
  {
    id: 'apache',
    name: 'apache',
    displayName: 'Apache HTTP Server',
    status: 'unknown',
    port: 80,
    versions: ['2.4.58', '2.4.53', '2.4.46'],
    selectedVersion: '2.4.58',
    icon: 'Server',
    color: '#D22128'
  },
  {
    id: 'mysql',
    name: 'mysql',
    displayName: 'MySQL Database',
    status: 'unknown',
    port: 3306,
    versions: ['8.0.33', '8.0.30', '5.7.42'],
    selectedVersion: '8.0.33',
    icon: 'Database',
    color: '#00758F'
  },
  {
    id: 'nginx',
    name: 'nginx',
    displayName: 'Nginx',
    status: 'unknown',
    port: 8080,
    versions: ['1.24.0', '1.22.1', '1.20.2'],
    selectedVersion: '1.24.0',
    icon: 'Globe',
    color: '#009639'
  },
  {
    id: 'mariadb',
    name: 'mariadb',
    displayName: 'MariaDB',
    status: 'unknown',
    port: 3307,
    versions: ['11.2.0', '10.11.5', '10.6.16'],
    selectedVersion: '11.2.0',
    icon: 'Database',
    color: '#C0765A'
  }
];

const Dashboard: React.FC = () => {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Check if API is available on mount
  useEffect(() => {
    console.log('API Available:', !!window.serverManagerAPI);
    if (window.serverManagerAPI) {
      console.log('Available methods:', Object.keys(window.serverManagerAPI));
    }
    checkAllServiceStatus();
  }, []);

  // Tools with corrected function names
  const tools: Tool[] = [
    {
      id: 'phpmyadmin',
      name: 'phpMyAdmin',
      icon: 'LayoutDashboard',
      url: 'http://localhost/phpmyadmin',
      description: 'Web interface for MySQL database management',
      action: handleOpenPHPMyAdmin
    },
    {
      id: 'terminal',
      name: 'Command Line',
      icon: 'Terminal',
      url: '#',
      description: 'Open terminal/command prompt',
      action: handleOpenCmder
    },
    {
      id: 'heidisql',
      name: 'HeidiSQL',
      icon: 'Database',
      url: '#',
      description: 'Open HeidiSQL database manager',
      action: handleOpenHeidiSQL
    },
    {
      id: 'filebrowser',
      name: 'File Explorer',
      icon: 'Folder',
      url: '#',
      description: 'Browse website files',
      action: () => handleOpenFolder('C:/server-manager/www')
    }
  ];

  const checkAllServiceStatus = async () => {
    const api = window.serverManagerAPI;
    if (!api) {
      console.warn('ServerManager API not available');
      return;
    }

    try {
      // Try to use batch status check if available
      if (api.getAllServicesStatus) {
        const allStatuses = await api.getAllServicesStatus();
        setServices(prev => prev.map(service => ({
          ...service,
          status: (allStatuses[service.name] as 'running' | 'stopped') || 'unknown'
        })));
      } else {
        // Fallback to individual status checks
        const updatedServices = await Promise.all(
          services.map(async (service) => {
            try {
              const status = await api.getServiceStatus(service.name);
              console.log(`Status for ${service.name}:`, status);
              return {
                ...service,
                status: (status as 'running' | 'stopped') || 'unknown'
              };
            } catch (error) {
              console.error(`Failed to get status for ${service.name}:`, error);
              return { ...service, status: 'unknown' as const };
            }
          })
        );
        setServices(updatedServices);
      }
    } catch (error) {
      console.error('Failed to check service statuses:', error);
      addLog('system', 'Failed to check service statuses', 'error');
    }
  };

  const handleServiceAction = async (serviceId: string, action: 'start' | 'stop') => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    const api = window.serverManagerAPI;
    if (!api) {
      console.error('ServerManager API not available');
      addLog('system', 'API not available', 'error');
      return;
    }

    setLoading(prev => ({ ...prev, [serviceId]: true }));
    
    try {
      const success = action === 'start' 
        ? await api.startService(service.name)
        : await api.stopService(service.name);
      
      if (success) {
        // Update service status immediately
        setServices(prev => prev.map(s => 
          s.id === serviceId 
            ? { ...s, status: action === 'start' ? 'running' : 'stopped' }
            : s
        ));
        
        addLog(service.name, `${service.displayName} ${action}ed successfully`, 'info');
        
        // Optionally refresh status after a short delay to confirm
        setTimeout(() => {
          if (api.getServiceStatus) {
            api.getServiceStatus(service.name).then(status => {
              setServices(prev => prev.map(s => 
                s.id === serviceId 
                  ? { ...s, status: (status as 'running' | 'stopped') || 'unknown' }
                  : s
              ));
            });
          }
        }, 1000);
      } else {
        addLog(service.name, `Failed to ${action} ${service.displayName}`, 'error');
      }
    } catch (error) {
      console.error(`Failed to ${action} ${service.name}:`, error);
      addLog(service.name, `Failed to ${action} ${service.displayName}: ${error}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const addLog = (service: string, message: string, level: 'info' | 'warning' | 'error') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      service,
      timestamp: new Date().toLocaleString(),
      message,
      level
    };
    setLogs(prev => [newLog, ...prev.slice(0, 9)]);
  };

  async function handleOpenFolder(path: string) {
    try {
      const api = window.serverManagerAPI;
      if (!api?.openFileExplorer) {
        throw new Error('openFileExplorer not available');
      }
      await api.openFileExplorer(path);
      addLog('system', `Opened folder: ${path}`, 'info');
    } catch (error) {
      console.error('Failed to open folder:', error);
      addLog('system', `Failed to open folder: ${error}`, 'error');
    }
  }

  async function handleOpenCmder() {
    try {
      const api = window.serverManagerAPI;
      if (!api?.openCmder) {
        throw new Error('openCmder not available');
      }
      await api.openCmder();
      addLog('system', 'Opened command line', 'info');
    } catch (error) {
      console.error('Failed to open Cmder:', error);
      addLog('system', `Failed to open command line: ${error}`, 'error');
    }
  }

  async function handleOpenHeidiSQL() {
    try {
      const api = window.serverManagerAPI;
      if (!api?.openHeidiSQL) {
        throw new Error('openHeidiSQL not available');
      }
      await api.openHeidiSQL();
      addLog('system', 'Opened HeidiSQL', 'info');
    } catch (error) {
      console.error('Failed to open HeidiSQL:', error);
      addLog('system', `Failed to open HeidiSQL: ${error}`, 'error');
    }
  }

  async function handleOpenPHPMyAdmin() {
    try {
      const api = window.serverManagerAPI;
      if (!api?.openPHPMyAdmin) {
        throw new Error('openPHPMyAdmin not available');
      }
      await api.openPHPMyAdmin();
      addLog('system', 'Opened phpMyAdmin', 'info');
    } catch (error) {
      console.error('Failed to open phpMyAdmin:', error);
      addLog('system', `Failed to open phpMyAdmin: ${error}`, 'error');
    }
  }

  const handleStartAll = async () => {
    setGlobalLoading(true);
    const stoppedServices = services.filter(s => s.status === 'stopped');
    
    for (const service of stoppedServices) {
      await handleServiceAction(service.id, 'start');
    }
    
    // Refresh all statuses after starting all services
    await checkAllServiceStatus();
    setGlobalLoading(false);
  };

  const handleStopAll = async () => {
    setGlobalLoading(true);
    const runningServices = services.filter(s => s.status === 'running');
    
    for (const service of runningServices) {
      await handleServiceAction(service.id, 'stop');
    }
    
    // Refresh all statuses after stopping all services
    await checkAllServiceStatus();
    setGlobalLoading(false);
  };

  const handleVersionChange = (serviceId: string, version: string) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, selectedVersion: version }
        : service
    ));
    
    // You might want to restart the service when version changes
    addLog('system', `Version changed for ${services.find(s => s.id === serviceId)?.displayName} to ${version}`, 'info');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LucideIcons.CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped':
        return <LucideIcons.XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <LucideIcons.AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600 bg-green-50';
      case 'stopped':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons] as any;
    return IconComponent || LucideIcons.Server;
  };

  const runningServices = services.filter(s => s.status === 'running').length;
  const totalMemory = runningServices * 35 + 50; // Mock memory calculation

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Server Manager</h1>
              <p className="text-gray-600">Manage your local development environment</p>
              {!window.serverManagerAPI && (
                <div className="mt-2 text-red-600 text-sm">
                  ⚠️ API not available - running in preview mode
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={handleStartAll}
                disabled={globalLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
              >
                {globalLoading ? (
                  <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LucideIcons.Play className="w-4 h-4" />
                )}
                <span>Start All</span>
              </button>
              <button 
                onClick={handleStopAll}
                disabled={globalLoading}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
              >
                {globalLoading ? (
                  <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LucideIcons.Square className="w-4 h-4" />
                )}
                <span>Stop All</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-gray-500 text-sm font-medium">Total Services</h3>
                <p className="text-3xl font-bold text-gray-900">{services.length}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <LucideIcons.Server className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-gray-500 text-sm font-medium">Running</h3>
                <p className="text-3xl font-bold text-green-600">{runningServices}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <LucideIcons.Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-gray-500 text-sm font-medium">Memory Usage</h3>
                <p className="text-3xl font-bold text-purple-600">{totalMemory} MB</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <LucideIcons.Cpu className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Services Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Services Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {services.map((service) => {
                const IconComponent = getIconComponent(service.icon);
                return (
                  <div key={service.id} className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: service.color + '20' }}>
                          <IconComponent className="w-6 h-6" style={{ color: service.color }} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{service.displayName}</h3>
                          {service.selectedVersion && (
                            <p className="text-sm text-gray-500">v{service.selectedVersion}</p>
                          )}
                        </div>
                      </div>
                      {getStatusIcon(service.status)}
                    </div>
                    
                    <div className="mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(service.status)}`}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </span>
                      {service.port && (
                        <span className="ml-2 text-sm text-gray-500">Port: {service.port}</span>
                      )}
                    </div>

                    {service.versions && service.versions.length > 1 && (
                      <div className="mb-4">
                        <select
                          value={service.selectedVersion}
                          onChange={(e) => handleVersionChange(service.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {service.versions.map(version => (
                            <option key={version} value={version}>v{version}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleServiceAction(service.id, 'start')}
                        disabled={loading[service.id] || service.status === 'running'}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md flex items-center justify-center space-x-2 transition-colors"
                      >
                        {loading[service.id] ? (
                          <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LucideIcons.Play className="w-4 h-4" />
                        )}
                        <span>Start</span>
                      </button>
                      
                      <button
                        onClick={() => handleServiceAction(service.id, 'stop')}
                        disabled={loading[service.id] || service.status === 'stopped'}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-md flex items-center justify-center space-x-2 transition-colors"
                      >
                        {loading[service.id] ? (
                          <LucideIcons.Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LucideIcons.Square className="w-4 h-4" />
                        )}
                        <span>Stop</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Access</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map(tool => {
                  const IconComponent = getIconComponent(tool.icon);
                  return (
                    <button
                      key={tool.id}
                      onClick={tool.action}
                      className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 flex items-center space-x-4 transition-colors group"
                    >
                      <div className="p-3 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                        <IconComponent className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-800">{tool.name}</h4>
                        <p className="text-sm text-gray-600">{tool.description}</p>
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={checkAllServiceStatus}
                  className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 flex items-center space-x-4 transition-colors group"
                >
                  <div className="p-3 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                    <LucideIcons.RefreshCw className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-800">Refresh Status</h4>
                    <p className="text-sm text-gray-600">Update all service statuses</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 h-fit">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Activity Log</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="border-l-4 pl-4 py-2" style={{
                      borderLeftColor: log.level === 'error' ? '#ef4444' : 
                                     log.level === 'warning' ? '#f59e0b' : '#10b981'
                    }}>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold text-gray-700">{log.service}</span>
                        <span className="text-xs text-gray-500">{log.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-600">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;