// main.js - CommonJS version
const { app, BrowserWindow } = require('electron');
const { join } = require('path');
const downloadManager = require('./DownloadManager.cjs');
const ipcHandlers = require('./IPCHandlers.cjs');
const config = require('./config.cjs');


class ServerManagerApp {
    constructor() {
        this.mainWindow = null;
        this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    }

    async initialize() {
        try {
            console.log('Initializing Server Manager...');

            // Load configuration
            console.log('Loading configuration...');
            config.loadConfig();

            // Register IPC handlers
            console.log('Registering IPC handlers...');
            ipcHandlers.register();

            // Download and setup required software
            console.log('Starting download and setup process...');
            await downloadManager.downloadAll();

            console.log('Server Manager initialized successfully');
            return true;
        } catch (error) {
            console.error('Error during initialization:', error);
            return false;
        }
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: join(__dirname, 'preload.cjs'),
                sandbox: false
            },
            icon: join(__dirname, 'assets', 'icon.png'),
            show: false,
            titleBarStyle: 'default'
        });

        // Load the appropriate content
        if (this.isDev) {
            this.mainWindow.loadURL('http://localhost:3001');
        } else {
            const indexPath = join(__dirname, '../dist/index.html');
            this.mainWindow.loadFile(indexPath);
        }

        // Show window when ready to prevent visual flash
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();

            if (this.isDev) {
                this.mainWindow.webContents.openDevTools();
            }
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Handle external links
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        });

        return this.mainWindow;
    }

    setupAppEventHandlers() {
        // App ready event
        app.whenReady().then(async () => {
            console.log('Electron app ready');

            // Initialize the app
            const initialized = await this.initialize();

            if (!initialized) {
                console.error('Failed to initialize app');
                app.quit();
                return;
            }

            // Create the main window
            this.createWindow();

            // macOS specific: Re-create window when dock icon is clicked
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
            });
        });

        // Quit when all windows are closed
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // Security: Prevent new window creation
        app.on('web-contents-created', (event, contents) => {
            contents.on('new-window', (event, navigationUrl) => {
                event.preventDefault();
                require('electron').shell.openExternal(navigationUrl);
            });
        });

        // Handle app before quit
        app.on('before-quit', async (event) => {
            console.log('App is about to quit...');

            // Stop all services before quitting
            try {
                const serviceManager = require('./ServiceManager.cjs');
                await serviceManager.stopAllServices();
                console.log('All services stopped before quit');
            } catch (error) {
                console.error('Error stopping services before quit:', error);
            }
        });

        // Handle certificate errors (for development)
        app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
            if (this.isDev) {
                // In development, ignore certificate errors
                event.preventDefault();
                callback(true);
            } else {
                // In production, use default behavior
                callback(false);
            }
        });
    }

    async getAppInfo() {
        return {
            name: app.getName(),
            version: app.getVersion(),
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node,
            platform: process.platform,
            arch: process.arch,
            isDev: this.isDev,
            userDataPath: app.getPath('userData'),
            documentsPath: app.getPath('documents'),
            tempPath: app.getPath('temp')
        };
    }

    // Method to get current configuration
    getConfiguration() {
        return config.config;
    }

    // Method to handle app updates (placeholder)
    async checkForUpdates() {
        // Implement auto-updater logic here if needed
        console.log('Checking for updates...');
        return { hasUpdate: false, version: app.getVersion() };
    }
}

// Create and start the application
const serverManager = new ServerManagerApp();

// Setup event handlers
serverManager.setupAppEventHandlers();

// Export for potential testing or external access
module.exports = serverManager;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    app.quit();
});




// // main.js - Enhanced version with Installation UI
// const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// const { join } = require('path');
// const fs = require('fs').promises;
// const path = require('path');

// class ServerManagerApp {
//     constructor() {
//         this.mainWindow = null;
//         this.installationWindow = null;
//         this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
//         this.isFirstRun = false;
//         this.installationConfig = {
//             installPath: '',
//             selectedTools: [],
//             createDesktopShortcut: true,
//             createStartMenuShortcut: true,
//             addToPath: false
//         };
//     }

//     async checkFirstRun() {
//         try {
//             const userDataPath = app.getPath('userData');
//             const configPath = join(userDataPath, 'installation-config.json');
            
//             try {
//                 await fs.access(configPath);
//                 // Config exists, load it
//                 const configData = await fs.readFile(configPath, 'utf8');
//                 const savedConfig = JSON.parse(configData);
//                 this.installationConfig = { ...this.installationConfig, ...savedConfig };
//                 this.isFirstRun = false;
//             } catch (error) {
//                 // Config doesn't exist, this is first run
//                 this.isFirstRun = true;
//                 // Set default installation path
//                 this.installationConfig.installPath = join(app.getPath('documents'), 'ServerManager');
//             }
//         } catch (error) {
//             console.error('Error checking first run:', error);
//             this.isFirstRun = true;
//         }
//     }

