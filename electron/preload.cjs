
// preload.js - CommonJS version of your original file
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serverManagerAPI', {
    // Service Management
    startService: (serviceName) => ipcRenderer.invoke('start-service', serviceName),
    stopService: (serviceName) => ipcRenderer.invoke('stop-service', serviceName),
    restartService: (serviceName) => ipcRenderer.invoke('restart-service', serviceName),
    getServiceStatus: (serviceName) => ipcRenderer.invoke('get-service-status', serviceName),
    getAllServicesStatus: () => ipcRenderer.invoke('get-all-services-status'),
    startAllEnabledServices: () => ipcRenderer.invoke('start-all-enabled-services'),
    stopAllServices: () => ipcRenderer.invoke('stop-all-services'),

    // Tool Management
    openFileExplorer: (path) => ipcRenderer.invoke('open-file-explorer', path),
    openCmder: (workingDir) => ipcRenderer.invoke('open-cmder', workingDir),
    openHeidiSQL: () => ipcRenderer.invoke('open-heidisql'),
    openPHPMyAdmin: () => ipcRenderer.invoke('open-phpmyadmin'),
    openBrowser: (url) => ipcRenderer.invoke('open-browser', url),
    openLocalhost: (port) => ipcRenderer.invoke('open-localhost', port),
    openPHPServer: () => ipcRenderer.invoke('open-php-server'),
    openApacheServer: () => ipcRenderer.invoke('open-apache-server'),
    runNgrok: (port, protocol) => ipcRenderer.invoke('run-ngrok', port, protocol),
    openNodeREPL: () => ipcRenderer.invoke('open-node-repl'),
    getQuickAccessUrls: () => ipcRenderer.invoke('get-quick-access-urls'),

    // Configuration Management
    getConfig: (path) => ipcRenderer.invoke('get-config', path),
    setConfig: (path, value) => ipcRenderer.invoke('set-config', path, value),
    getServiceConfig: (serviceName) => ipcRenderer.invoke('get-service-config', serviceName),
    setServiceConfig: (serviceName, config) => ipcRenderer.invoke('set-service-config', serviceName, config),
    getAllServices: () => ipcRenderer.invoke('get-all-services'),
    getEnabledServices: () => ipcRenderer.invoke('get-enabled-services'),
    saveConfig: () => ipcRenderer.invoke('save-config'),
    resetConfig: () => ipcRenderer.invoke('reset-config'),

    // System Information
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    checkPortAvailable: (port) => ipcRenderer.invoke('check-port-available', port),
    getServiceLogs: (serviceName) => ipcRenderer.invoke('get-service-logs', serviceName),

    // Event listeners for real-time updates
    onServiceStatusChange: (callback) => {
        ipcRenderer.on('service-status-changed', callback);
        return () => ipcRenderer.removeListener('service-status-changed', callback);
    },

    onConfigChange: (callback) => {
        ipcRenderer.on('config-changed', callback);
        return () => ipcRenderer.removeListener('config-changed', callback);
    },

    onError: (callback) => {
        ipcRenderer.on('error', callback);
        return () => ipcRenderer.removeListener('error', callback);
    },

    onLog: (callback) => {
        ipcRenderer.on('log', callback);
        return () => ipcRenderer.removeListener('log', callback);
    },

    // Utility functions
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

    // App control
    minimizeApp: () => ipcRenderer.invoke('minimize-app'),
    maximizeApp: () => ipcRenderer.invoke('maximize-app'),
    closeApp: () => ipcRenderer.invoke('close-app'),
    restartApp: () => ipcRenderer.invoke('restart-app'),

    // Development helpers (only available in dev mode)
    isDev: () => ipcRenderer.invoke('is-dev'),
    openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
    reloadApp: () => ipcRenderer.invoke('reload-app')
});

// Also expose a simple version check (keeping your original structure)
contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    platform: () => process.platform,
    arch: () => process.arch
});

// Security: Remove node integration from window object
delete window.require;
delete window.exports;
delete window.module;

console.log('Preload script loaded successfully');