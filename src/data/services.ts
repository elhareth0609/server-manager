// src/data/services.ts
import { Service } from '../types';

export const services: Service[] = [
  {
    id: 'php',
    name: 'PHP',
    status: 'stopped',
    port: 9000,
    versions: ['8.3.0', '8.2.8', '8.1.12', '7.4.30'],
    selectedVersion: '8.3.0',
    icon: 'FileCode',
    color: '#777BB3'
  },
  {
    id: 'apache',
    name: 'Apache',
    status: 'stopped',
    port: 80,
    versions: ['2.4.58', '2.4.53', '2.4.46'],
    selectedVersion: '2.4.58',
    icon: 'Server',
    color: '#D22128'
  },
  {
    id: 'mysql',
    name: 'MySQL',
    status: 'stopped',
    port: 3306,
    versions: ['8.0.33', '8.0.30', '5.7.42'],
    selectedVersion: '8.0.33',
    icon: 'Database',
    color: '#00758F'
  },
  {
    id: 'nginx',
    name: 'Nginx',
    status: 'stopped',
    port: 8080,
    versions: ['1.24.0', '1.22.1', '1.20.2'],
    selectedVersion: '1.24.0',
    icon: 'Globe',
    color: '#009639'
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    status: 'stopped',
    port: 3307,
    versions: ['11.2.0', '10.11.5', '10.6.16'],
    selectedVersion: '11.2.0',
    icon: 'Database',
    color: '#C0765A'
  },
  {
    id: 'phpmyadmin',
    name: 'phpMyAdmin',
    status: 'stopped',
    versions: ['5.2.1', '5.1.3', '5.0.4'],
    selectedVersion: '5.2.1',
    icon: 'LayoutDashboard',
    color: '#6C78AF'
  }
];

export const tools = [
  {
    id: 'phpmyadmin',
    name: 'phpMyAdmin',
    icon: 'LayoutDashboard',
    url: 'http://localhost/phpmyadmin',
    description: 'Web interface for MySQL database management',
    action: () => {
      window.electronAPI?.openPhpMyAdmin?.();
    }
  },
  {
    id: 'terminal',
    name: 'Command Line',
    icon: 'Terminal',
    url: '#',
    description: 'Open terminal/command prompt',
    action: () => {
      window.electronAPI?.openCmder?.();
    }

  },
  {
    id: 'filebrowser',
    name: 'File Explorer',
    icon: 'Folder',
    url: '#',
    description: 'Browse website files',
    action: () => {
      window.electronAPI?.openFileExplorer?.();
    }
  }
];

export const logs: LogEntry[] = [
  {
    id: '1',
    service: 'apache',
    timestamp: '2025-08-13 14:23:45',
    message: 'Apache server started on port 80',
    level: 'info'
  },
  {
    id: '2',
    service: 'php',
    timestamp: '2025-08-13 14:23:47',
    message: 'PHP 8.3.0 initialized',
    level: 'info'
  },
  {
    id: '3',
    service: 'mysql',
    timestamp: '2025-08-13 14:23:50',
    message: 'MySQL server started on port 3306',
    level: 'info'
  },
  {
    id: '4',
    service: 'apache',
    timestamp: '2025-08-13 14:24:15',
    message: 'Warning: mod_rewrite not enabled',
    level: 'warning'
  },
  {
    id: '5',
    service: 'php',
    timestamp: '2025-08-13 14:25:30',
    message: 'Failed to load extension: imagick',
    level: 'error'
  }
];

export const websiteFiles: WebsiteFile[] = [
  {
    id: '1',
    name: 'www',
    type: 'directory',
    path: '/www'
  },
  {
    id: '2',
    name: 'project1',
    type: 'directory',
    path: '/www/project1'
  },
  {
    id: '3',
    name: 'index.php',
    type: 'file',
    size: '2.4 KB',
    lastModified: '2025-08-10 09:45:12',
    path: '/www/project1/index.php'
  },
  {
    id: '4',
    name: 'styles.css',
    type: 'file',
    size: '8.7 KB',
    lastModified: '2025-08-09 16:30:22',
    path: '/www/project1/styles.css'
  },
  {
    id: '5',
    name: 'project2',
    type: 'directory',
    path: '/www/project2'
  },
  {
    id: '6',
    name: 'index.html',
    type: 'file',
    size: '1.2 KB',
    lastModified: '2025-08-12 11:20:45',
    path: '/www/project2/index.html'
  }
];