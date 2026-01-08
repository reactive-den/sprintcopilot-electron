import { Logger } from '../utils/logger.js';
import type { ClickUpWorkspace, ClickUpSpace, ClickUpFolder, ClickUpList, NavigationCallback, RenderCallback, ProjectSelectedCallback } from '../../../types/index.js';

export class WorkspaceSelector {
  private container: HTMLElement | null;
  private logger: Logger;
  private workspaces: ClickUpWorkspace[] = [];
  public selectedWorkspace: ClickUpWorkspace | null = null;
  public selectedSpace: ClickUpSpace | null = null;
  public isLoading: boolean = false;
  public spaces: ClickUpSpace[] = [];
  public initialized: boolean = false;
  public onNavigate: NavigationCallback | null = null;
  public onProjectSelected: ProjectSelectedCallback | null = null;
  public onRender: RenderCallback | null = null;

  constructor(container: HTMLElement | null) {
    this.container = container;
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing WorkspaceSelector...');
    this.initialized = true;
    await this.loadWorkspaces();
  }

  async loadWorkspaces(): Promise<void> {
    if (this.isLoading) {
      this.logger.warn('Workspaces are already loading');
      return;
    }

    this.isLoading = true;
    this.showLoading();

    try {
      if (!window.electronAPI || !window.electronAPI.ipc) {
        throw new Error('Electron API not available');
      }

      const response = await window.electronAPI.ipc.invoke('clickup:get-workspaces');

      if (response && response.success && response.data && response.data.teams) {
        this.workspaces = response.data.teams;
        this.logger.info(`Loaded ${this.workspaces.length} workspaces`);
        await this.render();
      } else {
        throw new Error(response?.error || 'Failed to fetch workspaces');
      }
    } catch (error: any) {
      this.logger.error('Error loading workspaces:', error);
      this.showError(error.message || 'Failed to load workspaces');
    } finally {
      this.isLoading = false;
    }
  }

  async loadSpaces(workspaceId: string): Promise<ClickUpSpace[]> {
    try {
      const response = await window.electronAPI.ipc.invoke('clickup:get-spaces', { workspaceId });

      if (response && response.success && response.data && response.data.spaces) {
        return response.data.spaces;
      } else {
        throw new Error(response?.error || 'Failed to fetch spaces');
      }
    } catch (error: any) {
      this.logger.error('Error loading spaces:', error);
      throw error;
    }
  }

  async loadFolders(spaceId: string): Promise<ClickUpFolder[]> {
    try {
      const response = await window.electronAPI.ipc.invoke('clickup:get-folders', { spaceId });

      if (response && response.success && response.data && response.data.folders) {
        return response.data.folders;
      } else {
        return [];
      }
    } catch (error: any) {
      this.logger.error('Error loading folders:', error);
      return [];
    }
  }

  async loadLists(spaceId: string, folderId: string | null = null): Promise<ClickUpList[]> {
    try {
      const response = await window.electronAPI.ipc.invoke('clickup:get-lists', { spaceId, folderId });

      if (response && response.success && response.data && response.data.lists) {
        return response.data.lists;
      } else {
        return [];
      }
    } catch (error: any) {
      this.logger.error('Error loading lists:', error);
      return [];
    }
  }

