// main.js - Enhanced version with Installation UI
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { join, basename } = require('path'); // Added basename
const fs = require('fs').promises;
const path = require('path'); // Already present
const ConfigManager = require('./config.cjs'); // Assuming config.cjs exports the class instance
const DownloadManager = require('./DownloadManager.cjs'); // The generic one
const { toolManifest, findActualExtractedFolderName } = require('./toolManifest.cjs');


class ServerManagerApp {
    constructor() {
        this.mainWindow = null;
        this.installationWindow = null;
        this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
        this.isFirstRun = false;
        this.installationConfig = {
            installPath: '', // This will be the BASE path chosen by user
            selectedTools: [],
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            addToPath: false
            // autoStart and minimizeToTray are UI preferences, not directly for installer backend
        };
        this.downloadManagerInstance = new DownloadManager(); // Instantiate DM
        this.cancelInstallationFlag = false; // Flag for cancellation
    }

    async checkFirstRun() {
        try {
            const userDataPath = app.getPath('userData');
            const configPath = join(userDataPath, 'installation-config.json'); // Stores UI choices
            const mainConfigPath = join(userDataPath, 'server-config.json'); // Main app config

            try {
                await fs.access(mainConfigPath); // Check if main app config exists
                // Main config exists, try to load UI choices if any
                try {
                    await fs.access(configPath);
                    const configData = await fs.readFile(configPath, 'utf8');
                    const savedUiConfig = JSON.parse(configData);
                    // Merge carefully, especially installPath if mainConfig has one already
                    this.installationConfig = { ...this.installationConfig, ...savedUiConfig };
                    if (ConfigManager.get('paths.base') && !this.installationConfig.installPath) {
                         this.installationConfig.installPath = ConfigManager.get('paths.base');
                    }

                } catch (uiError) {
                    // UI config doesn't exist, but main config does. Not strictly first run for installation.
                    // Use default install path based on main config or app default.
                     this.installationConfig.installPath = ConfigManager.get('paths.base') || join(app.getPath('documents'), 'ServerManager');
                }
                this.isFirstRun = false; // Not first run if main config exists
            } catch (error) {
                // Main config doesn't exist, this is likely first run
                this.isFirstRun = true;
                this.installationConfig.installPath = join(app.getPath('documents'), 'ServerManager');
                // Try to load UI config if it somehow exists without main config
                 try {
                    await fs.access(configPath);
                    const configData = await fs.readFile(configPath, 'utf8');
                    const savedUiConfig = JSON.parse(configData);
                    this.installationConfig = { ...this.installationConfig, ...savedUiConfig };
                 } catch (uiError) {/* ignore */}
            }
        } catch (error) {
            console.error('Error checking first run:', error);
            this.isFirstRun = true; // Fallback to first run
            this.installationConfig.installPath = join(app.getPath('documents'), 'ServerManager');
        }
    }

    async saveInstallationConfig() { // Saves UI choices for installer
        try {
            const userDataPath = app.getPath('userData');
            const configPath = join(userDataPath, 'installation-config.json');
            await fs.writeFile(configPath, JSON.stringify(this.installationConfig, null, 2));
        } catch (error) {
            console.error('Error saving installation UI config:', error);
        }
    }

    createInstallationWindow() {
        // ... (window creation code is fine)
        this.installationWindow = new BrowserWindow({
            width: 900,
            height: 700,
            minWidth: 800,
            minHeight: 650,
            resizable: true, // Allow resize for devtools
            center: true,
            // modal: true, // Modal can be problematic, ensure it's parented if used
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: join(__dirname, 'installation-preload.cjs')
            },
            icon: join(__dirname, 'assets', 'icon.png'),
            show: false,
            titleBarStyle: 'default',
            title: 'Server Manager - Installation Setup'
        });

        this.installationWindow.loadFile(join(__dirname, 'installation.html'));

