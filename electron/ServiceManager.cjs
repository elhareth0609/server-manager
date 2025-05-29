const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const config = require('./config.cjs');

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

    startMySQL(serviceConfig) {
        if (!fs.existsSync(serviceConfig.exe_path)) {
            console.error(`MySQL executable not found: ${serviceConfig.exe_path}`);
            return false;
        }

        // Ensure data directory exists
        if (!fs.existsSync(serviceConfig.data_dir)) {
            fs.mkdirSync(serviceConfig.data_dir, { recursive: true });
        }

        // const args = [
        //     `--datadir=${serviceConfig.data_dir}`,
        //     `--port=${serviceConfig.port}`,
        //     '--console'
        // ];

        const mysql = spawn('cmd.exe', [
    '/c',
    'start',
    '""', // Title for the new window (empty to hide)
    '/min',
    `"${serviceConfig.exe_path}"`,
    `--datadir=${serviceConfig.data_dir}`,
    `--port=${serviceConfig.port}`,
    '--console'
], {
    shell: true,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
});

        // const mysql = spawn(serviceConfig.exe_path, args, {
        //     detached: true,
        //     stdio: 'ignore',
        //     windowsHide: true
        // });

        mysql.unref();
        this.runningServices.set('mysql', mysql.pid);
        console.log(`MySQL started on port ${serviceConfig.port} with data dir: ${serviceConfig.data_dir}`);
        return true;
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