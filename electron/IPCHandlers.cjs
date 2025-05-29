const { ipcMain } = require('electron');
const serviceManager = require('./ServiceManager.cjs');
const toolManager = require('./ToolManager.cjs');
const config = require('./config.cjs');
const { c } = require('tar');

class IPCHandlers {
    register() {
        // Service Management
        ipcMain.handle('start-service', async (event, serviceName) => {
            console.log(`Request to start service: ${serviceName}`);
            return await serviceManager.startService(serviceName);
        });

        ipcMain.handle('stop-service', async (event, serviceName) => {
            console.log(`Request to stop service: ${serviceName}`);
            return await serviceManager.stopService(serviceName);
        });

        ipcMain.handle('restart-service', async (event, serviceName) => {
            console.log(`Request to restart service: ${serviceName}`);
            return await serviceManager.restartService(serviceName);
        });

        ipcMain.handle('get-service-status', async (event, serviceName) => {
            return await serviceManager.getServiceStatus(serviceName);
        });

        ipcMain.handle('get-all-services-status', async () => {
            return await serviceManager.getAllServicesStatus();
        });

        ipcMain.handle('start-all-enabled-services', async () => {
            return await serviceManager.startAllEnabledServices();
        });

        ipcMain.handle('stop-all-services', async () => {
            return await serviceManager.stopAllServices();
        });

        // Tool Management
        ipcMain.handle('open-file-explorer', async (event, path = null) => {
            console.log(`Request to open file explorer at path: ${path}`);
            return await toolManager.openFileExplorer(path);
        });

        ipcMain.handle('open-cmder', async (event, workingDir = null) => {
            console.log(`Request to open Cmder in working directory: ${workingDir}`);
            return await toolManager.openCmder(workingDir);
        });

        ipcMain.handle('open-heidisql', async () => {
            console.log('Request to open HeidiSQL');
            return await toolManager.openHeidiSQL();
        });

        ipcMain.handle('open-phpmyadmin', async () => {
            console.log('Request to open PHPMyAdmin');
            return await toolManager.openPHPMyAdmin();
        });

        ipcMain.handle('open-browser', async (event, url) => {
            console.log(`Request to open browser at URL: ${url}`);
            return await toolManager.openBrowser(url);
        });

        ipcMain.handle('open-localhost', async (event, port = 80) => {
            console.log(`Request to open localhost at port: ${port}`);
            return await toolManager.openLocalhost(port);
        });

        ipcMain.handle('open-php-server', async () => {
            return await toolManager.openPHPServer();
        });

        ipcMain.handle('open-apache-server', async () => {
            return await toolManager.openApacheServer();
        });

        ipcMain.handle('run-ngrok', async (event, port, protocol = 'http') => {
            return await toolManager.runNgrok(port, protocol);
        });

        ipcMain.handle('open-node-repl', async () => {
            return await toolManager.openNodeREPL();
        });

        ipcMain.handle('get-quick-access-urls', async () => {
            return toolManager.getQuickAccessUrls();
        });

        // Configuration Management
        ipcMain.handle('get-config', async (event, path = null) => {
            if (path) {
                return config.get(path);
            }
            return config.config;
        });

        ipcMain.handle('set-config', async (event, path, value) => {
            return config.set(path, value);
        });

        ipcMain.handle('get-service-config', async (event, serviceName) => {
            return config.getServiceConfig(serviceName);
        });

        ipcMain.handle('set-service-config', async (event, serviceName, serviceConfig) => {
            return config.setServiceConfig(serviceName, serviceConfig);
        });

        ipcMain.handle('get-all-services', async () => {
            return config.getAllServices();
        });

        ipcMain.handle('get-enabled-services', async () => {
            return config.getEnabledServices();
        });

        ipcMain.handle('save-config', async () => {
            return config.saveConfig();
        });

        ipcMain.handle('reset-config', async () => {
            // This will reset to default config
            config.config = config.mergeConfig(config.DEFAULT_CONFIG, {});
            return config.saveConfig();
        });

        // System Information
        ipcMain.handle('get-system-info', async () => {
            return {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                paths: config.get('paths'),
                timestamp: new Date().toISOString()
            };
        });

        // Service Port Management
        ipcMain.handle('check-port-available', async (event, port) => {
            // Simple port check - you might want to implement actual port checking
            return new Promise((resolve) => {
                const net = require('net');
                const server = net.createServer();
                
                server.listen(port, () => {
                    server.once('close', () => {
                        resolve(true);
                    });
                    server.close();
                });
                
                server.on('error', () => {
                    resolve(false);
                });
            });
        });

        // Log Management
        ipcMain.handle('get-service-logs', async (event, serviceName) => {
            // Placeholder for log retrieval - implement based on your logging strategy
            return `Logs for ${serviceName} - Feature to be implemented`;
        });

        console.log('IPC handlers registered successfully');
    }

    // Helper method to validate service names
    isValidService(serviceName) {
        const validServices = ['apache', 'php', 'mysql', 'mariadb', 'nginx'];
        return validServices.includes(serviceName);
    }

    // Helper method to validate paths
    isValidPath(path) {
        try {
            require('fs').accessSync(path);
            return true;
        } catch {
            return false;
        }
    }
}

// export default new IPCHandlers();
module.exports = new IPCHandlers();