import { ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import ClickUpAPI from '../services/ClickUpAPI.js';
import TrackerService from '../services/TrackerService.js';
import logger from '../utils/logger.js';
import type { DirectorySelectResult, GitVerificationResult, ClickUpAPIResponse } from '../../types/index.js';

const execAsync = promisify(exec);

class IPCHandlers {
  private initialized: boolean = false;

  /**
   * Initialize all IPC handlers
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('IPC handlers already initialized');
      return;
    }

    this.setupDirectoryHandlers();
    this.setupClickUpHandlers();
    this.setupTrackerHandlers();
    this.initialized = true;
    logger.info('IPC handlers initialized');
  }

  /**
   * Set up directory selection IPC handlers
   */
  private setupDirectoryHandlers(): void {
    // Handle directory selection dialog
    ipcMain.handle('directory:select', async (): Promise<DirectorySelectResult> => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select Project Root Directory'
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return { success: false, error: 'No directory selected' };
        }

        const selectedPath = result.filePaths[0];
        return { success: true, path: selectedPath };
      } catch (error: any) {
        logger.error('IPC: Error selecting directory:', error);
        return {
          success: false,
          error: error.message || 'Failed to select directory'
        };
      }
    });

    // Handle git repository verification
    ipcMain.handle('directory:verify-git', async (_event: IpcMainInvokeEvent, { directoryPath }: { directoryPath: string }): Promise<GitVerificationResult> => {
      try {
        if (!directoryPath) {
          throw new Error('Directory path is required');
        }

        // Check if .git directory exists
        const gitPath = path.join(directoryPath, '.git');

        if (!fs.existsSync(gitPath)) {
          return {
            success: false,
            isValid: false,
            error: 'Not a git repository. Please select a directory with a .git folder.'
          };
        }

        // Verify git status works
        try {
          await execAsync('git status', {
            cwd: directoryPath,
            timeout: 5000
          });

          // If git status succeeds, it's a valid git repo
          return {
            success: true,
            isValid: true,
            path: directoryPath,
            message: 'Valid git repository'
          };
        } catch (gitError: any) {
          return {
            success: false,
            isValid: false,
            error: `Git repository found but git status failed: ${gitError.message}`
          };
        }
      } catch (error: any) {
        logger.error('IPC: Error verifying git repository:', error);
        return {
          success: false,
          isValid: false,
          error: error.message || 'Failed to verify git repository'
        };
      }
    });
  }

  /**
   * Set up ClickUp API IPC handlers
   */
  private setupClickUpHandlers(): void {
    // Handle fetch workspaces
    ipcMain.handle('clickup:get-workspaces', async (): Promise<ClickUpAPIResponse<any>> => {
      try {
        const response = await ClickUpAPI.getWorkspaces();
        return { success: true, data: response };
      } catch (error: any) {
        logger.error('IPC: Error fetching workspaces:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch workspaces'
        };
      }
    });

    // Handle fetch spaces
    ipcMain.handle('clickup:get-spaces', async (_event: IpcMainInvokeEvent, { workspaceId }: { workspaceId: string }): Promise<ClickUpAPIResponse<any>> => {
      try {
        if (!workspaceId) {
          throw new Error('Workspace ID is required');
        }
        const response = await ClickUpAPI.getSpaces(workspaceId);
        return { success: true, data: response };
      } catch (error: any) {
        logger.error('IPC: Error fetching spaces:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch spaces'
        };
      }
    });

    // Handle fetch folders
    ipcMain.handle('clickup:get-folders', async (_event: IpcMainInvokeEvent, { spaceId }: { spaceId: string }): Promise<ClickUpAPIResponse<any>> => {
      try {
        if (!spaceId) {
          throw new Error('Space ID is required');
        }
        const response = await ClickUpAPI.getFolders(spaceId);
        return { success: true, data: response };
      } catch (error: any) {
        logger.error('IPC: Error fetching folders:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch folders'
        };
      }
    });

    // Handle fetch lists
    ipcMain.handle('clickup:get-lists', async (_event: IpcMainInvokeEvent, { spaceId, folderId }: { spaceId: string; folderId?: string }): Promise<ClickUpAPIResponse<any>> => {
      try {
        if (!spaceId) {
          throw new Error('Space ID is required');
        }
        const response = await ClickUpAPI.getLists(spaceId, folderId || null);
        return { success: true, data: response };
      } catch (error: any) {
        logger.error('IPC: Error fetching lists:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch lists'
        };
      }
    });

    // Handle fetch tasks request
    ipcMain.handle('clickup:get-tasks', async (_event: IpcMainInvokeEvent, { listId, userId }: { listId: string; userId?: string }): Promise<ClickUpAPIResponse<any>> => {
      try {
        if (!listId) {
          throw new Error('List ID is required');
        }
        const finalUserId = userId || process.env.CLICKUP_USER_ID;
        const response = await ClickUpAPI.getTasks(listId, finalUserId);
        return { success: true, data: response };
      } catch (error: any) {
        logger.error('IPC: Error fetching tasks:', error);
        return {
          success: false,
          error: error.message || 'Failed to fetch tasks'
        };
      }
    });
  }

  /**
   * Set up tracker IPC handlers
   */
  private setupTrackerHandlers(): void {
    // Handle start tracking
    ipcMain.handle('tracker:start', async (_event: IpcMainInvokeEvent, { taskId, taskInfo }: { taskId: string; taskInfo?: any }): Promise<any> => {
      try {
        logger.info(`IPC: Starting tracker for task ${taskId}`);
        const result = await TrackerService.startTracking(taskId, taskInfo);
        return result;
      } catch (error: any) {
        logger.error('IPC: Error starting tracker:', error);
        return {
          success: false,
          error: error.message || 'Failed to start tracker'
        };
      }
    });

    // Handle stop tracking
    ipcMain.handle('tracker:stop', async (_event: IpcMainInvokeEvent, { taskId }: { taskId: string }): Promise<any> => {
      try {
        logger.info(`IPC: Stopping tracker for task ${taskId}`);
        const result = TrackerService.stopTracking(taskId);
        return result;
      } catch (error: any) {
        logger.error('IPC: Error stopping tracker:', error);
        return {
          success: false,
          error: error.message || 'Failed to stop tracker'
        };
      }
    });

    // Handle get tracker status
    ipcMain.handle('tracker:status', async (_event: IpcMainInvokeEvent, { taskId }: { taskId: string }): Promise<any> => {
      try {
        const status = TrackerService.getTrackerStatus(taskId);
        return { success: true, status };
      } catch (error: any) {
        logger.error('IPC: Error getting tracker status:', error);
        return {
          success: false,
          error: error.message || 'Failed to get tracker status'
        };
      }
    });

    // Handle get all active trackers
    ipcMain.handle('tracker:all', async (): Promise<any> => {
      try {
        const trackers = TrackerService.getAllActiveTrackers();
        return { success: true, trackers };
      } catch (error: any) {
        logger.error('IPC: Error getting all trackers:', error);
        return {
          success: false,
          error: error.message || 'Failed to get trackers'
        };
      }
    });
  }

  /**
   * Cleanup IPC handlers
   */
  cleanup(): void {
    if (!this.initialized) return;

    // Stop all trackers
    TrackerService.stopAllTrackers();

    // Remove all listeners
    ipcMain.removeAllListeners('directory:select');
    ipcMain.removeAllListeners('directory:verify-git');
    ipcMain.removeAllListeners('clickup:get-workspaces');
    ipcMain.removeAllListeners('clickup:get-spaces');
    ipcMain.removeAllListeners('clickup:get-folders');
    ipcMain.removeAllListeners('clickup:get-lists');
    ipcMain.removeAllListeners('clickup:get-tasks');
    ipcMain.removeAllListeners('tracker:start');
    ipcMain.removeAllListeners('tracker:stop');
    ipcMain.removeAllListeners('tracker:status');
    ipcMain.removeAllListeners('tracker:all');

    this.initialized = false;
    logger.info('IPC handlers cleaned up');
  }
}

export default new IPCHandlers();

