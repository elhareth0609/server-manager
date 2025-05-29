// DownloadManager.cjs - Enhanced version with UI integration
const fs = require('fs').promises;
const fsSync = require('fs'); // For createWriteStream, createReadStream
const path = require('path');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream');
const { promisify } = require('util');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const os = require('os');

const streamPipeline = promisify(pipeline);

class DownloadManager {
  constructor() {
    this.installPath = ''; // This will be BASE_PATH/bin
    this.selectedTools = [];
    this.progressCallback = null;
    this.cancellationCallback = null; // Should be a function that returns true if cancelled
    this.currentDownloads = new Map();
    // this.downloadQueue = []; // Not used in current flow, startDownload processes one by one
    this.isDownloading = false;
    this.totalSize = 0;
    this.downloadedSize = 0;
    this.toolConfigs = {}; // Will be loaded dynamically
  }

  // New method to load tool configurations
  loadToolConfigsFromAppConfig(appDownloadsConfig, uiToolsList) {
    this.toolConfigs = {};
    for (const toolId in appDownloadsConfig) {
      if (Object.hasOwnProperty.call(appDownloadsConfig, toolId)) {
        const url = appDownloadsConfig[toolId];
        const uiToolInfo = uiToolsList.find(t => t.id === toolId);
        const toolName = uiToolInfo ? uiToolInfo.name : toolId.charAt(0).toUpperCase() + toolId.slice(1);

        this.toolConfigs[toolId] = {
          name: toolName,
          getDownloadUrl: () => url,
          install: async (downloadPath, toolSpecificInstallBaseDir) => {
            // downloadPath: path to the downloaded file (e.g., .../temp/tool.zip)
            // toolSpecificInstallBaseDir: path where this tool should be installed (e.g., BASE_PATH/bin/toolId)
            await this.ensureDirectory(toolSpecificInstallBaseDir);
            const extension = path.extname(url).toLowerCase();

            if (url.endsWith('.phar')) { // composer
              const destPath = path.join(toolSpecificInstallBaseDir, path.basename(url));
              await fs.copyFile(downloadPath, destPath);
              console.log(`Copied ${path.basename(url)} to ${toolSpecificInstallBaseDir}`);
              return toolSpecificInstallBaseDir;
            }

            switch (extension) {
              case '.zip':
                return this.extractArchive(downloadPath, toolSpecificInstallBaseDir);
              case '.gz': // .tar.gz
                 if (url.endsWith('.tar.gz')) {
                    return this.extractArchive(downloadPath, toolSpecificInstallBaseDir);
                 }
                 throw new Error(`Unsupported .gz file (not .tar.gz): ${url}`);
              case '.tgz': // Alias for .tar.gz
                return this.extractArchive(downloadPath, toolSpecificInstallBaseDir);
              case '.xz': // .tar.xz
                if (url.endsWith('.tar.xz')) {
                    return this.extractArchive(downloadPath, toolSpecificInstallBaseDir);
                }
                throw new Error(`Unsupported .xz file (not .tar.xz): ${url}`);
              case '.exe':
                // This is tricky for portable setup. EXE installers usually install globally.
                // Assuming .exe from config are installers.
                // For portable EXEs within ZIPs, they are handled by extractArchive.
                console.warn(`Running .exe installer for ${toolName}. This might install globally or require admin rights.`);
                return this.runInstaller(downloadPath); // runInstaller needs review for silent flags
              default:
                // For other file types, just copy them if no specific install logic
                const defaultDestPath = path.join(toolSpecificInstallBaseDir, path.basename(url));
                 await fs.copyFile(downloadPath, defaultDestPath);
                 console.log(`Copied ${path.basename(url)} to ${toolSpecificInstallBaseDir} as no specific installer found for ${extension}`);
                // throw new Error(`Unsupported file type for automatic installation: ${extension} from ${url}`);
                return toolSpecificInstallBaseDir;
            }
          }
        };
      }
    }
  }

  setInstallPath(path) {
    this.installPath = path; // This is expected to be BASE_PATH/bin
  }

  setSelectedTools(tools) {
    this.selectedTools = tools;
  }

  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  setCancellationCallback(callback) {
    this.cancellationCallback = callback;
  }