//     async saveInstallationConfig() {
//         try {
//             const userDataPath = app.getPath('userData');
//             const configPath = join(userDataPath, 'installation-config.json');
//             await fs.writeFile(configPath, JSON.stringify(this.installationConfig, null, 2));
//         } catch (error) {
//             console.error('Error saving installation config:', error);
//         }
//     }

//     createInstallationWindow() {
//         this.installationWindow = new BrowserWindow({
//             width: 900,
//             height: 700,
//             minWidth: 800,
//             minHeight: 650,
//             resizable: false,
//             center: true,
//             modal: true,
//             webPreferences: {
//                 nodeIntegration: false,
//                 contextIsolation: true,
//                 preload: join(__dirname, 'installation-preload.cjs')
//             },
//             icon: join(__dirname, 'assets', 'icon.png'),
//             show: false,
//             titleBarStyle: 'default',
//             title: 'Server Manager - Installation Setup'
//         });

//         // Load installation UI
//         this.installationWindow.loadFile(join(__dirname, 'installation.html'));

//         this.installationWindow.once('ready-to-show', () => {
//             this.installationWindow.show();
//             // Send initial configuration to renderer
//             this.installationWindow.webContents.send('init-installation', {
//                 config: this.installationConfig,
//                 availableTools: this.getAvailableTools(),
//                 systemInfo: {
//                     platform: process.platform,
//                     arch: process.arch,
//                     userDataPath: app.getPath('userData'),
//                     documentsPath: app.getPath('documents'),
//                     desktopPath: app.getPath('desktop')
//                 }
//             });
//         });

//         this.installationWindow.on('closed', () => {
//             this.installationWindow = null;
//             // If installation was cancelled, quit the app
//             if (this.isFirstRun) {
//                 app.quit();
//             }
//         });

//         return this.installationWindow;
//     }

//     getAvailableTools() {
//         return [
//             {
//                 id: 'nodejs',
//                 name: 'Node.js Runtime',
//                 description: 'JavaScript runtime for server applications',
//                 version: '20.x LTS',
//                 size: '45 MB',
//                 required: true,
//                 category: 'runtime'
//             },
//             {
//                 id: 'nginx',
//                 name: 'Nginx Web Server',
//                 description: 'High-performance web server and reverse proxy',
//                 version: '1.24.x',
//                 size: '12 MB',
//                 required: false,
//                 category: 'web-server'
//             },
//             {
//                 id: 'apache',
//                 name: 'Apache HTTP Server',
//                 description: 'Popular open-source web server',
//                 version: '2.4.x',
//                 size: '18 MB',
//                 required: false,
//                 category: 'web-server'
//             },
//             {
//                 id: 'mysql',
//                 name: 'MySQL Database',
//                 description: 'Relational database management system',
//                 version: '8.0.x',
//                 size: '180 MB',
//                 required: false,
//                 category: 'database'
//             },
//             {
//                 id: 'postgresql',
//                 name: 'PostgreSQL Database',
//                 description: 'Advanced open-source relational database',
//                 version: '15.x',
//                 size: '85 MB',
//                 required: false,
//                 category: 'database'
//             },
//             {
//                 id: 'mongodb',
//                 name: 'MongoDB',
//                 description: 'NoSQL document database',
//                 version: '7.0.x',
//                 size: '120 MB',
//                 required: false,
//                 category: 'database'
//             },
//             {
//                 id: 'redis',
//                 name: 'Redis Cache',
//                 description: 'In-memory data structure store',
//                 version: '7.2.x',
//                 size: '15 MB',
//                 required: false,
//                 category: 'cache'
//             },
//             {
//                 id: 'php',
//                 name: 'PHP Runtime',
//                 description: 'Server-side scripting language',
//                 version: '8.2.x',
//                 size: '35 MB',
//                 required: false,
//                 category: 'runtime'
//             },
//             {
//                 id: 'python',
//                 name: 'Python Runtime',
//                 description: 'Python programming language runtime',
//                 version: '3.11.x',
//                 size: '95 MB',
//                 required: false,
//                 category: 'runtime'
//             }
//         ];
//     }

//     setupInstallationIPC() {
//         // Handle path selection
//         ipcMain.handle('select-installation-path', async () => {
//             const result = await dialog.showOpenDialog(this.installationWindow, {
//                 title: 'Select Installation Directory',
//                 defaultPath: this.installationConfig.installPath,
//                 properties: ['openDirectory', 'createDirectory']
//             });

