import { DirectorySelector } from '../components/DirectorySelector.js';
import { WorkspaceSelector } from '../components/WorkspaceSelector.js';
import { TaskList } from '../components/TaskList.js';
import { Logger } from '../utils/logger.js';
import type { ViewType, NavigationState, Project } from '../../../types/index.js';

export class App {
  private logger: Logger;
  private components: any[] = [];
  private directorySelector: DirectorySelector | null = null;
  private workspaceSelector: WorkspaceSelector | null = null;
  private taskList: TaskList | null = null;
  private currentView: ViewType = 'directory';
  private navigationStack: NavigationState[] = [];

  constructor() {
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing App...');
    await this.initializeComponents();
    this.setupIPCListeners();
    this.updateBackButton();

    // Set initial header text
    const appTitle = document.querySelector('.app-title');
    const appSubtitle = document.querySelector('.app-subtitle');
    if (appTitle) appTitle.textContent = 'Welcome to SprintCopilot';
    if (appSubtitle) appSubtitle.textContent = 'Select your project directory to get started';

    this.logger.info('App initialized successfully');
  }

  async initializeComponents(): Promise<void> {
    const directoryContainer = document.getElementById('directory-selector');
    const workspaceContainer = document.getElementById('workspace-selector');
    const taskListContainer = document.getElementById('task-list');
    const backButton = document.getElementById('app-back-button');

    // Setup back button
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.handleBackNavigation();
      });
    }

    // Initialize directory selector first
    if (directoryContainer) {
      this.directorySelector = new DirectorySelector(directoryContainer);
      this.directorySelector.onDirectorySelectedCallback = (path: string) => {
        this.onDirectorySelected(path);
      };
      this.components.push(this.directorySelector);
      await this.directorySelector.initialize();
    }

    if (workspaceContainer) {
      this.workspaceSelector = new WorkspaceSelector(workspaceContainer);
      this.workspaceSelector.onProjectSelected = (project: Project) => {
        this.onProjectSelected(project);
      };
      this.workspaceSelector.onRender = () => {
        this.updateBackButton();
      };
      this.workspaceSelector.onNavigate = (view: ViewType, data?: any) => {
        this.handleWorkspaceNavigation(view, data);
      };
      this.components.push(this.workspaceSelector);
    }

    if (taskListContainer) {
      this.taskList = new TaskList(taskListContainer);
      this.taskList.onBack = () => {
        this.handleBackNavigation();
      };
      this.components.push(this.taskList);
    }
  }

  async onDirectorySelected(directoryPath: string): Promise<void> {
    this.logger.info(`Project directory selected: ${directoryPath}`);

    // Push current view to navigation stack
    this.navigationStack.push({ view: 'directory' });

    // Hide directory selector and show workspace selector
    const directoryContainer = document.getElementById('directory-selector');
    const workspaceContainer = document.getElementById('workspace-selector');
    const appTitle = document.querySelector('.app-title');
    const appSubtitle = document.querySelector('.app-subtitle');

    if (directoryContainer) {
      directoryContainer.style.display = 'none';
    }

    if (workspaceContainer && this.workspaceSelector) {
      workspaceContainer.style.display = 'block';
      await this.workspaceSelector.initialize();
    }

    if (appTitle) appTitle.textContent = 'Welcome to SprintCopilot';
    if (appSubtitle) appSubtitle.textContent = 'Track your sprint progress with SprintCopilot';

    this.currentView = 'workspaces';
    this.updateBackButton();
  }

  handleWorkspaceNavigation(view: ViewType, data?: any): void {
    // Push current view to navigation stack when navigating within workspace selector
    if (view === 'spaces' && this.currentView === 'workspaces') {
      this.navigationStack.push({
        view: 'workspaces',
        data: null
      });
      this.currentView = 'spaces';
      this.updateBackButton();
    } else if (view === 'tasks' && this.currentView === 'spaces') {
      // Push spaces view to stack when navigating to tasks
      this.navigationStack.push({
        view: 'spaces',
        data: data
      });
    }
  }

  handleBackNavigation(): void {
    if (this.navigationStack.length === 0) {
      this.logger.warn('No navigation history to go back to');
      return;
    }

    // Pop the current view from stack
    const previousState = this.navigationStack.pop()!;
    this.logger.info(`Navigating back to: ${previousState.view}`);

    const appTitle = document.querySelector('.app-title');
    const appSubtitle = document.querySelector('.app-subtitle');
    const directoryContainer = document.getElementById('directory-selector');
    const workspaceContainer = document.getElementById('workspace-selector');
    const taskListContainer = document.getElementById('task-list');

    // Hide all containers first
    if (directoryContainer) directoryContainer.style.display = 'none';
    if (workspaceContainer) workspaceContainer.style.display = 'none';
    if (taskListContainer) taskListContainer.style.display = 'none';

    // Navigate to previous state
    switch (previousState.view) {
      case 'directory':
        if (directoryContainer) directoryContainer.style.display = 'block';
        this.currentView = 'directory';
        if (appTitle) appTitle.textContent = 'Welcome to SprintCopilot';
        if (appSubtitle) appSubtitle.textContent = 'Select your project directory to get started';
        break;

      case 'workspaces':
        if (workspaceContainer) workspaceContainer.style.display = 'block';
        this.currentView = 'workspaces';
        if (this.workspaceSelector) {
          // Reset to workspace list view
          this.workspaceSelector.render();
        }
        if (appTitle) appTitle.textContent = 'Welcome to SprintCopilot';
        if (appSubtitle) appSubtitle.textContent = 'Track your sprint progress with SprintCopilot';
        break;

      case 'spaces':
        if (workspaceContainer) workspaceContainer.style.display = 'block';
        this.currentView = 'spaces';
        if (this.workspaceSelector && previousState.data && previousState.data.spaces) {
          this.workspaceSelector.renderSpaces(previousState.data.spaces);
        }
        if (appTitle) appTitle.textContent = 'Welcome to SprintCopilot';
        if (appSubtitle) appSubtitle.textContent = 'Track your sprint progress with SprintCopilot';
        break;

      case 'tasks':
        if (taskListContainer) taskListContainer.style.display = 'block';
        this.currentView = 'tasks';
        if (this.taskList && previousState.data && previousState.data.project) {
          this.taskList.initialize(previousState.data.project);
        }
        break;

      default:
        this.logger.warn(`Unknown view in navigation stack: ${previousState.view}`);
        // Fallback to directory
        if (directoryContainer) directoryContainer.style.display = 'block';
        this.currentView = 'directory';
        break;
    }

    this.updateBackButton();
  }

  private updateBackButton(): void {
    const backButton = document.getElementById('app-back-button');
    if (backButton) {
      // Show back button if we have navigation history
      const shouldShow = this.navigationStack.length > 0;
      backButton.style.display = shouldShow ? 'block' : 'none';
    }
  }

  showWorkspaceSelector(): void {
    const workspaceContainer = document.getElementById('workspace-selector');
    const taskListContainer = document.getElementById('task-list');

    if (workspaceContainer) {
      workspaceContainer.style.display = 'block';
    }

    if (taskListContainer) {
      taskListContainer.style.display = 'none';
    }

    this.currentView = 'workspaces';
    this.updateBackButton();
  }

  async onProjectSelected(project: Project): Promise<void> {
    this.logger.info(`Project selected: ${project.name}`);

    // Navigation stack is already updated by handleWorkspaceNavigation
    // when onNavigate('tasks') is called from WorkspaceSelector

    const workspaceContainer = document.getElementById('workspace-selector');
    const taskListContainer = document.getElementById('task-list');

    if (workspaceContainer) {
      workspaceContainer.style.display = 'none';
    }

    if (taskListContainer) {
      taskListContainer.style.display = 'block';
      if (this.taskList) {
        await this.taskList.initialize(project);
      }
    }

    this.currentView = 'tasks';
    this.updateBackButton();
  }

  /**
   * Set up IPC event listeners
   */
  private setupIPCListeners(): void {
    if (window.electronAPI && window.electronAPI.ipc) {
      window.electronAPI.ipc.on('app:update-available', (data: any) => {
        this.logger.info('Update available:', data);
        // Handle update notification
      });
    }
  }

  /**
   * Cleanup on app close
   */
  cleanup(): void {
    this.logger.info('Cleaning up App...');
    this.components.forEach(component => {
      if (component.cleanup) {
        component.cleanup();
      }
    });
    this.components = [];
  }
}