  async render(): Promise<void> {
    if (!this.container) {
      this.logger.error('Container element not found');
      return;
    }

    this.container.innerHTML = '';

    if (this.workspaces.length === 0) {
      this.showEmpty();
      return;
    }

    const header = document.createElement('div');
    header.className = 'workspace-selector__header';
    header.innerHTML = `
      <h2 class="workspace-selector__title">Select Workspace</h2>
      <button class="workspace-selector__refresh" id="refresh-workspaces">🔄 Refresh</button>
    `;
    this.container.appendChild(header);

    const refreshButton = header.querySelector('#refresh-workspaces') as HTMLButtonElement | null;
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        refreshButton.disabled = true;
        this.loadWorkspaces().finally(() => {
          if (refreshButton) refreshButton.disabled = false;
        });
      });
    }

    const workspacesContainer = document.createElement('div');
    workspacesContainer.className = 'workspace-selector__grid';

    for (const workspace of this.workspaces) {
      const workspaceCard = this.createWorkspaceCard(workspace);
      workspacesContainer.appendChild(workspaceCard);
    }

    this.container.appendChild(workspacesContainer);

    // Notify app to update back button
    if (this.onRender) {
      this.onRender();
    }
  }

  private createWorkspaceCard(workspace: ClickUpWorkspace): HTMLElement {
    const card = document.createElement('div');
    card.className = 'workspace-card';
    card.innerHTML = `
      <div class="workspace-card__icon">📁</div>
      <h3 class="workspace-card__name">${this.escapeHtml(workspace.name || 'Untitled Workspace')}</h3>
      <p class="workspace-card__meta">${workspace.members?.length || 0} members</p>
    `;

    card.addEventListener('click', async () => {
      await this.selectWorkspace(workspace);
    });

    return card;
  }

  async selectWorkspace(workspace: ClickUpWorkspace): Promise<void> {
    this.selectedWorkspace = workspace;
    this.logger.info(`Selected workspace: ${workspace.name}`);
    this.isLoading = true;
    this.showLoading();

    try {
      const spaces = await this.loadSpaces(workspace.id);
      this.spaces = spaces;
      this.isLoading = false;

      if (spaces.length === 0) {
        this.showError('No spaces found in this workspace');
        return;
      }

      // Always show space selection screen, even if only one space
      await this.renderSpaces(spaces);

      // Notify app about navigation to spaces view
      if (this.onNavigate) {
        this.onNavigate('spaces', {
          workspace: workspace,
          spaces: spaces
        });
      }
    } catch (error: any) {
      this.isLoading = false;
      this.showError(error.message || 'Failed to load spaces');
    }
  }

  async renderSpaces(spaces: ClickUpSpace[]): Promise<void> {
    if (!this.container) return;

    this.container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'workspace-selector__header';
    header.innerHTML = `
      <h2 class="workspace-selector__title">Select Space</h2>
    `;
    this.container.appendChild(header);

    const spacesContainer = document.createElement('div');
    spacesContainer.className = 'workspace-selector__grid';

    for (const space of spaces) {
      const spaceCard = this.createSpaceCard(space);
      spacesContainer.appendChild(spaceCard);
    }

    this.container.appendChild(spacesContainer);

    // Notify app to update back button
    if (this.onRender) {
      this.onRender();
    }
  }

  private createSpaceCard(space: ClickUpSpace): HTMLElement {
    const card = document.createElement('div');
    card.className = 'workspace-card';
    card.innerHTML = `
      <div class="workspace-card__icon">🚀</div>
      <h3 class="workspace-card__name">${this.escapeHtml(space.name || 'Untitled Space')}</h3>
    `;

    card.addEventListener('click', async () => {
      await this.selectSpace(space);
    });

    return card;
  }

  async selectSpace(space: ClickUpSpace): Promise<void> {
    this.selectedSpace = space;
    this.logger.info(`Selected space: ${space.name}`);
    this.isLoading = true;
    this.showLoading();

    try {
      // Try to get folders and lists in parallel
      const [folders, spaceLists] = await Promise.all([
        this.loadFolders(space.id),
        this.loadLists(space.id)
      ]);

      this.isLoading = false;

      let allLists: ClickUpList[] = [];

      // If there are folders, fetch all lists from all folders
      if (folders && folders.length > 0) {
        this.logger.info(`Found ${folders.length} folders, fetching all lists from folders`);

        // Fetch lists from all folders in parallel
        const folderListPromises = folders.map(folder =>
          this.loadLists(space.id, folder.id).then(lists => ({
            folderId: folder.id,
            folderName: folder.name,
            lists: lists || []
          }))
        );

        const folderLists = await Promise.all(folderListPromises);

        // Combine all lists from all folders
        for (const folderData of folderLists) {
          allLists = allLists.concat(folderData.lists);
        }

        // Also include lists directly in space (not in folders)
        if (spaceLists && spaceLists.length > 0) {
          allLists = allLists.concat(spaceLists);
        }
      } else {
        // No folders, use lists directly from space
        allLists = spaceLists || [];
      }

      if (allLists.length > 0) {
        // Clear loading state before switching to tasks
        this.isLoading = false;

        // Notify app about navigation to tasks (this will push spaces to stack)
        // This must happen before onProjectSelected
        if (this.onNavigate) {
          this.onNavigate('tasks', {
            workspace: this.selectedWorkspace,
            spaces: this.spaces
          });
        }

        // Automatically show tasks from all lists
        if (this.onProjectSelected) {
          this.onProjectSelected({
            id: space.id,
            name: space.name,
            type: 'space',
            lists: allLists,
            workspaceId: this.selectedWorkspace?.id,
            workspaceName: this.selectedWorkspace?.name
          });
        }
      } else {
        this.isLoading = false;
        this.showError('No lists found in this space');
      }
    } catch (error: any) {
      this.isLoading = false;
      this.logger.error('Error in selectSpace:', error);
      this.showError(error.message || 'Failed to load tasks');
    }
  }

  private showLoading(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="workspace-selector__loading">
        <div class="workspace-selector__spinner"></div>
        <p>Loading...</p>
      </div>
    `;
  }

  private showError(message: string): void {
    if (!this.container) return;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'workspace-selector__error';
    errorDiv.innerHTML = `
      <p>⚠️ ${this.escapeHtml(message)}</p>
      <button class="workspace-selector__retry" id="retry-load">🔄 Retry</button>
    `;

    const retryButton = errorDiv.querySelector('#retry-load') as HTMLButtonElement | null;
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.loadWorkspaces();
      });
    }

    this.container.innerHTML = '';
    this.container.appendChild(errorDiv);
  }

  private showEmpty(): void {
    if (!this.container) return;
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'workspace-selector__empty';
    emptyDiv.innerHTML = '<p>📋 No workspaces found</p>';
    this.container.innerHTML = '';
    this.container.appendChild(emptyDiv);
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