        this.installationWindow.once('ready-to-show', () => {
            this.installationWindow.show();
            if (this.isDev) this.installationWindow.webContents.openDevTools();
            
            this.installationWindow.webContents.send('init-installation', {
                config: this.installationConfig,
                availableTools: this.getAvailableToolsForUI(), // Use new method
                systemInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    userDataPath: app.getPath('userData'),
                    documentsPath: app.getPath('documents'),
                    desktopPath: app.getPath('desktop')
                }
            });
        });

        this.installationWindow.on('closed', () => {
            this.installationWindow = null;
            if (this.isFirstRun && !ConfigManager.get('paths.base')) { // If cancelled during first run and main config not saved
                app.quit();
            }
        });

        return this.installationWindow;
    }

    getAvailableToolsForUI() {
        const downloadsConfig = ConfigManager.get('downloads');
        if (!downloadsConfig) return [];

        const toolsForUI = [];
        for (const toolId in downloadsConfig) {
            if (Object.hasOwnProperty.call(downloadsConfig, toolId)) {
                const manifestEntry = toolManifest[toolId];
                if (manifestEntry) {
                    toolsForUI.push({
                        id: toolId,
                        name: manifestEntry.name + (manifestEntry.versionSuffix || ''),
                        description: manifestEntry.description || 'No description available.',
                        version: manifestEntry.versionSuffix ? manifestEntry.versionSuffix.replace(/[()]/g, '').trim() : 'N/A',
                        size: 'Calculating...', // DM will update this
                        required: toolId === 'cmder', // Example: make nodejs required if present
                        category: manifestEntry.category || 'Tool'
                    });
                } else {
                     toolsForUI.push({ // Fallback for tools in downloads but not manifest
                        id: toolId,
                        name: toolId.charAt(0).toUpperCase() + toolId.slice(1),
                        description: 'No description available.',
                        version: 'N/A',
                        size: 'Calculating...',
                        required: false,
                        category: 'Misc'
                    });
                }
            }
        }
        return toolsForUI;
    }

    setupInstallationIPC() {
        // ... (selectInstallationPath, updateToolSelection, updateInstallationConfig are fine)
        ipcMain.handle('select-installation-path', async () => { /* ... as before ... */
            const result = await dialog.showOpenDialog(this.installationWindow, {
                title: 'Select Installation Directory',
                defaultPath: this.installationConfig.installPath,
                properties: ['openDirectory', 'createDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                this.installationConfig.installPath = result.filePaths[0];
                return result.filePaths[0];
            }
            return null;
        });
        ipcMain.handle('update-tool-selection', async (event, toolId, selected) => { /* ... as before ... */
             if (selected) {
                if (!this.installationConfig.selectedTools.includes(toolId)) {
                    this.installationConfig.selectedTools.push(toolId);
                }
            } else {
                // Prevent unselecting required tools, though UI should handle this
                const toolUIInfo = this.getAvailableToolsForUI().find(t => t.id === toolId);
                if (toolUIInfo && toolUIInfo.required) {
                    console.warn(`Attempted to unselect required tool: ${toolId}`);
                    // Optionally send a message back to UI to re-check the box
                    return this.installationConfig.selectedTools; 
                }
                this.installationConfig.selectedTools = this.installationConfig.selectedTools.filter(id => id !== toolId);
            }
            return this.installationConfig.selectedTools;
        });
        ipcMain.handle('update-installation-config', async (event, config) => { /* ... as before ... */
            // Filter out undefined/null from config to avoid overwriting with nothing
            const cleanConfig = {};
            for(const key in config) {
                if (config[key] !== undefined && config[key] !== null) {
                    cleanConfig[key] = config[key];
                }
            }
            this.installationConfig = { ...this.installationConfig, ...cleanConfig };
            return this.installationConfig;
        });


        ipcMain.handle('start-installation', async (event, finalUiConfig) => {
            this.cancelInstallationFlag = false; // Reset cancel flag
            try {
                this.installationConfig = { ...this.installationConfig, ...finalUiConfig };
                
                if (!this.installationConfig.installPath) {
                    throw new Error('Installation path not selected');
                }
                await fs.mkdir(this.installationConfig.installPath, { recursive: true });
                await this.saveInstallationConfig(); // Save UI choices

                const success = await this.performInstallation();

                if (success) {
                    this.isFirstRun = false; // Installation successful, not first run anymore
                    if (this.installationWindow && !this.installationWindow.isDestroyed()) {
                        // Don't close immediately, let UI show "Finish" button
                        // this.installationWindow.close(); 
                    }
                    // this.createMainWindow(); // Create main window on "Finish"
                    return { success: true };
                } else {
                    return { success: false, error: 'Installation failed or cancelled' };
                }
            } catch (error) {
                console.error('Installation error in start-installation IPC:', error);
                return { success: false, error: error.message };
            }
        });

        // ipcMain.handle('get-installation-progress', ... ) // Not needed if DM sends updates directly

        ipcMain.handle('cancel-installation', async () => {
            this.cancelInstallationFlag = true;
            if (this.downloadManagerInstance.isDownloading) {
                await this.downloadManagerInstance.cancelDownloads();
            }
            console.log("Installation cancellation requested via IPC.");
            return true;
        });
    }

    async performInstallation() {
        const baseInstallPath = this.installationConfig.installPath; // e.g., D:/MyServer
        const binPath = path.join(baseInstallPath, 'bin'); // Tools go into D:/MyServer/bin/toolId
        const wwwPath = path.join(baseInstallPath, 'www');
        const dataPath = path.join(baseInstallPath, 'data');
        const logsPath = path.join(baseInstallPath, 'logs'); // For app logs

        try {
            // Setup DownloadManager
            const downloadsConfig = ConfigManager.get('downloads');
            const uiToolsList = this.getAvailableToolsForUI();
            this.downloadManagerInstance.loadToolConfigsFromAppConfig(downloadsConfig, uiToolsList);
            this.downloadManagerInstance.setInstallPath(binPath); // Install tools into .../bin/
            this.downloadManagerInstance.setSelectedTools(this.installationConfig.selectedTools);
            
            this.downloadManagerInstance.setProgressCallback((progress) => {
                if (this.installationWindow && !this.installationWindow.isDestroyed()) {
                    this.installationWindow.webContents.send('installation-progress', progress);
                }
            });
            this.downloadManagerInstance.setCancellationCallback(() => this.cancelInstallationFlag);

            // Create essential directories
            await fs.mkdir(binPath, { recursive: true });
            await fs.mkdir(wwwPath, { recursive: true });
            await fs.mkdir(dataPath, { recursive: true });
            await fs.mkdir(logsPath, { recursive: true });


            await this.downloadManagerInstance.startDownload(); // This can throw if setup fails

            if (this.cancelInstallationFlag) {
                console.log("Installation was cancelled. Skipping configuration updates.");
                return false;
            }

            // --- Post-installation: Update ConfigManager ---
            ConfigManager.set('paths.base', baseInstallPath);
            ConfigManager.set('paths.bin', binPath);
            ConfigManager.set('paths.www', wwwPath);
            ConfigManager.set('paths.data', dataPath);
            ConfigManager.set('paths.mysql_data', path.join(dataPath, 'mysql'));
            ConfigManager.set('paths.mariadb_data', path.join(dataPath, 'mariadb'));
            ConfigManager.set('logging.file_path', path.join(logsPath, 'server-manager.log'));


            // Create data subdirectories
            await fs.mkdir(ConfigManager.get('paths.mysql_data'), { recursive: true });
            await fs.mkdir(ConfigManager.get('paths.mariadb_data'), { recursive: true });


            for (const toolId of this.installationConfig.selectedTools) {
                const manifestEntry = toolManifest[toolId];
                if (!manifestEntry || !manifestEntry.configKey) continue;

                const toolInstallDir = path.join(binPath, toolId); // e.g., D:/MyServer/bin/apache

                let actualToolRoot = toolInstallDir;
                if (manifestEntry.zipRootFolder) {
                    actualToolRoot = path.join(toolInstallDir, manifestEntry.zipRootFolder);
                } else if (manifestEntry.zipRootFolderPattern) {
                    const folderName = await findActualExtractedFolderName(toolInstallDir, manifestEntry.zipRootFolderPattern);
                    if (folderName) {
                        actualToolRoot = path.join(toolInstallDir, folderName);
                    } else {
                        console.warn(`Could not find extracted folder for ${toolId} in ${toolInstallDir} using pattern. Assuming direct extraction.`);
                    }
                }
                
                const configPathPrefix = `${manifestEntry.type}s.${manifestEntry.configKey}`;

                if (manifestEntry.noExe && manifestEntry.pathKey) {
                    ConfigManager.set(`${configPathPrefix}.${manifestEntry.pathKey}`, actualToolRoot);
                } else if (manifestEntry.exeRelativePath) {
                    const exePath = path.join(actualToolRoot, manifestEntry.exeRelativePath);
                    ConfigManager.set(`${configPathPrefix}.exe_path`, exePath);
                    
                    // Special case for Node.js npm path
                    if (toolId === 'nodejs') {
                         ConfigManager.set('tools.node.npm_path', path.join(actualToolRoot, 'npm.cmd')); // For Windows
                    }
                     // Special case for composer: if we want to store its path
                    if (toolId === 'composer') {
                        // ConfigManager.set('tools.composer.exe_path', path.join(actualToolRoot, 'composer.phar'));
                        // Add a composer entry to config.tools if desired
                    }
                }

                if (manifestEntry.configRelativePath && manifestEntry.type === 'service') { // e.g. Apache conf
                    const serviceConfigPath = path.join(actualToolRoot, manifestEntry.configRelativePath);
                    ConfigManager.set(`${configPathPrefix}.config_path`, serviceConfigPath);
                }
                // Update data_dir for services if they are defined relative to base in manifest (not current case)
                // Default data_dirs like mysql_data are already set relative to new base dataPath
            }
            
            // Update service document roots if they exist in config
            const apacheConfig = ConfigManager.getServiceConfig('apache');
            if (apacheConfig) ConfigManager.set('services.apache.document_root', wwwPath);
            const phpConfig = ConfigManager.getServiceConfig('php');
            if (phpConfig) ConfigManager.set('services.php.document_root', wwwPath);


            ConfigManager.saveConfig();
            console.log("Main configuration updated and saved.");

            // Create shortcuts if requested (implement these if needed)
            // if (this.installationConfig.createDesktopShortcut) await this.createDesktopShortcut();
            // if (this.installationConfig.createStartMenuShortcut) await this.createStartMenuShortcut();

            return true;
        } catch (error) {
            console.error('Error during performInstallation:', error);
            if (this.installationWindow && !this.installationWindow.isDestroyed()) {
                 this.installationWindow.webContents.send('installation-progress', { status: `Installation failed: ${error.message}`, error: true });
            }
            return false;
        }
    }

    // createDesktopShortcut, createStartMenuShortcut ... (as before, placeholder)

    async initialize() { // Called on app start
        try {
            console.log('Initializing Server Manager...');
            ConfigManager.loadConfig(); // Load existing or default config first
            await this.checkFirstRun(); // Sets this.isFirstRun and installationConfig.installPath

            if (this.isFirstRun || !ConfigManager.get('paths.base')) {
                // If it's first run OR main config is present but has no base path (incomplete setup)
                // Show installation UI
                return false; // Don't proceed with normal main window initialization yet
            }

            // If not first run and paths.base exists, proceed with normal app
            // const ipcHandlers = require('./IPCHandlers.cjs'); // Assuming you have this for main app
            // ipcHandlers.register();
            console.log('Server Manager initialized successfully for main app.');
            return true;
        } catch (error) {
            console.error('Error during initialization:', error);
            return false;
        }
    }

    createMainWindow() { /* ... as before ... */ }

    setupAppEventHandlers() {
        app.whenReady().then(async () => {
            console.log('Electron app ready');
            this.setupInstallationIPC(); // Always setup IPC for installer

            const initializedForMainApp = await this.initialize();

            if (!initializedForMainApp) {
                // This means isFirstRun was true, or main config was incomplete.
                // Installation window should be shown.
                this.createInstallationWindow();
            } else {
                // Normal run, create main app window
                this.createMainWindow();
            }
            // ... rest of whenReady
             app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    if (!this.isFirstRun && ConfigManager.get('paths.base')) { // Only recreate main window if not in first run setup
                        this.createMainWindow();
                    } else if (this.isFirstRun && !this.installationWindow) { // If installer was closed and it's still first run
                        this.createInstallationWindow();
                    }
                }
            });
        });
        // ... other app event handlers (window-all-closed, etc.)
         app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('before-quit', async (event) => {
            console.log('App is about to quit...');
            // try {
            //     const serviceManager = require('./ServiceManager.cjs'); // If you have this
            //     await serviceManager.stopAllServices();
            //     console.log('All services stopped before quit');
            // } catch (error) {
            //     console.error('Error stopping services before quit (ServiceManager might not be ready):', error.message);
            // }
        });
    }
    // ... getAppInfo, getConfiguration, checkForUpdates (as before)
}