  async getFileSize(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const request = client.request(url, { method: 'HEAD' }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          this.getFileSize(response.headers.location).then(resolve).catch(reject);
          request.abort(); // Abort current request as we are following redirect
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP Error ${response.statusCode} for HEAD request: ${url}`));
          return;
        }
        const size = parseInt(response.headers['content-length'] || '0');
        resolve(size);
      });
      request.on('error', reject);
      request.setTimeout(15000, () => { // Increased timeout
        request.destroy(); // Use destroy instead of abort for GET/HEAD
        reject(new Error('Request timeout for getFileSize'));
      });
      request.end();
    });
  }

  async calculateTotalSize() {
    let totalSize = 0;
    for (const toolId of this.selectedTools) {
      const config = this.toolConfigs[toolId];
      if (config) {
        try {
          const url = config.getDownloadUrl();
          const size = await this.getFileSize(url);
          totalSize += size;
          if (this.progressCallback) { // Update UI about individual tool size found
            this.progressCallback({
                tool: config.name,
                statusUpdate: `Size for ${config.name}: ${(size / (1024*1024)).toFixed(2)} MB`
            });
          }
        } catch (error) {
          console.warn(`Could not get size for ${config.name} from ${config.getDownloadUrl()}: ${error.message}`);
           if (this.progressCallback) {
             this.progressCallback({
                tool: config.name,
                statusUpdate: `Could not get size for ${config.name}.`
            });
           }
        }
      }
    }
    this.totalSize = totalSize;
    if (this.progressCallback) {
        this.progressCallback({
            totalSizeCalculated: this.totalSize,
            statusUpdate: `Total download size: ${(this.totalSize / (1024*1024)).toFixed(2)} MB`
        });
    }
    return totalSize;
  }

  async downloadFile(url, filepath, toolName) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      let downloadedBytes = 0;
      
      const request = client.get(url, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`Redirecting from ${url} to ${response.headers.location}`);
          this.downloadFile(response.headers.location, filepath, toolName)
            .then(resolve)
            .catch(reject);
          request.abort(); // Abort current request as we are following redirect
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed for ${toolName}: HTTP ${response.statusCode} ${response.statusMessage} from ${url}`));
          return;
        }

        const fileSize = parseInt(response.headers['content-length'] || '0');
        const writeStream = fsSync.createWriteStream(filepath);
        
        this.currentDownloads.set(toolName, request); // Store for cancellation

        response.on('data', (chunk) => {
          if (this.cancellationCallback && this.cancellationCallback()) {
             request.destroy(); // destroy instead of abort
             writeStream.destroy();
             reject(new Error(`Download cancelled for ${toolName}`));
             return;
          }
          downloadedBytes += chunk.length;
          this.downloadedSize += chunk.length;
          
          if (this.progressCallback) {
            this.progressCallback({
              tool: toolName,
              downloaded: downloadedBytes,
              total: fileSize, // per file
              totalDownloaded: this.downloadedSize, // overall
              totalSize: this.totalSize, // overall
              percent: this.totalSize > 0 ? (this.downloadedSize / this.totalSize) * 100 : (fileSize > 0 ? (downloadedBytes/fileSize)*100 : 0),
              status: `Downloading ${toolName}... ${(downloadedBytes / (1024*1024)).toFixed(2)} MB / ${(fileSize / (1024*1024)).toFixed(2)} MB`
            });
          }
        });
        
        // Using stream.pipeline for better error handling
        streamPipeline(response, writeStream)
          .then(() => {
            this.currentDownloads.delete(toolName);
            resolve(filepath);
          })
          .catch(err => {
            this.currentDownloads.delete(toolName);
            // Ensure stream is closed on error
            if (!writeStream.destroyed) writeStream.destroy();
            reject(new Error(`Stream pipeline error for ${toolName} (${url}): ${err.message}`));
          });
      });
      
      request.on('error', (err) => {
        this.currentDownloads.delete(toolName);
        reject(new Error(`Request error for ${toolName} (${url}): ${err.message}`));
      });

      request.setTimeout(600000, () => { // 10 minutes timeout per download
        if (!request.destroyed) request.destroy();
        this.currentDownloads.delete(toolName);
        reject(new Error(`Download timeout for ${toolName} (${url})`));
      });
    });
  }

  async extractArchive(archivePath, targetPath) {
    return new Promise((resolve, reject) => {
      const ext = path.extname(archivePath).toLowerCase();
      let command;
      
      // Ensure targetPath exists
      fsSync.mkdirSync(targetPath, { recursive: true });

      console.log(`Extracting ${archivePath} to ${targetPath}`);

      switch (ext) {
        case '.zip':
          if (process.platform === 'win32') {
            command = `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${targetPath}' -Force"`;
          } else {
            command = `unzip -o "${archivePath}" -d "${targetPath}"`;
          }
          break;
        case '.gz': // Accommodate .tar.gz
        case '.tgz':
          command = `tar -xzf "${archivePath}" -C "${targetPath}"`;
          break;
        case '.xz': // Accommodate .tar.xz
          command = `tar -xJf "${archivePath}" -C "${targetPath}"`;
          break;
        default:
          reject(new Error(`Unsupported archive format: ${ext} for ${archivePath}`));
          return;
      }
      
      exec(command, {maxBuffer: 1024 * 1024 * 5}, (error, stdout, stderr) => { // 5MB buffer
        if (error) {
          console.error(`Extraction stdout: ${stdout}`);
          console.error(`Extraction stderr: ${stderr}`);
          reject(new Error(`Extraction failed for ${archivePath}: ${error.message}. Stderr: ${stderr}`));
        } else {
          console.log(`Successfully extracted ${archivePath} to ${targetPath}`);
          resolve(targetPath);
        }
      });
    });
  }

  async runInstaller(installerPath) {
    return new Promise((resolve, reject) => {
      console.log(`Running installer: ${installerPath}`);
      // Common silent flags: /S, /s, /SILENT, /VERYSILENT, -s, -q
      // This is highly installer-dependent. /S is a common one for NSIS/InnoSetup.
      // Might need a way to specify flags per tool.
      const args = ['/S', '/NORESTART']; // Example silent install flags
      
      try {
        const process = spawn(installerPath, args, {
          stdio: 'pipe',
          detached: true, // For some installers that spawn child processes and exit
          shell: true // May help with pathing and permissions on Windows
        });

        let stdout = '';
        let stderr = '';
        if(process.stdout) process.stdout.on('data', (data) => stdout += data);
        if(process.stderr) process.stderr.on('data', (data) => stderr += data);
        
        process.on('close', (code) => {
          console.log(`Installer ${installerPath} exited with code ${code}.`);
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
          if (code === 0) {
            resolve();
          } else {
            // Some installers return non-zero codes even on success with /NORESTART
            // or if a reboot is pending. For now, strict check.
            reject(new Error(`Installer ${path.basename(installerPath)} exited with code ${code}. Stderr: ${stderr}`));
          }
        });
        
        process.on('error', (err) => {
          console.error(`Failed to start installer ${installerPath}: ${err.message}`);
          reject(err);
        });

      } catch (err) {
         reject(new Error(`Spawning installer ${installerPath} failed: ${err.message}`));
      }
    });
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async cleanup(tempDir) { // Pass tempDir to cleanup
    // const tempDir = path.join(os.tmpdir(), 'dev-tools-installer'); // Don't hardcode
    try {
      console.log(`Cleaning up temporary directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true }); // fs.rm is preferred over rmdir
      console.log(`Successfully cleaned up ${tempDir}`);
    } catch (error) {
      // On Windows, files might be locked by antivirus or other processes
      console.warn(`Cleanup warning for ${tempDir}: ${error.message}. Manual cleanup might be required.`);
    }
  }

  async cancelDownloads() {
    console.log('Cancellation requested.');
    this.isDownloading = false; // Signal to stop processing new tools
    
    for (const [toolName, request] of this.currentDownloads) {
      try {
        if (request && !request.destroyed) { // Check if request exists and not already destroyed
            console.log(`Attempting to cancel download for ${toolName}`);
            request.destroy(); // destroy is preferred for client requests
        }
      } catch (error) {
        console.warn(`Error canceling download for ${toolName}: ${error.message}`);
      }
    }
    this.currentDownloads.clear();
    // this.downloadQueue = []; // Not used currently
    
    if (this.cancellationCallback) { // This callback is to CHECK if cancelled, not to notify
      // The UI should handle the "cancelled" state display
      console.log("Cancellation process finished internally.");
    }
     if (this.progressCallback) {
        this.progressCallback({
            status: 'Installation cancelled by user.',
            percent: this.totalSize > 0 ? (this.downloadedSize / this.totalSize) * 100 : 0, // last progress
            cancelled: true
        });
    }
  }

  async startDownload() {
    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }
    if (!this.installPath) { // This is BASE_PATH/bin
      throw new Error('Installation path (for binaries) not set');
    }
    if (this.selectedTools.length === 0) {
      // Allow starting with no tools if only calculating size, but for actual download, it's an issue.
      // For now, the UI should prevent this. If called programmatically, it's a warning.
      console.warn('No tools selected for download.');
      if (this.progressCallback) {
        this.progressCallback({ status: 'No tools selected.', percent: 100, completed: true });
      }
      return; // Or throw error depending on desired strictness
    }
    
    this.isDownloading = true;
    this.downloadedSize = 0;
    this.totalSize = 0; // Reset total size, will be recalculated
    
    // Create temporary directory for downloads
    const tempDir = path.join(os.tmpdir(), `dev-tools-installer-${Date.now()}`);
    await this.ensureDirectory(tempDir);
    console.log(`Temporary download directory: ${tempDir}`);

    try {
      await this.ensureDirectory(this.installPath); // Ensure BASE_PATH/bin exists
      
      if (this.progressCallback) this.progressCallback({ status: 'Calculating total download size...', percent: 0 });
      await this.calculateTotalSize();
      if (this.totalSize === 0 && this.selectedTools.length > 0) {
          console.warn("Total size is 0, but tools are selected. Files might be tiny or size check failed.");
           if (this.progressCallback) this.progressCallback({ status: 'Could not determine total size for all files. Proceeding...', percent: 0 });
      }
      
      for (const toolId of this.selectedTools) {
        if (!this.isDownloading || (this.cancellationCallback && this.cancellationCallback())) {
            await this.cancelDownloads(); // Perform cleanup actions for cancel
            break;
        }
        
        const config = this.toolConfigs[toolId];
        if (!config) {
          console.warn(`Unknown tool configuration for: ${toolId}`);
          continue;
        }
        
        try {
          if (this.progressCallback) this.progressCallback({ tool: config.name, status: `Starting download of ${config.name}...`, percent: this.totalSize > 0 ? (this.downloadedSize / this.totalSize) * 100 : 0 });
          
          const downloadUrl = config.getDownloadUrl();
          // Sanitize filename, or use toolId if basename is problematic (e.g. URLs without clear filenames)
          let fileName = path.basename(new URL(downloadUrl).pathname);
          if (!fileName || fileName === '/') { // Handle cases like 'https://site.com/latest/'
            fileName = `${toolId}${path.extname(downloadUrl) || '.download'}`;
          }
          const downloadPath = path.join(tempDir, fileName);
          const toolSpecificInstallBaseDir = path.join(this.installPath, toolId); // e.g., BASE_PATH/bin/nodejs
          
          await this.ensureDirectory(toolSpecificInstallBaseDir);
          
          await this.downloadFile(downloadUrl, downloadPath, config.name);
          
          if (!this.isDownloading || (this.cancellationCallback && this.cancellationCallback())) {
             await this.cancelDownloads();
             break;
          }
          
          if (this.progressCallback) this.progressCallback({ tool: config.name, status: `Installing ${config.name}...`, percent: this.totalSize > 0 ? (this.downloadedSize / this.totalSize) * 100 : 0});
          
          await config.install(downloadPath, toolSpecificInstallBaseDir);
          
          console.log(`${config.name} installed successfully to ${toolSpecificInstallBaseDir}`);
          if (this.progressCallback) this.progressCallback({ tool: config.name, status: `${config.name} installed.`, percent: this.totalSize > 0 ? (this.downloadedSize / this.totalSize) * 100 : 0 });
          
        } catch (error) {
          console.error(`Failed to download or install ${config.name}: ${error.message}`, error.stack);
          if (this.progressCallback) this.progressCallback({ tool: config.name, status: `Failed: ${error.message}`, error: true });
          // Optionally, re-throw to stop all installations, or continue with next tool
          // For now, continue:
          // throw error; // Uncomment to stop on first error
        }
      }
      
      if (this.isDownloading) { // If not cancelled
        console.log('All selected tools processed.');
        if (this.progressCallback) this.progressCallback({ status: 'All tools processed. Finalizing...', percent: 100, completed: true });
      }
      
    } catch (error) { // Catch errors from calculateTotalSize or initial setup
      this.isDownloading = false;
      console.error("Error during download/installation process: ", error.message, error.stack);
      if (this.progressCallback) this.progressCallback({ status: `Error: ${error.message}`, percent: 0, error: true });
      throw error; // Re-throw to be caught by main.js
    } finally {
        await this.cleanup(tempDir);
        this.isDownloading = false; // Ensure this is reset
    }
  }

  // Methods below are not directly used by the current flow but can be useful
  getAvailableTools() { // This might be redundant if main.js handles tool listing
    return Object.keys(this.toolConfigs).map(id => ({
      id,
      name: this.toolConfigs[id].name
    }));
  }
}

module.exports = DownloadManager;



// // DownloadManager.cjs - Enhanced version with UI integration
// const fs = require('fs').promises;
// const path = require('path');
// const https = require('https');
// const http = require('http');
// const { createWriteStream, createReadStream } = require('fs');
// const { pipeline } = require('stream');
// const { promisify } = require('util');
// const crypto = require('crypto');
// const { spawn, exec } = require('child_process');
// const os = require('os');

// const streamPipeline = promisify(pipeline);

// class DownloadManager {
//   constructor() {
//     this.installPath = '';
//     this.selectedTools = [];
//     this.progressCallback = null;
//     this.cancellationCallback = null;
//     this.currentDownloads = new Map();
//     this.downloadQueue = [];
//     this.isDownloading = false;
//     this.totalSize = 0;
//     this.downloadedSize = 0;

//     // Tool configurations
//     this.toolConfigs = {
//       nodejs: {
//         name: 'Node.js',
//         getDownloadUrl: () => {
//           const platform = process.platform;
//           const arch = process.arch;
//           const version = '20.11.0';
          
//           switch (platform) {
//             case 'win32':
//               return `https://nodejs.org/dist/v${version}/node-v${version}-win-${arch === 'x64' ? 'x64' : 'x86'}.zip`;
//             case 'darwin':
//               return `https://nodejs.org/dist/v${version}/node-v${version}-darwin-${arch}.tar.gz`;
//             case 'linux':
//               return `https://nodejs.org/dist/v${version}/node-v${version}-linux-${arch}.tar.xz`;
//             default:
//               throw new Error(`Unsupported platform: ${platform}`);
//           }
//         },
//         install: async (downloadPath, targetPath) => {
//           return this.extractArchive(downloadPath, targetPath);
//         }
//       },
      
//       nginx: {
//         name: 'Nginx',
//         getDownloadUrl: () => {
//           const platform = process.platform;
//           const version = '1.24.0';
          
//           switch (platform) {
//             case 'win32':
//               return `http://nginx.org/download/nginx-${version}.zip`;
//             case 'darwin':
//             case 'linux':
//               return `http://nginx.org/download/nginx-${version}.tar.gz`;
//             default:
//               throw new Error(`Unsupported platform: ${platform}`);
//           }
//         },
//         install: async (downloadPath, targetPath) => {
//           if (process.platform === 'win32') {
//             return this.extractArchive(downloadPath, targetPath);
//           } else {
//             // For Unix-like systems, compile from source
//             return this.compileNginx(downloadPath, targetPath);
//           }
//         }
//       },

//       git: {
//         name: 'Git',
//         getDownloadUrl: () => {
//           const platform = process.platform;
//           const arch = process.arch;
          
//           switch (platform) {
//             case 'win32':
//               return `https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-${arch === 'x64' ? '64' : '32'}-bit.exe`;
//             case 'darwin':
//               return `https://github.com/git/git/archive/refs/tags/v2.43.0.tar.gz`;
//             case 'linux':
//               return `https://github.com/git/git/archive/refs/tags/v2.43.0.tar.gz`;
//             default:
//               throw new Error(`Unsupported platform: ${platform}`);
//           }
//         },
//         install: async (downloadPath, targetPath) => {
//           if (process.platform === 'win32') {
//             return this.runInstaller(downloadPath);
//           } else {
//             return this.compileGit(downloadPath, targetPath);
//           }
//         }
//       },

//       python: {
//         name: 'Python',
//         getDownloadUrl: () => {
//           const platform = process.platform;
//           const arch = process.arch;
//           const version = '3.11.7';
          
//           switch (platform) {
//             case 'win32':
//               return `https://www.python.org/ftp/python/${version}/python-${version}-${arch === 'x64' ? 'amd64' : 'win32'}.exe`;
//             case 'darwin':
//               return `https://www.python.org/ftp/python/${version}/Python-${version}.tgz`;
//             case 'linux':
//               return `https://www.python.org/ftp/python/${version}/Python-${version}.tgz`;
//             default:
//               throw new Error(`Unsupported platform: ${platform}`);
//           }
//         },
//         install: async (downloadPath, targetPath) => {
//           if (process.platform === 'win32') {
//             return this.runInstaller(downloadPath);
//           } else {
//             return this.compilePython(downloadPath, targetPath);
//           }
//         }
//       },

//       vscode: {
//         name: 'Visual Studio Code',
//         getDownloadUrl: () => {
//           const platform = process.platform;
//           const arch = process.arch;
          
//           switch (platform) {
//             case 'win32':
//               return `https://update.code.visualstudio.com/latest/win32-${arch === 'x64' ? 'x64' : 'ia32'}/stable`;
//             case 'darwin':
//               return `https://update.code.visualstudio.com/latest/darwin-${arch}/stable`;
//             case 'linux':
//               return `https://update.code.visualstudio.com/latest/linux-${arch === 'x64' ? 'x64' : 'ia32'}/stable`;
//             default:
//               throw new Error(`Unsupported platform: ${platform}`);
//           }
//         },
//         install: async (downloadPath, targetPath) => {
//           if (process.platform === 'linux') {
//             return this.extractArchive(downloadPath, targetPath);
//           } else {
//             return this.runInstaller(downloadPath);
//           }
//         }
//       },

//       docker: {
//         name: 'Docker',
//         getDownloadUrl: () => {
//           const platform = process.platform;
          
//           switch (platform) {
//             case 'win32':
//               return 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';
//             case 'darwin':
//               return 'https://desktop.docker.com/mac/main/amd64/Docker.dmg';
//             case 'linux':
//               return 'https://download.docker.com/linux/static/stable/x86_64/docker-24.0.7.tgz';
//             default:
//               throw new Error(`Unsupported platform: ${platform}`);
//           }
//         },
//         install: async (downloadPath, targetPath) => {
//           if (process.platform === 'linux') {
//             return this.extractArchive(downloadPath, targetPath);
//           } else {
//             return this.runInstaller(downloadPath);
//           }
//         }
//       }
//     };
//   }

//   // Set installation path
//   setInstallPath(path) {
//     this.installPath = path;
//   }

//   // Set selected tools
//   setSelectedTools(tools) {
//     this.selectedTools = tools;
//   }

//   // Set progress callback for UI updates
//   setProgressCallback(callback) {
//     this.progressCallback = callback;
//   }

//   // Set cancellation callback
//   setCancellationCallback(callback) {
//     this.cancellationCallback = callback;
//   }

//   // Get file size from URL
//   async getFileSize(url) {
//     return new Promise((resolve, reject) => {
//       const client = url.startsWith('https') ? https : http;
      
//       const request = client.request(url, { method: 'HEAD' }, (response) => {
//         if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
//           // Handle redirects
//           this.getFileSize(response.headers.location).then(resolve).catch(reject);
//           return;
//         }
        
//         const size = parseInt(response.headers['content-length'] || '0');
//         resolve(size);
//       });
      
//       request.on('error', reject);
//       request.setTimeout(10000, () => {
//         request.destroy();
//         reject(new Error('Request timeout'));
//       });
//       request.end();
//     });
//   }

//   // Calculate total download size
//   async calculateTotalSize() {
//     let totalSize = 0;
    
//     for (const toolId of this.selectedTools) {
//       const config = this.toolConfigs[toolId];
//       if (config) {
//         try {
//           const url = config.getDownloadUrl();
//           const size = await this.getFileSize(url);
//           totalSize += size;
//         } catch (error) {
//           console.warn(`Could not get size for ${config.name}: ${error.message}`);
//         }
//       }
//     }
    
//     this.totalSize = totalSize;
//     return totalSize;
//   }

//   // Download a single file
//   async downloadFile(url, filepath, toolName) {
//     return new Promise((resolve, reject) => {
//       const client = url.startsWith('https') ? https : http;
//       let downloadedBytes = 0;
      
//       const request = client.get(url, (response) => {
//         if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
//           // Handle redirects
//           this.downloadFile(response.headers.location, filepath, toolName).then(resolve).catch(reject);
//           return;
//         }
        
//         if (response.statusCode !== 200) {
//           reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
//           return;
//         }

//         const fileSize = parseInt(response.headers['content-length'] || '0');
//         const writeStream = createWriteStream(filepath);
        
//         response.on('data', (chunk) => {
//           downloadedBytes += chunk.length;
//           this.downloadedSize += chunk.length;
          
//           if (this.progressCallback) {
//             this.progressCallback({
//               tool: toolName,
//               downloaded: downloadedBytes,
//               total: fileSize,
//               totalDownloaded: this.downloadedSize,
//               totalSize: this.totalSize,
//               percentage: this.totalSize > 0 ? (this.downloadedSize / this.totalSize) * 100 : 0
//             });
//           }
//         });
        
//         response.pipe(writeStream);
        
//         writeStream.on('finish', () => {
//           resolve(filepath);
//         });
        
//         writeStream.on('error', reject);
//       });
      
//       request.on('error', reject);
//       request.setTimeout(30000, () => {
//         request.destroy();
//         reject(new Error('Download timeout'));
//       });
      
//       // Store request for potential cancellation
//       this.currentDownloads.set(toolName, request);
//     });
//   }

//   // Extract archive files
//   async extractArchive(archivePath, targetPath) {
//     return new Promise((resolve, reject) => {
//       const ext = path.extname(archivePath).toLowerCase();
//       let command;
      
//       switch (ext) {
//         case '.zip':
//           if (process.platform === 'win32') {
//             command = `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${targetPath}' -Force"`;
//           } else {
//             command = `unzip -o "${archivePath}" -d "${targetPath}"`;
//           }
//           break;
          
//         case '.gz':
//         case '.tgz':
//           command = `tar -xzf "${archivePath}" -C "${targetPath}"`;
//           break;
          
//         case '.xz':
//           command = `tar -xJf "${archivePath}" -C "${targetPath}"`;
//           break;
          
//         default:
//           reject(new Error(`Unsupported archive format: ${ext}`));
//           return;
//       }
      
//       exec(command, (error, stdout, stderr) => {
//         if (error) {
//           reject(new Error(`Extraction failed: ${error.message}`));
//         } else {
//           resolve(targetPath);
//         }
//       });
//     });
//   }

//   // Run installer executable
//   async runInstaller(installerPath) {
//     return new Promise((resolve, reject) => {
//       const process = spawn(installerPath, ['/S'], { // Silent install flag
//         stdio: 'pipe'
//       });
      
//       process.on('close', (code) => {
//         if (code === 0) {
//           resolve();
//         } else {
//           reject(new Error(`Installer exited with code ${code}`));
//         }
//       });
      
//       process.on('error', reject);
//     });
//   }

//   // Compile Nginx from source
//   async compileNginx(sourcePath, targetPath) {
//     return new Promise((resolve, reject) => {
//       const commands = [
//         `cd "${sourcePath}"`,
//         `./configure --prefix="${targetPath}"`,
//         'make',
//         'make install'
//       ].join(' && ');
      
//       exec(commands, (error, stdout, stderr) => {
//         if (error) {
//           reject(new Error(`Nginx compilation failed: ${error.message}`));
//         } else {
//           resolve(targetPath);
//         }
//       });
//     });
//   }

//   // Compile Git from source
//   async compileGit(sourcePath, targetPath) {
//     return new Promise((resolve, reject) => {
//       const commands = [
//         `cd "${sourcePath}"`,
//         `./configure --prefix="${targetPath}"`,
//         'make',
//         'make install'
//       ].join(' && ');
      
//       exec(commands, (error, stdout, stderr) => {
//         if (error) {
//           reject(new Error(`Git compilation failed: ${error.message}`));
//         } else {
//           resolve(targetPath);
//         }
//       });
//     });
//   }

//   // Compile Python from source
//   async compilePython(sourcePath, targetPath) {
//     return new Promise((resolve, reject) => {
//       const commands = [
//         `cd "${sourcePath}"`,
//         `./configure --prefix="${targetPath}"`,
//         'make',
//         'make install'
//       ].join(' && ');
      
//       exec(commands, (error, stdout, stderr) => {
//         if (error) {
//           reject(new Error(`Python compilation failed: ${error.message}`));
//         } else {
//           resolve(targetPath);
//         }
//       });
//     });
//   }

//   // Verify file integrity using checksum
//   async verifyChecksum(filePath, expectedChecksum, algorithm = 'sha256') {
//     const fileBuffer = await fs.readFile(filePath);
//     const hash = crypto.createHash(algorithm);
//     hash.update(fileBuffer);
//     const actualChecksum = hash.digest('hex');
    
//     return actualChecksum === expectedChecksum;
//   }

//   // Create directory if it doesn't exist
//   async ensureDirectory(dirPath) {
//     try {
//       await fs.access(dirPath);
//     } catch (error) {
//       await fs.mkdir(dirPath, { recursive: true });
//     }
//   }

//   // Clean up temporary files
//   async cleanup() {
//     const tempDir = path.join(os.tmpdir(), 'dev-tools-installer');
//     try {
//       await fs.rmdir(tempDir, { recursive: true });
//     } catch (error) {
//       console.warn(`Cleanup warning: ${error.message}`);
//     }
//   }

//   // Cancel all downloads
//   async cancelDownloads() {
//     this.isDownloading = false;
    
//     // Cancel active downloads
//     for (const [toolName, request] of this.currentDownloads) {
//       try {
//         request.destroy();
//       } catch (error) {
//         console.warn(`Error canceling download for ${toolName}: ${error.message}`);
//       }
//     }
    
//     this.currentDownloads.clear();
//     this.downloadQueue = [];
    
//     if (this.cancellationCallback) {
//       this.cancellationCallback();
//     }
//   }

//   // Main download and install process
//   async startDownload() {
//     if (this.isDownloading) {
//       throw new Error('Download already in progress');
//     }
    
//     if (!this.installPath) {
//       throw new Error('Installation path not set');
//     }
    
//     if (this.selectedTools.length === 0) {
//       throw new Error('No tools selected');
//     }
    
//     this.isDownloading = true;
//     this.downloadedSize = 0;
    
//     try {
//       // Ensure installation directory exists
//       await this.ensureDirectory(this.installPath);
      
//       // Calculate total download size
//       await this.calculateTotalSize();
      
//       // Create temporary directory
//       const tempDir = path.join(os.tmpdir(), 'dev-tools-installer');
//       await this.ensureDirectory(tempDir);
      
//       // Process each selected tool
//       for (const toolId of this.selectedTools) {
//         if (!this.isDownloading) break; // Check for cancellation
        
//         const config = this.toolConfigs[toolId];
//         if (!config) {
//           console.warn(`Unknown tool: ${toolId}`);
//           continue;
//         }
        
//         try {
//           console.log(`Starting download of ${config.name}...`);
          
//           // Get download URL and generate file path
//           const downloadUrl = config.getDownloadUrl();
//           const fileName = path.basename(new URL(downloadUrl).pathname) || `${toolId}-installer`;
//           const downloadPath = path.join(tempDir, fileName);
//           const toolInstallPath = path.join(this.installPath, toolId);
          
//           // Ensure tool install directory exists
//           await this.ensureDirectory(toolInstallPath);
          
//           // Download the file
//           await this.downloadFile(downloadUrl, downloadPath, config.name);
          
//           if (!this.isDownloading) break; // Check for cancellation
          
//           console.log(`Installing ${config.name}...`);
          
//           // Install the tool
//           await config.install(downloadPath, toolInstallPath);
          
//           console.log(`${config.name} installed successfully`);
          
//         } catch (error) {
//           console.error(`Failed to install ${config.name}: ${error.message}`);
//           throw error;
//         }
//       }
      
//       // Cleanup temporary files
//       await this.cleanup();
      
//       console.log('All tools installed successfully!');
      
//     } catch (error) {
//       this.isDownloading = false;
//       throw error;
//     }
    
//     this.isDownloading = false;
//   }

//   // Get available tools
//   getAvailableTools() {
//     return Object.keys(this.toolConfigs).map(id => ({
//       id,
//       name: this.toolConfigs[id].name
//     }));
//   }

//   // Check if tool is already installed
//   async isToolInstalled(toolId) {
//     const toolPath = path.join(this.installPath, toolId);
//     try {
//       await fs.access(toolPath);
//       return true;
//     } catch (error) {
//       return false;
//     }
//   }

//   // Get installation status for all tools
//   async getInstallationStatus() {
//     const status = {};
    
//     for (const toolId of Object.keys(this.toolConfigs)) {
//       status[toolId] = await this.isToolInstalled(toolId);
//     }
    
//     return status;
//   }
// }

// module.exports = DownloadManager;

























// // DownloadManager.cjs
// const { mkdirp } = require('mkdirp');
// const axios = require('axios');
// const extract = require('extract-zip');
// const fs = require('fs');
// const { join } = require('path');
// const config = require('./config.cjs');
// const MySQLSetup = require('./MySQLSetup.cjs'); // Import MySQLSetup

// class DownloadManager {
//     constructor() {
//         this.downloads = config.get('downloads');
//         this.paths = config.get('paths');
//     }

//     async createDirectories() {
//         const directories = [
//             this.paths.www,
//             this.paths.bin,
//             this.paths.data,
//             this.paths.mysql_data,
//             this.paths.mariadb_data
//         ];

//         for (const dir of directories) {
//             await mkdirp(dir);
//             console.log(`Created directory: ${dir}`);
//         }
//     }

//     async downloadFile(url, filePath) {
//         try {
//             console.log(`Downloading from: ${url}`);
//             const response = await axios({
//                 url,
//                 responseType: 'arraybuffer',
//                 timeout: 300000 // 5 minutes timeout
//             });
            
//             fs.writeFileSync(filePath, response.data);
//             console.log(`Downloaded: ${filePath}`);
//             return true;
//         } catch (error) {
//             console.error(`Error downloading ${url}:`, error.message);
//             return false;
//         }
//     }

//     async extractAndCleanup(zipPath, extractPath) {
//         try {
//             await extract(zipPath, { dir: extractPath });
//             fs.unlinkSync(zipPath);
//             console.log(`Extracted and cleaned up: ${zipPath}`);
//             return true;
//         } catch (error) {
//             console.error(`Error extracting ${zipPath}:`, error.message);
//             return false;
//         }
//     }

//     checkExists(path) {
//         return fs.existsSync(path) && fs.readdirSync(path).length > 0;
//     }

//     async downloadCmder() {
//         const cmderPath = join(this.paths.bin, 'Cmder');
//         const cmderZip = join(cmderPath, 'cmder.zip');

//         if (this.checkExists(cmderPath)) {
//             console.log('Cmder already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading Cmder...');
//         await mkdirp(cmderPath);
        
//         if (await this.downloadFile(this.downloads.cmder, cmderZip)) {
//             return await this.extractAndCleanup(cmderZip, cmderPath);
//         }
//         return false;
//     }

//     async downloadApache() {
//         const apacheBasePath = join(this.paths.bin, 'apache');
//         const apacheZip = join(apacheBasePath, 'httpd.zip');
//         const apacheExtractedPath = join(apacheBasePath, 'Apache24');

//         if (this.checkExists(apacheExtractedPath)) {
//             console.log('Apache already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading Apache...');
//         await mkdirp(apacheBasePath);

//         if (await this.downloadFile(this.downloads.apache, apacheZip)) {
//             if (await this.extractAndCleanup(apacheZip, apacheBasePath)) {
//                 return this.configureApache(apacheExtractedPath);
//             }
//         }
//         return false;
//     }

//     configureApache(apacheExtractedPath) {
//         const confPath = join(apacheExtractedPath, 'conf', 'httpd.conf');
//         const apacheConfig = config.getServiceConfig('apache');

//         if (!fs.existsSync(confPath)) {
//             console.error('httpd.conf not found!');
//             return false;
//         }

//         try {
//             let conf = fs.readFileSync(confPath, 'utf-8');

//             conf = conf
//                 .replace(/^ServerRoot\s+".*?"/m, `ServerRoot "${apacheExtractedPath.replace(/\\/g, '/')}"`)
//                 .replace(/^DocumentRoot\s+".*?"/m, `DocumentRoot "${this.paths.www.replace(/\\/g, '/')}"`)
//                 .replace(/<Directory\s+".*?">/m, `<Directory "${this.paths.www.replace(/\\/g, '/')}">`);

//             // Set custom port if not 80
//             if (apacheConfig.port !== 80) {
//                 conf = conf.replace(/^Listen\s+80/m, `Listen ${apacheConfig.port}`);
//             }

//             fs.writeFileSync(confPath, conf, 'utf-8');
//             console.log('Apache configured successfully.');
//             return true;
//         } catch (error) {
//             console.error('Error configuring Apache:', error);
//             return false;
//         }
//     }

//     async downloadPHP() {
//         const phpPath = join(this.paths.bin, 'php', 'php-8.4.7-Win32-vs17-x64');
//         const phpZip = join(phpPath, 'php.zip');

//         if (this.checkExists(phpPath)) {
//             console.log('PHP already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading PHP...');
//         await mkdirp(phpPath);

//         if (await this.downloadFile(this.downloads.php, phpZip)) {
//             return await this.extractAndCleanup(phpZip, phpPath);
//         }
//         return false;
//     }

//         async downloadMySQL() {
//         // This is the directory where the MySQL zip's contents are extracted.
//         // e.g., C:/server-manager/bin/MySQL/
//         const mysqlBaseExtractDir = join(this.paths.bin, 'MySQL'); 
//         const mysqlZip = join(mysqlBaseExtractDir, 'mysql.zip');

//         let actualMysqlInstallationDir = this.findActualInstallDir(mysqlBaseExtractDir, 'mysql');

//         if (actualMysqlInstallationDir) {
//             console.log(`MySQL already appears to be installed at: ${actualMysqlInstallationDir}. Skipping download.`);
//             // Even if it exists, the user might want to ensure it's configured/initialized.
//             // For this request, we'll proceed to setup if it exists. If only download should be skipped,
//             // then this block would return true.
//             // The request implies "if download happens, then setup". If not, then what?
//             // Let's assume for now: if found, we can still run setup steps to ensure consistency.
//             // To strictly skip if exists: return true;
//             console.log('MySQL directory found. Proceeding with setup/initialization steps to ensure consistency.');
//         } else {
//             console.log('MySQL installation not found. Downloading MySQL...');
//             await mkdirp(mysqlBaseExtractDir); // Ensure C:/server-manager/bin/MySQL exists

//             if (!(await this.downloadFile(this.downloads.mysql, mysqlZip))) {
//                 console.error('Failed to download MySQL zip.');
//                 return false;
//             }

//             if (!(await this.extractAndCleanup(mysqlZip, mysqlBaseExtractDir))) {
//                 console.error('Failed to extract MySQL zip.');
//                 return false;
//             }
            
//             actualMysqlInstallationDir = this.findActualInstallDir(mysqlBaseExtractDir, 'mysql');
//             if (!actualMysqlInstallationDir) {
//                 console.error(`Could not find MySQL installation directory within ${mysqlBaseExtractDir} after extraction (e.g., a subfolder like "mysql-x.y.z-winx64" containing a "bin" folder).`);
//                 console.error('Please check the archive structure and ensure it extracts a root MySQL directory, or adjust findActualInstallDir.');
//                 return false;
//             }
//             console.log(`MySQL extracted to actual installation directory: ${actualMysqlInstallationDir}`);
//         }

//         // --- Setup MySQL using MySQLSetup ---
//         const mysqlServiceConfig = config.getServiceConfig('mysql');
//         if (!mysqlServiceConfig) {
//             console.error('MySQL service configuration not found in config.cjs.');
//             return false;
//         }
        
//         const mysqlSetup = new MySQLSetup({
//             baseDir: actualMysqlInstallationDir, // e.g., C:/server-manager/bin/MySQL/mysql-8.0.x-winx64
//             dataDir: mysqlServiceConfig.data_dir, // e.g., C:/server-manager/data/mysql
//             configDir: mysqlServiceConfig.config_dir, // e.g., C:/server-manager/config/mysql
//             port: mysqlServiceConfig.port,
//             bindAddress: mysqlServiceConfig.bind_address,
//             // socket: mysqlServiceConfig.socket, // Optional: MySQLSetup will derive it from baseDir if not provided
//         });

//         try {
//             console.log('Step 1: Verifying MySQL installation...');
//             await mysqlSetup.verifyInstallation();

//             console.log('Step 2: Creating MySQL directories (data, config)...');
//             await mysqlSetup.createDirectories(); 

//             console.log('Step 3: Creating MySQL configuration file (my.ini)...');
//             // true to overwrite if it exists, ensuring a fresh config for this setup run
//             await mysqlSetup.createConfigFile(true); 

//             console.log('Step 4: Initializing MySQL database...');
//             // true to force re-initialization (clears dataDir if it exists and is not empty)
//             const initResult = await mysqlSetup.initializeDatabase(true); 
//             console.log(`MySQL database initialization status: ${initResult.status}`);
//             if (initResult.tempPassword) { // Should be null with --initialize-insecure
//                 console.log(`MySQL root temporary password: ${initResult.tempPassword}`);
//             }

//             console.log('MySQL download and setup (verify, directories, config, initialize) completed successfully.');
//             return true;

//         } catch (error) {
//             console.error('Error during MySQL setup steps:', error.message, error.stack);
//             return false;
//         }
//     }



//     async downloadMySQL() {
//         const mysqlPath = join(this.paths.bin, 'MySQL');
//         const mysqlZip = join(mysqlPath, 'mysql.zip');

//         if (this.checkExists(mysqlPath)) {
//             console.log('MySQL already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading MySQL...');
//         await mkdirp(mysqlPath);

//         if (await this.downloadFile(this.downloads.mysql, mysqlZip)) {
//             if (await this.extractAndCleanup(mysqlZip, mysqlPath)) {
//                 return this.configureMysql();
//             }
//         }
//         return false;
//     }

//     configureMysql() {
//         // Create MySQL data directory
//         const mysqlConfig = config.getServiceConfig('mysql');
//         if (!fs.existsSync(mysqlConfig.data_dir)) {
//             fs.mkdirSync(mysqlConfig.data_dir, { recursive: true });
//             console.log(`Created MySQL data directory: ${mysqlConfig.data_dir}`);
//         }
//         return true;
//     }

//     async downloadMariaDB() {
//         const mariaDBPath = join(this.paths.bin, 'MariaDB', 'mariadb-12.0.0-winx64');
//         const mariaDBZip = join(mariaDBPath, 'mariadb.zip');

//         if (this.checkExists(mariaDBPath)) {
//             console.log('MariaDB already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading MariaDB...');
//         await mkdirp(mariaDBPath);

//         if (await this.downloadFile(this.downloads.mariadb, mariaDBZip)) {
//             if (await this.extractAndCleanup(mariaDBZip, mariaDBPath)) {
//                 return this.configureMariaDB();
//             }
//         }
//         return false;
//     }

//     configureMariaDB() {
//         // Create MariaDB data directory
//         const mariaConfig = config.getServiceConfig('mariadb');
//         if (!fs.existsSync(mariaConfig.data_dir)) {
//             fs.mkdirSync(mariaConfig.data_dir, { recursive: true });
//             console.log(`Created MariaDB data directory: ${mariaConfig.data_dir}`);
//         }
//         return true;
//     }

//     async downloadPHPMyAdmin() {
//         const phpMyAdminPath = join(this.paths.bin, 'phpMyAdmin');
//         const phpMyAdminZip = join(phpMyAdminPath, 'phpMyAdmin.zip');

//         if (this.checkExists(phpMyAdminPath)) {
//             console.log('PHPMyAdmin already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading PHPMyAdmin...');
//         await mkdirp(phpMyAdminPath);

//         if (await this.downloadFile(this.downloads.phpmyadmin, phpMyAdminZip)) {
//             return await this.extractAndCleanup(phpMyAdminZip, phpMyAdminPath);
//         }
//         return false;
//     }

//     async downloadNgrok() {
//         const ngrokPath = join(this.paths.bin, 'ngrok');
//         const ngrokZip = join(ngrokPath, 'ngrok.zip');

//         if (this.checkExists(ngrokPath)) {
//             console.log('Ngrok already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading Ngrok...');
//         await mkdirp(ngrokPath);

//         if (await this.downloadFile(this.downloads.ngrok, ngrokZip)) {
//             return await this.extractAndCleanup(ngrokZip, ngrokPath);
//         }
//         return false;
//     }

//     async downloadNodeJS() {
//         const nodePath = join(this.paths.bin, 'node');
//         const nodeZip = join(nodePath, 'node.zip');

//         if (this.checkExists(nodePath)) {
//             console.log('Node.js already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading Node.js...');
//         await mkdirp(nodePath);

//         if (await this.downloadFile(this.downloads.nodejs, nodeZip)) {
//             return await this.extractAndCleanup(nodeZip, nodePath);
//         }
//         return false;
//     }

//     async downloadHeidiSQL() {
//         const heidiSQLPath = join(this.paths.bin, 'HeidiSQL');
//         const heidiSQLZip = join(heidiSQLPath, 'heidisql.zip');

//         if (this.checkExists(heidiSQLPath)) {
//             console.log('HeidiSQL already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading HeidiSQL...');
//         await mkdirp(heidiSQLPath);

//         if (await this.downloadFile(this.downloads.heidisql, heidiSQLZip)) {
//             return await this.extractAndCleanup(heidiSQLZip, heidiSQLPath);
//         }
//         return false;
//     }

//     async downloadGit() {
//         const gitPath = join(this.paths.bin, 'git');
//         const gitZip = join(gitPath, 'git.zip');

//         if (this.checkExists(gitPath)) {
//             console.log('Git already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading Git (MinGit)...');
//         await mkdirp(gitPath);

//         if (await this.downloadFile(this.downloads.git, gitZip)) {
//             if (await this.extractAndCleanup(gitZip, gitPath)) {
//                 console.log('MinGit extracted successfully.');
//                 // Optional: Add a helper .bat file to make it easy to run git from cmd
//                 const batFile = join(gitPath, 'git.bat');
//                 fs.writeFileSync(batFile, `@echo off\r\n"%~dp0cmd\\git.exe" %*`, 'utf-8');
//                 console.log('Created git.bat for easier command-line usage.');
//                 return true;
//             }
//         }

//         return false;
//     }

//     async downloadComposer() {
//         const composerPath = join(this.paths.bin, 'composer');
//         const composerPhar = join(composerPath, 'composer.phar');

//         if (fs.existsSync(composerPhar)) {
//             console.log('Composer already exists. Skipping download.');
//             return true;
//         }

//         console.log('Downloading Composer...');
//         await mkdirp(composerPath);

//         if (await this.downloadFile(this.downloads.composer, composerPhar)) {
//             // Optionally create a .bat to run it like a global command
//             const batFile = join(composerPath, 'composer.bat');
//             fs.writeFileSync(batFile, `@echo off\r\nphp "%~dp0composer.phar" %*`, 'utf-8');
//             console.log('Composer setup completed.');
//             return true;
//         }

//         return false;
//     }


//     async downloadAll() {
//         try {
//             console.log('Starting download and setup process...');
            
//             await this.createDirectories();
            
//             const downloads = [
//                 this.downloadCmder(),
//                 this.downloadApache(),
//                 this.downloadPHP(),
//                 this.downloadMySQL(),
//                 this.downloadMariaDB(),
//                 this.downloadPHPMyAdmin(),
//                 this.downloadNgrok(),
//                 this.downloadNodeJS(),
//                 this.downloadHeidiSQL(),
//                 this.downloadComposer(),
//                 this.downloadGit()

//             ];

//             const results = await Promise.allSettled(downloads);
            
//             results.forEach((result, index) => {
//                 if (result.status === 'rejected') {
//                     console.error(`Download ${index} failed:`, result.reason);
//                 }
//             });

//             console.log('Setup completed successfully.');
//             return true;
//         } catch (error) {
//             console.error('Error during setup:', error);
//             return false;
//         }
//     }
// }

// // export default new DownloadManager();
// module.exports = new DownloadManager();