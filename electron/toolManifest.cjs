// toolManifest.js
const path = require('path');

const manifest = {
  // Keys should match those in config.cjs downloads section
  cmder: {
    name: 'Cmder Console',
    type: 'tool', // 'service' or 'tool' (matches keys in config.cjs)
    configKey: 'cmder', // Key in config.services or config.tools
    exeRelativePath: 'Cmder.exe', // Relative to zipRootFolder or installDir if no zipRootFolder
    zipRootFolder: null, // Name of the single root folder in the ZIP, if any
    category: 'Utilities',
    description: 'Portable console emulator for Windows.',
    versionSuffix: ' (v1.3.25)' // Example, extract from URL or keep updated
  },
  apache: {
    name: 'Apache HTTP Server',
    type: 'service',
    configKey: 'apache',
    exeRelativePath: 'bin/httpd.exe',
    zipRootFolder: 'Apache24',
    configRelativePath: 'conf/httpd.conf', // For Apache's httpd.conf
    category: 'Web Server',
    description: 'Widely-used open-source web server.',
    versionSuffix: ' (2.4.x)'
  },
  php: {
    name: 'PHP Runtime',
    type: 'service',
    configKey: 'php',
    exeRelativePath: 'php.exe',
    // PHP zips usually extract to a folder like 'php-8.x.x-Win32-vsXX-x64'
    // This needs to be dynamically determined or hardcoded if version in URL is fixed
    zipRootFolderPattern: /^php-[\d.]+-Win\d+-vs\d+-x\d+$/, // Regex to find folder
    category: 'Runtime',
    description: 'Server-side scripting language.',
    versionSuffix: ' (8.4.x)' // Example
  },
  mariadb: {
    name: 'MariaDB Database',
    type: 'service',
    configKey: 'mariadb',
    exeRelativePath: 'bin/mysqld.exe',
    zipRootFolderPattern: /^mariadb-[\d.]+-winx64$/,
    category: 'Database',
    description: 'Community-developed fork of MySQL.',
    versionSuffix: ' (12.0.x)'
  },
  phpmyadmin: {
    name: 'phpMyAdmin',
    type: 'service',
    configKey: 'phpmyadmin',
    noExe: true, // Not an executable, but a directory path
    pathKey: 'path', // Which key in config.services[configKey] to update
    zipRootFolderPattern: /^phpMyAdmin-[\d.]+-all-languages$/,
    category: 'Database Tool',
    description: 'Web interface for MySQL/MariaDB.',
    versionSuffix: ' (5.2.x)'
  },
  ngrok: {
    name: 'Ngrok Tunneling',
    type: 'service',
    configKey: 'ngrok',
    exeRelativePath: 'ngrok.exe',
    zipRootFolder: null,
    category: 'Utilities',
    description: 'Secure introspectable tunnels to localhost.',
    versionSuffix: ' (v3)'
  },
  nodejs: {
    name: 'Node.js',
    type: 'tool',
    configKey: 'node',
    exeRelativePath: 'node.exe',
    zipRootFolderPattern: /^node-v[\d.]+-win-x64$/,
    category: 'Runtime',
    description: 'JavaScript runtime environment.',
    versionSuffix: ' (v22.x)' // Example
  },
  mysql: {
    name: 'MySQL Database',
    type: 'service',
    configKey: 'mysql',
    exeRelativePath: 'bin/mysqld.exe',
    zipRootFolderPattern: /^mysql-[\d.]+-winx64$/,
    category: 'Database',
    description: 'Popular open-source RDBMS.',
    versionSuffix: ' (8.0.x)'
  },
  heidisql: {
    name: 'HeidiSQL GUI',
    type: 'tool',
    configKey: 'heidisql',
    exeRelativePath: 'heidisql.exe',
    zipRootFolder: null, // Portable version often extracts files directly
    category: 'Database Tool',
    description: 'GUI for MySQL, MariaDB, SQL Server, PostgreSQL.',
    versionSuffix: ' (12.x)'
  },
  composer: {
    name: 'Composer',
    type: 'tool', // No entry in config.tools for composer exe, but can be added
    configKey: 'composer', // custom key if we add it to config.tools
    exeRelativePath: 'composer.phar',
    isPhar: true,
    zipRootFolder: null,
    category: 'PHP Tool',
    description: 'Dependency Manager for PHP.',
    versionSuffix: ' (latest)'
  },
  git: {
    name: 'Git (MinGit)',
    type: 'tool', // No entry in config.tools for git exe specifically, but can be added
    configKey: 'git', // custom key
    exeRelativePath: 'cmd/git.exe', // Path within MinGit's extracted structure
    // MinGit zip (e.g. MinGit-2.49.0-64-bit.zip) extracts files often without a single top-level dir
    // or sometimes into a dir like 'mingw64'. Check specific archive.
    // Let's assume it might extract to a folder based on filename part.
    zipRootFolder: null, // Or specific if known e.g. 'mingw64'
    // If MinGit-2.49.0-64-bit.zip extracts to a 'MinGit-2.49.0-64-bit' folder, then set that.
    // The URL implies it's 'MinGit-2.49.0-64-bit.zip'
    // Often these zips might extract directly to 'cmd/', 'usr/', 'etc/'
    // For MinGit from https://github.com/git-for-windows/git/releases/download/v2.49.0.windows.1/MinGit-2.49.0-64-bit.zip
    // it extracts directly: mingw64/cmd/git.exe, etc. So exeRelativePath should be mingw64/cmd/git.exe
    // This means `installPath/git/mingw64/cmd/git.exe`
    // Let's adjust:
    // exeRelativePath: 'mingw64/cmd/git.exe', // if `git` is the toolId folder
    // zipRootFolder: null, // if it extracts mingw64 directly into installPath/git
    // The provided MinGit typically extracts its structure (like mingw64 folder) directly.
    // So if installed to `installPath/bin/git`, then actual git.exe is `installPath/bin/git/mingw64/cmd/git.exe`
    // (Assuming `exeRelativePath` is relative to the `toolId` folder itself)
    category: 'Tool',
    description: 'Minimal Git for Windows.',
    versionSuffix: ' (2.49.x)'
  }
};

// Helper to find the actual extracted root folder name (for zips with versioned root folders)
async function findActualExtractedFolderName(baseDir, pattern) {
    if (!pattern) return null;
    try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        const folder = entries.find(entry => entry.isDirectory() && pattern.test(entry.name));
        return folder ? folder.name : null;
    } catch (err) {
        console.warn(`Error finding extracted folder in ${baseDir} with pattern ${pattern}:`, err);
        return null;
    }
}


module.exports = {
    toolManifest: manifest,
    findActualExtractedFolderName
};