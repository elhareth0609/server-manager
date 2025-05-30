const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const config = require('./config.cjs');
const path = require('path');
const execAsync = promisify(exec);

class ServiceManager {
    constructor() {
        this.runningServices = new Map();
    }

    async startService(serviceName) {
        try {
            console.log(`Starting service: ${serviceName}`);
            const serviceConfig = config.getServiceConfig(serviceName);
            
            if (!serviceConfig || !serviceConfig.enabled) {
                console.log(`Service ${serviceName} is disabled or not configured`);
                return false;
            }

            switch (serviceName) {
                case 'apache':
                    return this.startApache(serviceConfig);
                case 'php':
                    return this.startPHP(serviceConfig);
                case 'mysql':
                    return this.startMySQL(serviceConfig);
                case 'mariadb':
                    return this.startMariaDB(serviceConfig);
                default:
                    console.error(`Unknown service: ${serviceName}`);
                    return false;
            }
        } catch (error) {
            console.error(`Error starting ${serviceName}:`, error);
            return false;
        }
    }

    startApache(serviceConfig) {
        if (!fs.existsSync(serviceConfig.exe_path)) {
            console.error(`Apache executable not found: ${serviceConfig.exe_path}`);
            return false;
        }

        const apache = spawn(serviceConfig.exe_path, [], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        apache.unref();
        this.runningServices.set('apache', apache.pid);
        console.log(`Apache started on port ${serviceConfig.port}`);
        return true;
    }

    startPHP(serviceConfig) {
        if (!fs.existsSync(serviceConfig.exe_path)) {
            console.error(`PHP executable not found: ${serviceConfig.exe_path}`);
            return false;
        }

        const args = [
            '-S', 
            `localhost:${serviceConfig.port}`, 
            '-t', 
            serviceConfig.document_root
        ];

        const php = spawn(serviceConfig.exe_path, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        php.unref();
        this.runningServices.set('php', php.pid);
        console.log(`PHP server started on port ${serviceConfig.port}`);
        return true;
    }

    // startMySQL(serviceConfig) {
    //     if (!fs.existsSync(serviceConfig.exe_path)) {
    //         console.error(`MySQL executable not found: ${serviceConfig.exe_path}`);
    //         return false;
    //     }

    //     // Ensure data directory exists
    //     if (!fs.existsSync(serviceConfig.data_dir)) {
    //         // fs.mkdirSync(serviceConfig.data_dir, { recursive: true });
    //         console.error(`Data directory not found: ${serviceConfig.data_dir}`);
    //         return false;
    //     }

    //     // const args = [
    //     //     `--datadir=${serviceConfig.data_dir}`,
    //     //     `--port=${serviceConfig.port}`,
    //     //     '--console'
    //     // ];

    //     const mysql = spawn('cmd.exe', [
    //         '/c',
    //         'start',
    //         '""', // Title for the new window (empty to hide)
    //         '/min',
    //         `"${serviceConfig.exe_path}"`,
    //         `--datadir=${serviceConfig.data_dir}`,
    //         `--port=${serviceConfig.port}`,
    //         '--console'
    //     ], {
    //         shell: true,
    //         detached: true,
    //         stdio: 'ignore',
    //         windowsHide: true
    //     });

    //     // const mysql = spawn(serviceConfig.exe_path, args, {
    //     //     detached: true,
    //     //     stdio: 'ignore',
    //     //     windowsHide: true
    //     // });

    //     mysql.unref();
    //     this.runningServices.set('mysql', mysql.pid);
    //     console.log(`MySQL started on port ${serviceConfig.port} with data dir: ${serviceConfig.data_dir}`);
    //     return true;
    // }

startMySQL(serviceConfig) {
    return new Promise((resolve, reject) => {
        // Validate required paths
        if (!fs.existsSync(serviceConfig.exe_path)) {
            const error = `MySQL executable not found: ${serviceConfig.exe_path}`;
            console.error(error);
            return reject(new Error(error));
        }

        if (!fs.existsSync(serviceConfig.data_dir)) {
            const error = `Data directory not found: ${serviceConfig.data_dir}`;
            console.error(error);
            return reject(new Error(error));
        }

        // Check if MySQL is already running
        if (this.runningServices.has('mysql')) {
            const existingPid = this.runningServices.get('mysql');
            try {
                process.kill(existingPid, 0); // Check if process exists
                console.log(`MySQL is already running (PID: ${existingPid})`);
                return resolve({ success: true, pid: existingPid, message: 'Already running' });
            } catch (e) {
                // Process doesn't exist, remove from map
                this.runningServices.delete('mysql');
            }
        }

        // Prepare MySQL arguments for background execution
        const args = [
            `--datadir=${serviceConfig.data_dir}`,
            `--port=${serviceConfig.port || 3306}`,
            `--log-error=${path.join(serviceConfig.log_dir || '.', 'mysql-error.log')}`,
            '--skip-networking=false',
            '--bind-address=0.0.0.0'
        ];

        // Add config file if specified
        if (serviceConfig.config_file && fs.existsSync(serviceConfig.config_file)) {
            args.unshift(`--defaults-file=${serviceConfig.config_file}`);
        }

        // Add additional MySQL options if provided
        if (serviceConfig.additional_args && Array.isArray(serviceConfig.additional_args)) {
            args.push(...serviceConfig.additional_args);
        }

        // Create log directory if it doesn't exist
        const logDir = serviceConfig.log_dir || '.';
        if (!fs.existsSync(logDir)) {
            try {
                fs.mkdirSync(logDir, { recursive: true });
            } catch (error) {
                console.error(`Failed to create log directory: ${error.message}`);
                return reject(error);
            }
        }

        // Prepare log file paths
        const outLogPath = path.join(logDir, 'mysql.out.log');
        const errLogPath = path.join(logDir, 'mysql.err.log');

        let mysql;
        let isResolved = false;
        let verificationTimeout;

        // Helper function to resolve only once
        const resolveOnce = (result) => {
            if (!isResolved) {
                isResolved = true;
                if (verificationTimeout) clearTimeout(verificationTimeout);
                resolve(result);
            }
        };

        // Helper function to reject only once
        const rejectOnce = (error) => {
            if (!isResolved) {
                isResolved = true;
                if (verificationTimeout) clearTimeout(verificationTimeout);
                reject(error);
            }
        };

        try {
            if (process.platform === 'win32') {
                // Windows-specific approach to truly hide the window
                const { exec } = require('child_process');
                const command = `"${serviceConfig.exe_path}" ${args.map(arg => `"${arg}"`).join(' ')}`;
                
                mysql = exec(command, {
                    windowsHide: true,
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    cwd: path.dirname(serviceConfig.exe_path),
                    env: { ...process.env, MYSQL_PWD: '' }
                });
                
                // Redirect output to log files
                if (mysql.stdout) {
                    mysql.stdout.pipe(fs.createWriteStream(outLogPath, { flags: 'a' }));
                }
                if (mysql.stderr) {
                    mysql.stderr.pipe(fs.createWriteStream(errLogPath, { flags: 'a' }));
                }
            } else {
                // Unix-like systems
                let out, err;
                try {
                    out = fs.openSync(outLogPath, 'a');
                    err = fs.openSync(errLogPath, 'a');
                } catch (error) {
                    console.error(`Failed to open log files: ${error.message}`);
                    return reject(error);
                }

                mysql = spawn(serviceConfig.exe_path, args, {
                    detached: true,
                    stdio: ['ignore', out, err],
                    cwd: path.dirname(serviceConfig.exe_path)
                });
            }

            // Handle process events
            mysql.on('error', (error) => {
                console.error('MySQL process error:', error);
                rejectOnce(new Error(`MySQL failed to start: ${error.message}`));
            });

            mysql.on('exit', (code, signal) => {
                if (code !== null && code !== 0) {
                    console.error(`MySQL exited with code ${code}`);
                    this.runningServices.delete('mysql');
                    if (!isResolved) {
                        rejectOnce(new Error(`MySQL exited with code ${code}`));
                    }
                }
            });

            mysql.on('close', (code) => {
                if (code !== null && code !== 0) {
                    console.error(`MySQL closed with code ${code}`);
                    this.runningServices.delete('mysql');
                }
            });

            // Store the process info
            if (mysql.pid) {
                this.runningServices.set('mysql', mysql.pid);
                mysql.unref();
                
                console.log(`MySQL started with PID ${mysql.pid} on port ${serviceConfig.port || 3306}`);
                
                // Give MySQL a moment to start up, then verify it's running
                verificationTimeout = setTimeout(async () => {
                    try {
                        const status = await this.getServiceStatus('mysql');
                        if (status === 'running') {
                            resolveOnce({ 
                                success: true, 
                                pid: mysql.pid, 
                                message: `MySQL started successfully on port ${serviceConfig.port || 3306}` 
                            });
                        } else {
                            rejectOnce(new Error('MySQL failed to start - process not found'));
                        }
                    } catch (error) {
                        rejectOnce(new Error(`MySQL startup verification failed: ${error.message}`));
                    }
                }, 3000); // Wait 3 seconds for MySQL to initialize
                
            } else {
                rejectOnce(new Error('MySQL process started but no PID available'));
            }

        } catch (error) {
            console.error('Error starting MySQL:', error);
            rejectOnce(new Error(`Failed to start MySQL: ${error.message}`));
        }
    });
}


    startMariaDB(serviceConfig) {
        if (!fs.existsSync(serviceConfig.exe_path)) {
            console.error(`MariaDB executable not found: ${serviceConfig.exe_path}`);
            return false;
        }

        // Ensure data directory exists
        if (!fs.existsSync(serviceConfig.data_dir)) {
            fs.mkdirSync(serviceConfig.data_dir, { recursive: true });
        }

        const args = [
            `--datadir=${serviceConfig.data_dir}`,
            `--port=${serviceConfig.port}`,
            '--console'
        ];

        const mariadb = spawn(serviceConfig.exe_path, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        mariadb.unref();
        this.runningServices.set('mariadb', mariadb.pid);
        console.log(`MariaDB started on port ${serviceConfig.port} with data dir: ${serviceConfig.data_dir}`);
        return true;
    }

    async stopService(serviceName) {
        try {
            console.log(`Stopping service: ${serviceName}`);
            
            switch (serviceName) {
                case 'apache':
                    return this.stopProcess('httpd.exe', 'Apache');
                case 'php':
                    return this.stopProcess('php.exe', 'PHP');
                case 'mysql':
                    return this.stopProcess('mysqld.exe', 'MySQL');
                case 'mariadb':
                    return this.stopProcess('mysqld.exe', 'MariaDB');
                default:
                    console.error(`Unknown service: ${serviceName}`);
                    return false;
            }
        } catch (error) {
            console.error(`Error stopping ${serviceName}:`, error);
            return false;
        }
    }

    async stopProcess(processName, displayName) {
        try {
            const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}"`);
            
            if (stdout.toLowerCase().includes(processName.toLowerCase())) {
                console.log(`${displayName} is running. Stopping it...`);
                await execAsync(`taskkill /IM ${processName} /F`);
                console.log(`${displayName} stopped successfully.`);
                return true;
            } else {
                console.log(`${displayName} is not running.`);
                return true;
            }
        } catch (error) {
            console.error(`Error stopping ${displayName}:`, error);
            return false;
        }
    }

    async getServiceStatus(serviceName) {
        try {
            let processName;
            
            switch (serviceName) {
                case 'apache':
                    processName = 'httpd.exe';
                    break;
                case 'php':
                    processName = 'php.exe';
                    break;
                case 'mysql':
                case 'mariadb':
                    processName = 'mysqld.exe';
                    break;
                default:
                    return 'unknown';
            }

            const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}"`);
            
            if (stdout.toLowerCase().includes(processName.toLowerCase())) {
                return 'running';
            } else {
                return 'stopped';
            }
        } catch (error) {
            console.error(`Error checking status for ${serviceName}:`, error);
            return 'unknown';
        }
    }

    async getAllServicesStatus() {
        const services = config.getAllServices();
        const statuses = {};
        
        for (const serviceName of Object.keys(services)) {
            statuses[serviceName] = await this.getServiceStatus(serviceName);
        }
        
        return statuses;
    }

    async restartService(serviceName) {
        console.log(`Restarting service: ${serviceName}`);
        await this.stopService(serviceName);
        
        // Wait a moment before starting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return await this.startService(serviceName);
    }

    async startAllEnabledServices() {
        const enabledServices = config.getEnabledServices();
        const results = {};
        
        for (const serviceName of enabledServices) {
            results[serviceName] = await this.startService(serviceName);
        }
        
        return results;
    }

    async stopAllServices() {
        const services = config.getAllServices();
        const results = {};
        
        for (const serviceName of Object.keys(services)) {
            results[serviceName] = await this.stopService(serviceName);
        }
        
        return results;
    }
}

// export default new ServiceManager();
module.exports = new ServiceManager();