const serverManager = new ServerManagerApp();
serverManager.setupAppEventHandlers();
module.exports = serverManager;

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
















// // main.js - CommonJS version
// const { app, BrowserWindow } = require('electron');
// const { join } = require('path');
// const downloadManager = require('./DownloadManager.cjs');
// const ipcHandlers = require('./IPCHandlers.cjs');
// const config = require('./config.cjs');


// class ServerManagerApp {
//     constructor() {
//         this.mainWindow = null;
//         this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
//     }

//     async initialize() {
//         try {
//             console.log('Initializing Server Manager...');

//             // Load configuration
//             console.log('Loading configuration...');
//             config.loadConfig();

//             // Register IPC handlers
//             console.log('Registering IPC handlers...');
//             ipcHandlers.register();

//             // Download and setup required software
//             console.log('Starting download and setup process...');
//             await downloadManager.downloadAll();

//             console.log('Server Manager initialized successfully');
//             return true;
//         } catch (error) {
//             console.error('Error during initialization:', error);
//             return false;
//         }
//     }

//     createWindow() {
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

//             // Initialize the app
//             const initialized = await this.initialize();

//             if (!initialized) {
//                 console.error('Failed to initialize app');
//                 app.quit();
//                 return;
//             }

//             // Create the main window
//             this.createWindow();

