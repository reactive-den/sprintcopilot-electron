import { TaskCard } from './TaskCard.js';
import { Logger } from '../utils/logger.js';
import type { Project, ClickUpTask, ClickUpList } from '../../../types/index.js';

export class TaskList {
  private container: HTMLElement | null;
  private logger: Logger;
  private tasks: ClickUpTask[] = [];
  private isLoading: boolean = false;
  private currentProject: Project | null = null;
  public onBack: (() => void) | null = null;

  constructor(container: HTMLElement | null) {
    this.container = container;
    this.logger = new Logger();
  }

  /**
   * Initialize the task list
   */
  async initialize(project: Project): Promise<void> {
    this.logger.info('Initializing TaskList...');
    if (project) {
      await this.loadTasks(project);
    }
  }

  /**
   * Load tasks from ClickUp API for a project
   */
  async loadTasks(project: Project): Promise<void> {
    if (this.isLoading) {
      this.logger.warn('Tasks are already loading');
      return;
    }

    if (!project || !project.id) {
      this.showError('No project selected');
      return;
    }

    this.currentProject = project;
    this.isLoading = true;
    this.showLoading();

    try {
      if (!window.electronAPI || !window.electronAPI.ipc) {
        throw new Error('Electron API not available');
      }

      this.logger.info(`Fetching tasks for: ${project.name}`);

      // If project already has lists, use them. Otherwise fetch lists
      let lists: ClickUpList[] = project.lists;
      if (!lists || lists.length === 0) {
        const listsResponse = await window.electronAPI.ipc.invoke('clickup:get-lists', {
          spaceId: (project as any).spaceId || project.id,
          folderId: project.type === 'folder' ? project.id : null
        });

        if (listsResponse && listsResponse.success && listsResponse.data && listsResponse.data.lists) {
          lists = listsResponse.data.lists;
        } else {
          throw new Error(listsResponse?.error || 'Failed to fetch lists');
        }
      }

      this.logger.info(`Found ${lists.length} lists`);

      const allTasks: ClickUpTask[] = [];
      const userId: string | null = null;

      for (const list of lists) {
        try {
          this.logger.info(`Fetching tasks from list: ${list.name}`);
          const tasksResponse = await window.electronAPI.ipc.invoke('clickup:get-tasks', {
            listId: list.id,
            userId: userId
          });

          if (tasksResponse && tasksResponse.success && tasksResponse.data && tasksResponse.data.tasks) {
            allTasks.push(...tasksResponse.data.tasks);
          }
        } catch (error: any) {
          this.logger.error(`Error loading tasks from list ${list.name}:`, error);
        }
      }

      this.tasks = allTasks;
      this.logger.info(`Loaded ${this.tasks.length} total tasks`);
      await this.render();
    } catch (error: any) {
      this.logger.error('Error loading tasks:', error);
      this.showError(error.message || 'Failed to load tasks');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render the task list
   */
  async render(): Promise<void> {
    if (!this.container) {
      this.logger.error('Container element not found');
      return;
    }

    // Clear container
    this.container.innerHTML = '';

    if (this.tasks.length === 0) {
      this.showEmpty();
      return;
    }

    // Create header
    const header = document.createElement('div');
    header.className = 'task-list__header';
    const refreshButton = document.createElement('button');
    refreshButton.className = 'task-list__refresh';
    refreshButton.textContent = '🔄 Refresh';
    refreshButton.addEventListener('click', () => {
      refreshButton.disabled = true;
      if (this.currentProject) {
        this.loadTasks(this.currentProject).finally(() => {
          refreshButton.disabled = false;
        });
      }
    });

    header.innerHTML = `<h2 class="task-list__title">Tasks (${this.tasks.length})</h2>`;
    header.appendChild(refreshButton);
    this.container.appendChild(header);

    // Create tasks container
    const tasksContainer = document.createElement('div');
    tasksContainer.className = 'task-list__tasks';

    // Render each task as a card (await async render)
    for (const task of this.tasks) {
      const taskCard = new TaskCard(task);
      const cardElement = await taskCard.render();
      tasksContainer.appendChild(cardElement);
    }

    this.container.appendChild(tasksContainer);
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="task-list__loading">
        <div class="task-list__spinner"></div>
        <p>Loading tasks...</p>
      </div>
    `;
  }

  /**
   * Show error state
   */
  private showError(message: string): void {
    if (!this.container) return;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'task-list__error';
    errorDiv.innerHTML = `
      <p>⚠️ ${this.escapeHtml(message)}</p>
      <p class="task-list__error-hint">
        Make sure you have set the following environment variables:<br>
        <code>CLICKUP_API_TOKEN</code>, <code>CLICKUP_LIST_ID</code>, <code>CLICKUP_USER_ID</code>
      </p>
    `;

    const retryButton = document.createElement('button');
    retryButton.className = 'task-list__retry';
    retryButton.textContent = '🔄 Retry';
    retryButton.addEventListener('click', () => {
      if (this.currentProject) {
        this.loadTasks(this.currentProject);
      }
    });
    errorDiv.appendChild(retryButton);

    this.container.innerHTML = '';
    this.container.appendChild(errorDiv);
  }

  /**
   * Show empty state
   */
  private showEmpty(): void {
    if (!this.container) return;
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'task-list__empty';
    emptyDiv.innerHTML = '<p>📋 No tasks found</p>';

    const refreshButton = document.createElement('button');
    refreshButton.className = 'task-list__retry';
    refreshButton.textContent = '🔄 Refresh';
    refreshButton.addEventListener('click', () => {
      if (this.currentProject) {
        this.loadTasks(this.currentProject);
      }
    });
    emptyDiv.appendChild(refreshButton);

    this.container.innerHTML = '';
    this.container.appendChild(emptyDiv);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

