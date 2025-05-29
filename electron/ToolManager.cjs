const { spawn } = require('child_process');
const { shell } = require('electron');
const fs = require('fs');
const config = require('./config.cjs');

class ToolManager {
    async openFileExplorer(path = null) {
        try {
            const targetPath = path || config.get('paths.www');
            console.log(`Opening file explorer for path: ${targetPath}`);
            
            const { shell } = await import('electron');
            await shell.openPath(targetPath);
            return true;
        } catch (error) {
            console.error('Error opening file explorer:', error);
            return false;
        }
    }

    async openCmder(workingDir = null) {
        try {
            const cmderConfig = config.get('tools.cmder');
            const cmderExe = cmderConfig.exe_path;
            
            if (!fs.existsSync(cmderExe)) {
                console.error(`Cmder executable not found: ${cmderExe}`);
                return false;
            }

            const args = [];
            if (workingDir) {
                args.push(`/START`, workingDir);
            }

            spawn(cmderExe, args, { 
                detached: true, 
                stdio: 'ignore',
                windowsHide: false 
            });
            
            console.log('Cmder opened successfully');
            return true;
        } catch (error) {
            console.error('Error opening Cmder:', error);
            return false;
        }
    }

    async openHeidiSQL() {
        try {
            const heidiConfig = config.get('tools.heidisql');
            const heidiExe = heidiConfig.exe_path;
            
            if (!fs.existsSync(heidiExe)) {
                console.error(`HeidiSQL executable not found: ${heidiExe}`);
                return false;
            }

            spawn(heidiExe, [], { 
                detached: true, 
                stdio: 'ignore',
                windowsHide: false 
            });
            
            console.log('HeidiSQL opened successfully');
            return true;
        } catch (error) {
            console.error('Error opening HeidiSQL:', error);
            return false;
        }
    }

    async openPHPMyAdmin() {
        try {
            const phpMyAdminConfig = config.getServiceConfig('phpmyadmin');
            const url = phpMyAdminConfig.url;
            
            const { shell } = await import('electron');
            await shell.openExternal(url);
            
            console.log(`PHPMyAdmin opened at: ${url}`);
            return true;
        } catch (error) {
            console.error('Error opening PHPMyAdmin:', error);
            return false;
        }
    }

    async openBrowser(url) {
        try {
            const { shell } = await import('electron');
            await shell.openExternal(url);
            
            console.log(`Browser opened with URL: ${url}`);
            return true;
        } catch (error) {
            console.error('Error opening browser:', error);
            return false;
        }
    }

    async openLocalhost(port = 80) {
        const url = `http://localhost:${port}`;
        return await this.openBrowser(url);
    }

    async openPHPServer() {
        const phpConfig = config.getServiceConfig('php');
        return await this.openLocalhost(phpConfig.port);
    }

    async openApacheServer() {
        const apacheConfig = config.getServiceConfig('apache');
        return await this.openLocalhost(apacheConfig.port);
    }

    async runNgrok(port, protocol = 'http') {
        try {
            const ngrokConfig = config.getServiceConfig('ngrok');
            const ngrokExe = ngrokConfig.exe_path;
            
            if (!fs.existsSync(ngrokExe)) {
                console.error(`Ngrok executable not found: ${ngrokExe}`);
                return false;
            }

            const args = [protocol, port.toString()];
            
            const ngrok = spawn(ngrokExe, args, {
                detached: true,
                stdio: 'pipe',
                windowsHide: false
            });

            console.log(`Ngrok started for ${protocol}://${port}`);
            return true;
        } catch (error) {
            console.error('Error running ngrok:', error);
            return false;
        }
    }

    async openNodeREPL() {
        try {
            const nodeConfig = config.get('tools.node');
            const nodeExe = nodeConfig.exe_path;
            
            if (!fs.existsSync(nodeExe)) {
                console.error(`Node.js executable not found: ${nodeExe}`);
                return false;
            }

            spawn(nodeExe, [], {
                detached: true,
                stdio: 'inherit',
                windowsHide: false
            });
            
            console.log('Node.js REPL opened');
            return true;
        } catch (error) {
            console.error('Error opening Node.js REPL:', error);
            return false;
        }
    }

    getQuickAccessUrls() {
        const apacheConfig = config.getServiceConfig('apache');
        const phpConfig = config.getServiceConfig('php');
        const phpMyAdminConfig = config.getServiceConfig('phpmyadmin');
        
        return {
            apache: `http://localhost:${apacheConfig.port}`,
            php: `http://localhost:${phpConfig.port}`,
            phpmyadmin: phpMyAdminConfig.url,
            www_folder: config.get('paths.www'),
            data_folder: config.get('paths.data')
        };
    }
}

// export default new ToolManager();
module.exports = new ToolManager();