//             // macOS specific: Re-create window when dock icon is clicked
//             app.on('activate', () => {
//                 if (BrowserWindow.getAllWindows().length === 0) {
//                     this.createWindow();
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

//             // Stop all services before quitting
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
//                 // In development, ignore certificate errors
//                 event.preventDefault();
//                 callback(true);
//             } else {
//                 // In production, use default behavior
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
//             tempPath: app.getPath('temp')
//         };
//     }

//     // Method to get current configuration
//     getConfiguration() {
//         return config.config;
//     }

//     // Method to handle app updates (placeholder)
//     async checkForUpdates() {
//         // Implement auto-updater logic here if needed
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




// // import { app, BrowserWindow } from 'electron';
// // import { join, dirname } from 'path';
// // import { fileURLToPath } from 'url';
// // import downloadManager from './downloadManager.js';
// // import ipcHandlers from './ipcHandlers.js';
// // import config from './config.js';

// // const __filename = fileURLToPath(import.meta.url);
// // const __dirname = dirname(__filename);

// // class ServerManagerApp {
// //     constructor() {
// //         this.mainWindow = null;
// //         this.isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
// //     }

// //     async initialize() {
// //         try {
// //             console.log('Initializing Server Manager...');
            
// //             // Load configuration
// //             console.log('Loading configuration...');
// //             config.loadConfig();
            
