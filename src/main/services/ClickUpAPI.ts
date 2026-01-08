import * as https from 'https';
import { URL } from 'url';
import logger from '../utils/logger.js';
import type { ClickUpWorkspace, ClickUpSpace, ClickUpFolder, ClickUpList, ClickUpTask } from '../../types/index.js';

interface ClickUpResponse {
  teams?: ClickUpWorkspace[];
  spaces?: ClickUpSpace[];
  folders?: ClickUpFolder[];
  lists?: ClickUpList[];
  tasks?: ClickUpTask[];
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
}

class ClickUpAPI {
  private apiToken: string | undefined;
  private baseUrl: string = 'https://api.clickup.com/api/v2';

  constructor() {
    this.apiToken = process.env.CLICKUP_API_TOKEN;
  }

  /**
   * Get all workspaces
   */
  async getWorkspaces(): Promise<{ teams: ClickUpWorkspace[] }> {
    if (!this.apiToken) {
      throw new Error('CLICKUP_API_TOKEN is not set in environment variables');
    }

    try {
      const url = new URL(`${this.baseUrl}/team`);
      logger.info('Fetching workspaces from ClickUp');
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json'
        }
      }) as ClickUpResponse;
      logger.info(`Successfully fetched ${response.teams?.length || 0} workspaces`);
      return { teams: response.teams || [] };
    } catch (error) {
      logger.error('Error fetching workspaces from ClickUp:', error);
      throw error;
    }
  }

  /**
   * Get all spaces in a workspace
   */
  async getSpaces(workspaceId: string): Promise<{ spaces: ClickUpSpace[] }> {
    if (!this.apiToken) {
      throw new Error('CLICKUP_API_TOKEN is not set in environment variables');
    }

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    try {
      const url = new URL(`${this.baseUrl}/team/${workspaceId}/space`);
      logger.info(`Fetching spaces for workspace: ${workspaceId}`);
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json'
        }
      }) as ClickUpResponse;
      logger.info(`Successfully fetched ${response.spaces?.length || 0} spaces`);
      return { spaces: response.spaces || [] };
    } catch (error) {
      logger.error('Error fetching spaces from ClickUp:', error);
      throw error;
    }
  }

  /**
   * Get all folders in a space
   */
  async getFolders(spaceId: string): Promise<{ folders: ClickUpFolder[] }> {
    if (!this.apiToken) {
      throw new Error('CLICKUP_API_TOKEN is not set in environment variables');
    }

    if (!spaceId) {
      throw new Error('Space ID is required');
    }

    try {
      const url = new URL(`${this.baseUrl}/space/${spaceId}/folder`);
      logger.info(`Fetching folders for space: ${spaceId}`);
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json'
        }
      }) as ClickUpResponse;
      logger.info(`Successfully fetched ${response.folders?.length || 0} folders`);
      return { folders: response.folders || [] };
    } catch (error) {
      logger.error('Error fetching folders from ClickUp:', error);
      throw error;
    }
  }

  /**
   * Get all lists in a space (or folder)
   */
  async getLists(spaceId: string, folderId: string | null = null): Promise<{ lists: ClickUpList[] }> {
    if (!this.apiToken) {
      throw new Error('CLICKUP_API_TOKEN is not set in environment variables');
    }

    if (!spaceId) {
      throw new Error('Space ID is required');
    }

    try {
      let url: URL;
      if (folderId) {
        url = new URL(`${this.baseUrl}/folder/${folderId}/list`);
        logger.info(`Fetching lists for folder: ${folderId}`);
      } else {
        url = new URL(`${this.baseUrl}/space/${spaceId}/list`);
        logger.info(`Fetching lists for space: ${spaceId}`);
      }

      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json'
        }
      }) as ClickUpResponse;
      logger.info(`Successfully fetched ${response.lists?.length || 0} lists`);
      return { lists: response.lists || [] };
    } catch (error) {
      logger.error('Error fetching lists from ClickUp:', error);
      throw error;
    }
  }

  /**
   * Get tasks from a list with assignee filter
   */
  async getTasks(listId: string, userId?: string): Promise<{ tasks: ClickUpTask[] }> {
    if (!this.apiToken) {
      throw new Error('CLICKUP_API_TOKEN is not set in environment variables');
    }

    if (!listId) {
      throw new Error('List ID is required');
    }

    try {
      const url = new URL(`${this.baseUrl}/list/${listId}/task`);
      if (userId) {
        url.searchParams.append('assignees[]', userId);
      }

      logger.info(`Fetching tasks from list: ${listId}`);

      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json'
        }
      }) as ClickUpResponse;

      logger.info(`Successfully fetched ${response.tasks?.length || 0} tasks`);
      return { tasks: response.tasks || [] };
    } catch (error) {
      logger.error('Error fetching tasks from ClickUp:', error);
      throw error;
    }
  }

  /**
   * Make HTTP request
   */
  private makeRequest(url: URL, options: RequestOptions = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error: any) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }
}

export default new ClickUpAPI();

