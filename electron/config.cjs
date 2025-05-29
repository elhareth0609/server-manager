// config.cjs
const fs = require('fs');
const { join } = require('path');

const CONFIG_FILE = join(__dirname, 'server-config.json');

// Default configuration
const DEFAULT_CONFIG = {
    paths: {
        base: 'C:/server-manager',
        www: 'C:/server-manager/www',
        bin: 'C:/server-manager/bin',
        data: 'C:/server-manager/data',
        mysql_data: 'C:/server-manager/data/mysql',
        mariadb_data: 'C:/server-manager/data/mariadb'
    },
    services: {
        apache: {
            port: 80,
            enabled: true,
            exe_path: 'C:/server-manager/bin/apache/Apache24/bin/httpd.exe',
            config_path: 'C:/server-manager/bin/apache/Apache24/conf/httpd.conf'
        },
        php: {
            port: 8000,
            enabled: true,
            exe_path: 'C:/server-manager/bin/php/php-8.4.7-Win32-vs17-x64/php.exe',
            document_root: 'C:/server-manager/www'
        },
        mysql: {
            port: 3306,
            enabled: true,
            exe_path: 'C:/server-manager/bin/MySQL/mysql-8.0.42-winx64/bin/mysqld.exe',
            data_dir: 'C:/server-manager/data/mysql',
            socket: 'C:/server-manager/data/mysql/mysql.sock'
        },
        mariadb: {
            port: 3307,
            enabled: false,
            exe_path: 'C:/server-manager/bin/MariaDB/mariadb-12.0.0-winx64/bin/mysqld.exe',
            data_dir: 'C:/server-manager/data/mariadb',
            socket: 'C:/server-manager/data/mariadb/mariadb.sock'
        },
        phpmyadmin: {
            port: 8080,
            enabled: true,
            path: 'C:/server-manager/bin/phpMyAdmin',
            url: 'http://localhost:8080/phpmyadmin'
        },
        ngrok: {
            enabled: true,
            exe_path: 'C:/server-manager/bin/ngrok/ngrok.exe',
            auth_token: ''
        }
    },
    tools: {
        cmder: {
            exe_path: 'C:/server-manager/bin/Cmder/Cmder.exe'
        },
        heidisql: {
            exe_path: 'C:/server-manager/bin/HeidiSQL/heidisql.exe'
        },
        node: {
            exe_path: 'C:/server-manager/bin/node/node-v22.16.0-win-x64/node.exe'
        }
    },
    downloads: {
        cmder: 'https://github.com/cmderdev/cmder/releases/download/v1.3.25/cmder.zip',
        apache: 'https://www.apachelounge.com/download/VS17/binaries/httpd-2.4.63-250207-win64-VS17.zip',
        php: 'https://windows.php.net/downloads/releases/php-8.4.7-Win32-vs17-x64.zip',
        mariadb: 'https://archive.mariadb.org//mariadb-12.0.0/winx64-packages/mariadb-12.0.0-winx64.zip',
        phpmyadmin: 'https://files.phpmyadmin.net/phpMyAdmin/5.2.2/phpMyAdmin-5.2.2-all-languages.zip',
        ngrok: 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip',
        nodejs: 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip',
        mysql: 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.42-winx64.zip',
        heidisql: 'https://www.heidisql.com/downloads/releases/HeidiSQL_12.10_32_Portable.zip',
        composer: 'https://getcomposer.org/download/latest-stable/composer.phar',
        git: 'https://github.com/git-for-windows/git/releases/download/v2.49.0.windows.1/MinGit-2.49.0-64-bit.zip'

    }
};

class ConfigManager {
    constructor() {
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const configData = fs.readFileSync(CONFIG_FILE, 'utf-8');
                const loadedConfig = JSON.parse(configData);
                return this.mergeConfig(DEFAULT_CONFIG, loadedConfig);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        
        // Return default config and save it
        this.saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
    }

    mergeConfig(defaultConfig, userConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));
        
        for (const key in userConfig) {
            if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
                merged[key] = { ...merged[key], ...userConfig[key] };
            } else {
                merged[key] = userConfig[key];
            }
        }
        
        return merged;
    }

    saveConfig(config = this.config) {
        try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
            this.config = config;
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    get(path) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return null;
            }
            current = current[key];
        }
        
        return current;
    }

    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        for (const key of keys) {
            if (!current[key]) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
        return this.saveConfig();
    }

    getServiceConfig(serviceName) {
        return this.get(`services.${serviceName}`);
    }

    setServiceConfig(serviceName, config) {
        return this.set(`services.${serviceName}`, config);
    }

    getAllServices() {
        return this.get('services');
    }

    getEnabledServices() {
        const services = this.getAllServices();
        return Object.keys(services).filter(name => services[name].enabled);
    }
}

// export default new ConfigManager();
module.exports = new ConfigManager();