// //             // Register IPC handlers
// //             console.log('Registering IPC handlers...');
// //             ipcHandlers.register();
            
// //             // Download and setup required software
// //             console.log('Starting download and setup process...');
// //             await downloadManager.downloadAll();
            
// //             console.log('Server Manager initialized successfully');
// //             return true;
// //         } catch (error) {
// //             console.error('Error during initialization:', error);
// //             return false;
// //         }
// //     }

// //     createWindow() {
// //         this.mainWindow = new BrowserWindow({
// //             width: 1200,
// //             height: 800,
// //             minWidth: 800,
// //             minHeight: 600,
// //             webPreferences: {
// //                 nodeIntegration: false,
// //                 contextIsolation: true,
// //                 preload: join(__dirname, 'preload.js'),
// //                 sandbox: false
// //             },
// //             icon: join(__dirname, 'assets', 'icon.png'), // Add your app icon
// //             show: false, // Don't show until ready
// //             titleBarStyle: 'default'
// //         });

// //         // Load the appropriate content
// //         if (this.isDev) {
// //             this.mainWindow.loadURL('http://localhost:3001');
// //             this.mainWindow.webContents.openDevTools();
// //         } else {
// //             const indexPath = join(__dirname, '../dist/index.html');
// //             this.mainWindow.loadFile(indexPath);
// //         }

