import React, { useState } from 'react';
import { WebsiteFile } from '../types';
import * as LucideIcons from 'lucide-react';

interface FilesTabProps {
  files: WebsiteFile[];
}

const FilesTab: React.FC<FilesTabProps> = ({ files }) => {
  const [currentPath, setCurrentPath] = useState('/www');
  const [selectedFile, setSelectedFile] = useState<WebsiteFile | null>(null);
  
  // Filter files for current directory
  const currentPathFiles = files.filter(file => {
    const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
    return parentPath === currentPath;
  });
  
  const navigateToFolder = (file: WebsiteFile) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path);
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
    }
  };
  
  const navigateUp = () => {
    if (currentPath === '/www') return;
    
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    setCurrentPath(parentPath);
    setSelectedFile(null);
  };
  
  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return [
      { name: 'www', path: '/www' },
      ...parts.slice(1).map((part, index) => {
        const path = '/' + parts.slice(0, index + 2).join('/');
        return { name: part, path };
      })
    ];
  };
  
  const getFileIcon = (file: WebsiteFile) => {
    if (file.type === 'directory') {
      return <LucideIcons.Folder size={20} className="text-yellow-500" />;
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'php':
        return <LucideIcons.FileCode size={20} className="text-blue-400" />;
      case 'html':
      case 'htm':
        return <LucideIcons.FileText size={20} className="text-orange-400" />;
      case 'css':
        return <LucideIcons.FileCode size={20} className="text-pink-400" />;
      case 'js':
        return <LucideIcons.FileCode size={20} className="text-yellow-400" />;
      case 'json':
        return <LucideIcons.FileJson size={20} className="text-green-400" />;
      case 'jpg':
      case 'png':
      case 'gif':
      case 'svg':
        return <LucideIcons.Image size={20} className="text-purple-400" />;
      default:
        return <LucideIcons.File size={20} className="text-gray-400" />;
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">File Browser</h2>
        <div className="flex space-x-2">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center">
            <LucideIcons.Upload className="mr-2" size={16} />
            Upload
          </button>
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors flex items-center">
            <LucideIcons.FolderPlus className="mr-2" size={16} />
            New Folder
          </button>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
        <div className="p-3 flex items-center border-b border-gray-700">
          <button 
            onClick={navigateUp}
            disabled={currentPath === '/www'}
            className={`p-2 rounded-md ${
              currentPath === '/www' 
                ? 'text-gray-500 cursor-not-allowed' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <LucideIcons.ArrowLeft size={16} />
          </button>
          
          <div className="flex items-center ml-2 overflow-x-auto">
            {getBreadcrumbs().map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && (
                  <LucideIcons.ChevronRight size={16} className="text-gray-500 mx-1" />
                )}
                <button
                  onClick={() => setCurrentPath(crumb.path)}
                  className="px-2 py-1 text-sm text-gray-300 hover:text-white rounded hover:bg-gray-700"
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-4">
          {currentPathFiles.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <LucideIcons.FolderOpen size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">This folder is empty</p>
            </div>
          ) : (
            currentPathFiles.map(file => (
              <div 
                key={file.id}
                onClick={() => navigateToFolder(file)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedFile?.id === file.id
                    ? 'bg-blue-900/30 border-blue-500'
                    : 'border-gray-700 hover:border-gray-600 hover:bg-gray-750'
                }`}
              >
                <div className="flex items-center">
                  {getFileIcon(file)}
                  <span className="ml-2 text-gray-300 truncate">{file.name}</span>
                </div>
                {file.type === 'file' && (
                  <div className="mt-2 flex justify-between">
                    <span className="text-xs text-gray-500">{file.size}</span>
                    <span className="text-xs text-gray-500">
                      {file.lastModified?.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      {selectedFile && selectedFile.type === 'file' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="border-b border-gray-700 px-4 py-3 flex justify-between items-center">
            <div className="flex items-center">
              {getFileIcon(selectedFile)}
              <h3 className="text-white font-medium ml-2">{selectedFile.name}</h3>
            </div>
            <div className="flex space-x-2">
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 text-sm rounded transition-colors">
                Edit
              </button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm rounded transition-colors">
                Download
              </button>
            </div>
          </div>
          <div className="p-4 bg-gray-900 text-gray-300 font-mono text-sm overflow-auto max-h-64">
            <p>// File preview would appear here</p>
            <p>// This is a simulation of file content</p>
            <p>{`// ${selectedFile.name} (${selectedFile.size})`}</p>
            <p>// Last modified: {selectedFile.lastModified}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilesTab;