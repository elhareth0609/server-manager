// installation-preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Initialize installation data
    onInitInstallation: (callback) => {
        ipcRenderer.on('init-installation', (event, data) => callback(data));
    },

    // Handle installation progress updates
    onInstallationProgress: (callback) => {
        ipcRenderer.on('installation-progress', (event, progress) => callback(progress));
    },

    // Select installation path
    selectInstallationPath: () => {
        return ipcRenderer.invoke('select-installation-path');
    },

    // Update tool selection
    updateToolSelection: (toolId, selected) => {
        return ipcRenderer.invoke('update-tool-selection', toolId, selected);
    },

    // Update installation configuration
    updateInstallationConfig: (config) => {
        return ipcRenderer.invoke('update-installation-config', config);
    },

    // Start installation process
    startInstallation: (config) => {
        return ipcRenderer.invoke('start-installation', config);
    },

    // Get installation progress
    getInstallationProgress: () => {
        return ipcRenderer.invoke('get-installation-progress');
    },

    // Cancel installation
    cancelInstallation: () => {
        return ipcRenderer.invoke('cancel-installation');
    },

    // Get system information
    getSystemInfo: () => {
        return ipcRenderer.invoke('get-system-info');
    },

    // Validate installation path
    validateInstallationPath: (path) => {
        return ipcRenderer.invoke('validate-installation-path', path);
    },

    // Get disk space information
    getDiskSpace: (path) => {
        return ipcRenderer.invoke('get-disk-space', path);
    },

    // Check if path is writable
    checkPathWritable: (path) => {
        return ipcRenderer.invoke('check-path-writable', path);
    }
});

// Handle window closing
window.addEventListener('beforeunload', (event) => {
    // Prevent closing during installation
    const isInstalling = document.body.classList.contains('installing');
    if (isInstalling) {
        event.preventDefault();
        event.returnValue = '';
        return false;
    }
});

// Add some utility functions for the installation UI
window.installationUtils = {
    // Format file size
    formatFileSize: (bytes) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    // Format duration
    formatDuration: (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${remainingSeconds}s`;
    },

    // Validate path
    isValidPath: (path) => {
        if (!path || path.trim() === '') return false;
        
        // Check for invalid characters (Windows specific)
        if (process.platform === 'win32') {
            const invalidChars = /[<>:"|?*]/;
            return !invalidChars.test(path);
        }
        
        return true;
    },

    // Get recommended installation path
    getRecommendedPath: () => {
        const os = require('os');
        const path = require('path');
        
        switch (process.platform) {
            case 'win32':
                return path.join(os.homedir(), 'Documents', 'ServerManager');
            case 'darwin':
                return path.join(os.homedir(), 'Documents', 'ServerManager');
            case 'linux':
                return path.join(os.homedir(), 'ServerManager');
            default:
                return path.join(os.homedir(), 'ServerManager');
        }
    },

    // Calculate estimated installation time
    calculateEstimatedTime: (totalSizeMB, connectionSpeed = 10) => {
        // Assume average download speed of 10 MB/s, plus installation overhead
        const downloadTime = totalSizeMB / connectionSpeed;
        const installationTime = totalSizeMB * 0.1; // 10% of download time for installation
        return Math.ceil(downloadTime + installationTime);
    },

    // Group tools by category
    groupToolsByCategory: (tools) => {
        const categories = {};
        tools.forEach(tool => {
            if (!categories[tool.category]) {
                categories[tool.category] = [];
            }
            categories[tool.category].push(tool);
        });
        return categories;
    },

    // Get category display name
    getCategoryDisplayName: (category) => {
        const displayNames = {
            'runtime': 'Programming Languages & Runtimes',
            'web-server': 'Web Servers',
            'database': 'Databases',
            'cache': 'Caching Systems',
            'tools': 'Development Tools',
            'utilities': 'Utilities'
        };
        return displayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    },

    // Check system requirements
    checkSystemRequirements: (tools) => {
        const requirements = {
            minDiskSpace: 0,
            minMemory: 0,
            supportedPlatforms: [],
            warnings: []
        };

        tools.forEach(tool => {
            // Calculate disk space
            const sizeMatch = tool.size.match(/(\d+(\.\d+)?)\s*MB/);
            if (sizeMatch) {
                requirements.minDiskSpace += parseFloat(sizeMatch[1]);
            }

            // Add platform-specific warnings
            if (tool.id === 'mysql' && process.platform === 'darwin') {
                requirements.warnings.push('MySQL on macOS may require additional system permissions');
            }
        });

        // Add 20% overhead for installation
        requirements.minDiskSpace *= 1.2;

        return requirements;
    }
};

// Log installation preload loaded
console.log('Installation preload script loaded');