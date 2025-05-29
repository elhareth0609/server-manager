import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';

const SettingsTab: React.FC = () => {
  const [theme, setTheme] = useState('dark');
  const [startWithSystem, setStartWithSystem] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoUpdateServices, setAutoUpdateServices] = useState(false);
  const [defaultPhpVersion, setDefaultPhpVersion] = useState('8.3.0');
  const [defaultMysqlVersion, setDefaultMysqlVersion] = useState('8.0.33');
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Settings</h2>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
          Save Changes
        </button>
      </div>
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-6">
        <div className="border-b border-gray-700 px-6 py-4">
          <h3 className="text-lg font-medium text-white">General Settings</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">Application Theme</h4>
              <p className="text-gray-400 text-sm">Choose between light and dark themes</p>
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="dark">Dark Theme</option>
              <option value="light">Light Theme</option>
              <option value="system">System Default</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">Start with System</h4>
              <p className="text-gray-400 text-sm">Launch application when your computer starts</p>
            </div>
            <button
              onClick={() => setStartWithSystem(!startWithSystem)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                startWithSystem ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  startWithSystem ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">Notifications</h4>
              <p className="text-gray-400 text-sm">Receive notifications for service status</p>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notificationsEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">Auto Update Services</h4>
              <p className="text-gray-400 text-sm">Automatically update services when new versions are available</p>
            </div>
            <button
              onClick={() => setAutoUpdateServices(!autoUpdateServices)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoUpdateServices ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoUpdateServices ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-6">
        <div className="border-b border-gray-700 px-6 py-4">
          <h3 className="text-lg font-medium text-white">Default Versions</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">PHP Default Version</h4>
              <p className="text-gray-400 text-sm">Default PHP version for new projects</p>
            </div>
            <select
              value={defaultPhpVersion}
              onChange={(e) => setDefaultPhpVersion(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="8.3.0">PHP 8.3.0</option>
              <option value="8.2.8">PHP 8.2.8</option>
              <option value="8.1.12">PHP 8.1.12</option>
              <option value="7.4.30">PHP 7.4.30</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">MySQL Default Version</h4>
              <p className="text-gray-400 text-sm">Default MySQL version for new projects</p>
            </div>
            <select
              value={defaultMysqlVersion}
              onChange={(e) => setDefaultMysqlVersion(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="8.0.33">MySQL 8.0.33</option>
              <option value="8.0.30">MySQL 8.0.30</option>
              <option value="5.7.42">MySQL 5.7.42</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="border-b border-gray-700 px-6 py-4">
          <h3 className="text-lg font-medium text-white">Paths & Directories</h3>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-white font-medium mb-2">Web Root Directory</h4>
            <div className="flex">
              <input
                type="text"
                value="/www"
                readOnly
                className="bg-gray-700 text-white rounded-l-md px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 w-full"
              />
              <button className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-r-md border border-gray-600">
                <LucideIcons.FolderOpen size={18} />
              </button>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2">Database Storage Directory</h4>
            <div className="flex">
              <input
                type="text"
                value="/data"
                readOnly
                className="bg-gray-700 text-white rounded-l-md px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 w-full"
              />
              <button className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-r-md border border-gray-600">
                <LucideIcons.FolderOpen size={18} />
              </button>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-medium mb-2">Log Files Directory</h4>
            <div className="flex">
              <input
                type="text"
                value="/logs"
                readOnly
                className="bg-gray-700 text-white rounded-l-md px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 w-full"
              />
              <button className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-r-md border border-gray-600">
                <LucideIcons.FolderOpen size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;