export type ServiceStatus = 'running' | 'stopped' | 'error';
export type ServiceType = 'php' | 'apache' | 'mysql' | 'nginx' | 'mariadb' | 'phpmyadmin';

export interface Service {
  id: ServiceType;
  name: string;
  status: ServiceStatus;
  port?: number;
  versions: string[];
  selectedVersion: string;
  icon: string;
  color: string;
}

export interface Tool {
  id: string;
  name: string;
  icon: string;
  url: string;
  description: string;
}

export interface LogEntry {
  id: string;
  service: ServiceType;
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
}

export interface WebsiteFile {
  id: string;
  name: string;
  type: 'file' | 'directory';
  size?: string;
  lastModified?: string;
  path: string;
}