// //         // Show window when ready to prevent visual flash
// //         this.mainWindow.once('ready-to-show', () => {
// //             this.mainWindow.show();
            
// //             if (this.isDev) {
// //                 this.mainWindow.webContents.openDevTools();
// //             }
// //         });

// //         // Handle window closed
// //         this.mainWindow.on('closed', () => {
// //             this.mainWindow = null;
// //         });

// //         // Handle external links
// //         this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
// //             require('electron').shell.openExternal(url);
// //             return { action: 'deny' };
// //         });

// //         return this.mainWindow;
// //     }

// //     setupAppEventHandlers() {
// //         // App ready event
// //         app.whenReady().then(async () => {
// //             console.log('Electron app ready');
            
// //             // Initialize the app
// //             const initialized = await this.initialize();
            
// //             if (!initialized) {
// //                 console.error('Failed to initialize app');
// //                 app.quit();
// //                 return;
// //             }
            
// //             // Create the main window
// //             this.createWindow();
            
// //             // macOS specific: Re-create window when dock icon is clicked
// //             app.on('activate', () => {
// //                 if (BrowserWindow.getAllWindows().length === 0) {
// //                     this.createWindow();
// //                 }
// //             });
// //         });

// //         // Quit when all windows are closed
// //         app.on('window-all-closed', () => {
// //             if (process.platform !== 'darwin') {
// //                 app.quit();
// //             }
// //         });

// //         // Security: Prevent new window creation
// //         app.on('web-contents-created', (event, contents) => {
// //             contents.on('new-window', (event, navigationUrl) => {
// //                 event.preventDefault();
// //                 require('electron').shell.openExternal(navigationUrl);
// //             });
// //         });

// //         // Handle app before quit
// //         app.on('before-quit', async (event) => {
// //             console.log('App is about to quit...');
            
// //             // Stop all services before quitting
// //             try {
// //                 const serviceManager = await import('./serviceManager.js');
// //                 await serviceManager.default.stopAllServices();
// //                 console.log('All services stopped before quit');
// //             } catch (error) {
// //                 console.error('Error stopping services before quit:', error);
// //             }
// //         });

// //         // Handle certificate errors (for development)
// //         app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
// //             if (this.isDev) {
// //                 // In development, ignore certificate errors
// //                 event.preventDefault();
// //                 callback(true);
// //             } else {
// //                 // In production, use default behavior
// //                 callback(false);
// //             }
// //         });
// //     }

// //     async getAppInfo() {
// //         return {
// //             name: app.getName(),
// //             version: app.getVersion(),
// //             electronVersion: process.versions.electron,
// //             nodeVersion: process.versions.node,
// //             platform: process.platform,
// //             arch: process.arch,
// //             isDev: this.isDev,
// //             userDataPath: app.getPath('userData'),
// //             documentsPath: app.getPath('documents'),
// //             tempPath: app.getPath('temp')
// //         };
// //     }

// //     // Method to get current configuration
// //     getConfiguration() {
// //         return config.config;
// //     }

// //     // Method to handle app updates (placeholder)
// //     async checkForUpdates() {
// //         // Implement auto-updater logic here if needed
// //         console.log('Checking for updates...');
// //         return { hasUpdate: false, version: app.getVersion() };
// //     }
// // }

// // // Create and start the application
// // const serverManager = new ServerManagerApp();

// // // Setup event handlers
// // serverManager.setupAppEventHandlers();

// // // Export for potential testing or external access
// // export default serverManager;

// // // Handle unhandled promise rejections
// // process.on('unhandledRejection', (reason, promise) => {
// //     console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// // });

// // // Handle uncaught exceptions
// // process.on('uncaughtException', (error) => {
// //     console.error('Uncaught Exception:', error);
// //     app.quit();
// // });