//             if (!result.canceled && result.filePaths.length > 0) {
//                 this.installationConfig.installPath = result.filePaths[0];
//                 return result.filePaths[0];
//             }
//             return null;
//         });

//         // Handle tool selection update
//         ipcMain.handle('update-tool-selection', async (event, toolId, selected) => {
//             if (selected) {
//                 if (!this.installationConfig.selectedTools.includes(toolId)) {
//                     this.installationConfig.selectedTools.push(toolId);
//                 }
//             } else {
//                 this.installationConfig.selectedTools = this.installationConfig.selectedTools.filter(id => id !== toolId);
//             }
//             return this.installationConfig.selectedTools;
//         });

//         // Handle configuration update
//         ipcMain.handle('update-installation-config', async (event, config) => {
//             this.installationConfig = { ...this.installationConfig, ...config };
//             return this.installationConfig;
//         });

//         // Handle installation start
//         ipcMain.handle('start-installation', async (event, finalConfig) => {
//             try {
//                 this.installationConfig = { ...this.installationConfig, ...finalConfig };
                
//                 // Validate installation path
//                 if (!this.installationConfig.installPath) {
//                     throw new Error('Installation path not selected');
//                 }

//                 // Create installation directory if it doesn't exist
//                 await fs.mkdir(this.installationConfig.installPath, { recursive: true });

//                 // Save configuration
//                 await this.saveInstallationConfig();

//                 // Start the actual installation process
//                 const success = await this.performInstallation();

//                 if (success) {
//                     // Close installation window and create main window
//                     if (this.installationWindow) {
//                         this.installationWindow.close();
//                     }
//                     this.createMainWindow();
//                     return { success: true };
//                 } else {
//                     return { success: false, error: 'Installation failed' };
//                 }
//             } catch (error) {
//                 console.error('Installation error:', error);
//                 return { success: false, error: error.message };
//             }
//         });

//         // Handle installation progress updates
//         ipcMain.handle('get-installation-progress', async () => {
//             // Return current installation progress
//             return this.installationProgress || { percent: 0, status: 'Initializing...' };
//         });

//         // Handle installation cancellation
//         ipcMain.handle('cancel-installation', async () => {
//             this.cancelInstallation = true;
//             return true;
//         });
//     }

//     async performInstallation() {
//         try {
//             this.installationProgress = { percent: 0, status: 'Starting installation...' };
//             this.cancelInstallation = false;

//             const downloadManager = require('./DownloadManager.cjs');
//             const config = require('./config.cjs');

//             // Set up progress callback
//             downloadManager.setProgressCallback((progress) => {
//                 this.installationProgress = progress;
//                 if (this.installationWindow && !this.installationWindow.isDestroyed()) {
//                     this.installationWindow.webContents.send('installation-progress', progress);
//                 }
//             });

//             // Set cancellation callback
//             downloadManager.setCancellationCallback(() => this.cancelInstallation);

//             // Configure download manager with selected tools and path
//             downloadManager.configure({
//                 installPath: this.installationConfig.installPath,
//                 selectedTools: this.installationConfig.selectedTools
//             });

//             // Load main configuration
//             config.loadConfig();

//             // Start downloads
//             const success = await downloadManager.downloadAll();

//             if (success && !this.cancelInstallation) {
//                 // Create shortcuts if requested
//                 if (this.installationConfig.createDesktopShortcut) {
//                     await this.createDesktopShortcut();
//                 }

//                 if (this.installationConfig.createStartMenuShortcut) {
//                     await this.createStartMenuShortcut();
//                 }

//                 this.installationProgress = { percent: 100, status: 'Installation completed successfully!' };
//                 return true;
//             }

//             return false;
//         } catch (error) {
//             console.error('Installation error:', error);
//             this.installationProgress = { percent: 0, status: `Installation failed: ${error.message}` };
//             return false;
//         }
//     }

//     async createDesktopShortcut() {
//         try {
//             if (process.platform === 'win32') {
//                 const shell = require('electron').shell;
//                 const desktopPath = app.getPath('desktop');
//                 const shortcutPath = join(desktopPath, 'Server Manager.lnk');
                
//                 // Windows shortcut creation would require additional native modules
//                 console.log('Desktop shortcut creation requested:', shortcutPath);
//             }
//         } catch (error) {
//             console.error('Error creating desktop shortcut:', error);
//         }
//     }

//     async createStartMenuShortcut() {
//         try {
//             if (process.platform === 'win32') {
//                 // Start menu shortcut creation
//                 console.log('Start menu shortcut creation requested');
//             }
//         } catch (error) {
//             console.error('Error creating start menu shortcut:', error);
//         }
//     }

//     async initialize() {
//         try {
//             console.log('Initializing Server Manager...');

//             // Check if this is first run
//             await this.checkFirstRun();

