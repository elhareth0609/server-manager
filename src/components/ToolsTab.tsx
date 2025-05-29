import React from 'react';
import { Tool } from '../types';
import * as LucideIcons from 'lucide-react';

interface ToolsTabProps {
  tools: Tool[];
}

const ToolsTab: React.FC<ToolsTabProps> = ({ tools }) => {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Tools & Utilities</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {tools.map(tool => {
          const IconComponent = LucideIcons[tool.icon as keyof typeof LucideIcons];
          return (
            <a
              key={tool.id}
              href={tool.url}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all hover:shadow-lg group"
            >
              <div className="flex items-center mb-4">
                <div className="p-3 rounded-md bg-gray-700 mr-4 group-hover:bg-blue-500 transition-colors">
                  <IconComponent size={24} className="text-gray-300 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-medium text-white">{tool.name}</h3>
              </div>
              <p className="text-gray-400 mb-4">{tool.description}</p>
              <div className="flex justify-end">
                <div className="inline-flex items-center text-blue-400 group-hover:text-blue-300">
                  <span className="mr-1">Open</span>
                  <LucideIcons.ExternalLink size={16} />
                </div>
              </div>
            </a>
          );
        })}
      </div>
      
      <h3 className="text-xl font-medium text-white mb-4">Additional Utilities</h3>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Utility</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <LucideIcons.Webhook size={20} className="text-indigo-400 mr-3" />
                  <span className="text-white">PHP Composer</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-300">Dependency manager for PHP</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs rounded-full bg-green-900 text-green-300">Installed</span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-blue-400 hover:text-blue-300">Run</button>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <LucideIcons.Terminal size={20} className="text-gray-400 mr-3" />
                  <span className="text-white">WP-CLI</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-300">WordPress command-line interface</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs rounded-full bg-gray-700 text-gray-300">Not installed</span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-blue-400 hover:text-blue-300">Install</button>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <LucideIcons.GitBranch size={20} className="text-green-400 mr-3" />
                  <span className="text-white">Git</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-gray-300">Version control system</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs rounded-full bg-green-900 text-green-300">Installed</span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-blue-400 hover:text-blue-300">Open</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ToolsTab;