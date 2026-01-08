import { contextBridge, ipcRenderer } from 'electron';
import type { IPCChannel, IPCListenerChannel } from '../types';

const validChannels: IPCChannel[] = [
  'app:get-version',
  'app:get-platform',
  'directory:select',
  'directory:verify-git',
  'clickup:get-workspaces',
  'clickup:get-spaces',
  'clickup:get-folders',
  'clickup:get-lists',
  'clickup:get-tasks',
  'tracker:start',
  'tracker:stop',
  'tracker:status',
  'tracker:all'
];

const validListenerChannels: IPCListenerChannel[] = ['app:update-available'];

/**
 * Expose protected methods that allow the renderer process to use
 * IPC and other Node.js functionality without exposing the entire object
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform information
  platform: process.platform,
  
  // Version information
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },

  // IPC methods
  ipc: {
    invoke: (channel: string, ...args: any[]): Promise<any> => {
      if (validChannels.includes(channel as IPCChannel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`Invalid IPC channel: ${channel}`);
    },
    
    on: (channel: string, callback: (...args: any[]) => void): void => {
      if (validListenerChannels.includes(channel as IPCListenerChannel)) {
        ipcRenderer.on(channel, (_event, ...args) => callback(...args));
      }
    },
    
    removeListener: (channel: string, callback: (...args: any[]) => void): void => {
      ipcRenderer.removeListener(channel, callback);
    }
  }
});