//             if (this.isFirstRun) {
//                 // Show installation UI
//                 return false; // Don't proceed with normal initialization
//             }

//             // Load existing configuration and proceed normally
//             const config = require('./config.cjs');
//             config.loadConfig();

//             const ipcHandlers = require('./IPCHandlers.cjs');
//             ipcHandlers.register();

//             console.log('Server Manager initialized successfully');
//             return true;
//         } catch (error) {
//             console.error('Error during initialization:', error);
//             return false;
//         }
//     }

//     createMainWindow() {
//         this.mainWindow = new BrowserWindow({
//             width: 1200,
//             height: 800,
//             minWidth: 800,
//             minHeight: 600,
//             webPreferences: {
//                 nodeIntegration: false,
//                 contextIsolation: true,
//                 preload: join(__dirname, 'preload.cjs'),
//                 sandbox: false
//             },
//             icon: join(__dirname, 'assets', 'icon.png'),
//             show: false,
//             titleBarStyle: 'default'
//         });

//         // Load the appropriate content
//         if (this.isDev) {
//             this.mainWindow.loadURL('http://localhost:3001');
//         } else {
//             const indexPath = join(__dirname, '../dist/index.html');
//             this.mainWindow.loadFile(indexPath);
//         }

//         // Show window when ready to prevent visual flash
//         this.mainWindow.once('ready-to-show', () => {
//             this.mainWindow.show();

//             if (this.isDev) {
//                 this.mainWindow.webContents.openDevTools();
//             }
//         });

//         // Handle window closed
//         this.mainWindow.on('closed', () => {
//             this.mainWindow = null;
//         });

//         // Handle external links
//         this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
//             require('electron').shell.openExternal(url);
//             return { action: 'deny' };
//         });

//         return this.mainWindow;
//     }

//     setupAppEventHandlers() {
//         // App ready event
//         app.whenReady().then(async () => {
//             console.log('Electron app ready');

//             // Setup installation IPC handlers
//             this.setupInstallationIPC();

//             // Initialize the app
//             const initialized = await this.initialize();

//             if (!initialized) {
//                 if (this.isFirstRun) {
//                     // Show installation window for first run
//                     this.createInstallationWindow();
//                 } else {
//                     console.error('Failed to initialize app');
//                     app.quit();
//                 }
//                 return;
//             }

//             // Create the main window (for non-first-run)
//             this.createMainWindow();

//             // macOS specific: Re-create window when dock icon is clicked
//             app.on('activate', () => {
//                 if (BrowserWindow.getAllWindows().length === 0) {
//                     if (this.mainWindow) {
//                         this.createMainWindow();
//                     }
//                 }
//             });
//         });

//         // Quit when all windows are closed
//         app.on('window-all-closed', () => {
//             if (process.platform !== 'darwin') {
//                 app.quit();
//             }
//         });

//         // Security: Prevent new window creation
//         app.on('web-contents-created', (event, contents) => {
//             contents.on('new-window', (event, navigationUrl) => {
//                 event.preventDefault();
//                 require('electron').shell.openExternal(navigationUrl);
//             });
//         });

//         // Handle app before quit
//         app.on('before-quit', async (event) => {
//             console.log('App is about to quit...');

//             try {
//                 const serviceManager = require('./ServiceManager.cjs');
//                 await serviceManager.stopAllServices();
//                 console.log('All services stopped before quit');
//             } catch (error) {
//                 console.error('Error stopping services before quit:', error);
//             }
//         });

//         // Handle certificate errors (for development)
//         app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
//             if (this.isDev) {
//                 event.preventDefault();
//                 callback(true);
//             } else {
//                 callback(false);
//             }
//         });
//     }

//     async getAppInfo() {
//         return {
//             name: app.getName(),
//             version: app.getVersion(),
//             electronVersion: process.versions.electron,
//             nodeVersion: process.versions.node,
//             platform: process.platform,
//             arch: process.arch,
//             isDev: this.isDev,
//             userDataPath: app.getPath('userData'),
//             documentsPath: app.getPath('documents'),
//             tempPath: app.getPath('temp'),
//             installationConfig: this.installationConfig
//         };
//     }

//     getConfiguration() {
//         const config = require('./config.cjs');
//         return config.config;
//     }

//     async checkForUpdates() {
//         console.log('Checking for updates...');
//         return { hasUpdate: false, version: app.getVersion() };
//     }
// }

// // Create and start the application
// const serverManager = new ServerManagerApp();

// // Setup event handlers
// serverManager.setupAppEventHandlers();

// // Export for potential testing or external access
// module.exports = serverManager;

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (reason, promise) => {
//     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// });

// // Handle uncaught exceptions
// process.on('uncaughtException', (error) => {
//     console.error('Uncaught Exception:', error);
//     app.quit();
// });















