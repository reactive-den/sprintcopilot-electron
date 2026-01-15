/**
 * Comprehensive TypeScript type definitions for SprintCopilot App
 */

// ============================================================================
// Electron API Types
// ============================================================================

export interface ElectronAPI {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  ipc: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// ============================================================================
// ClickUp API Types
// ============================================================================

export interface ClickUpMember {
  id: string;
  username: string;
  color?: string;
  email?: string;
  initials?: string;
  profilePicture?: string;
}

export interface ClickUpWorkspace {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  members?: ClickUpMember[];
}

export interface ClickUpSpace {
  id: string;
  name: string;
  private?: boolean;
  color?: string;
  avatar?: string;
}

export interface ClickUpFolder {
  id: string;
  name: string;
  orderindex?: number;
  override_statuses?: boolean;
  hidden?: boolean;
  space?: ClickUpSpace;
  task_count?: number;
  archived?: boolean;
  statuses?: any[];
  lists?: ClickUpList[];
}

export interface ClickUpList {
  id: string;
  name: string;
  orderindex?: number;
  status?: any;
  priority?: any;
  assignee?: any;
  task_count?: number;
  due_date?: string;
  due_date_time?: boolean;
  start_date?: string;
  start_date_time?: boolean;
  folder?: ClickUpFolder;
  space?: ClickUpSpace;
  archived?: boolean;
  statuses?: any[];
  permission_level?: string;
}

export interface ClickUpTag {
  name: string;
  tag_fg?: string;
  tag_bg?: string;
  creator?: number;
}

export interface ClickUpStatus {
  status: string;
  color: string;
  orderindex: number;
  type: string;
}

export interface ClickUpPriority {
  id: string;
  priority: string;
  color: string;
  orderindex: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status?: ClickUpStatus;
  orderindex?: string;
  date_created?: string;
  date_updated?: string;
  date_closed?: string;
  archived?: boolean;
  creator?: ClickUpMember;
  assignees?: ClickUpMember[];
  watchers?: ClickUpMember[];
  checklists?: any[];
  tags?: ClickUpTag[];
  parent?: string;
  priority?: ClickUpPriority;
  due_date?: string;
  start_date?: string;
  points?: number;
  time_estimate?: number;
  time_spent?: number;
  custom_fields?: any[];
  dependencies?: any[];
  linked_tasks?: any[];
  team_id?: string;
  url?: string;
  sharing?: any;
  permission_level?: string;
  list?: ClickUpList;
  project?: any;
  folder?: ClickUpFolder;
  space?: ClickUpSpace;
  description?: string;
}

export interface ClickUpAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Project Types
// ============================================================================

export interface Project {
  id: string;
  name: string;
  type: 'space' | 'folder';
  lists: ClickUpList[];
  workspaceId?: string;
  workspaceName?: string;
}

// ============================================================================
// Navigation Types
// ============================================================================

export type ViewType = 'directory' | 'workspaces' | 'spaces' | 'tasks';

export interface NavigationState {
  view: ViewType;
  data?: {
    workspace?: ClickUpWorkspace;
    spaces?: ClickUpSpace[];
    project?: Project;
  } | null;
}

// ============================================================================
// Tracker Types
// ============================================================================

export interface TrackerConfig {
  SCREENSHOT_INTERVAL: number;
  ENABLE_KEYBOARD_TRACKING: boolean;
  ENABLE_MOUSE_TRACKING: boolean;
  ENABLE_SCREENSHOTS: boolean;
  ENABLE_SCREENSHOT_SOUND: boolean;
  SCREENSHOT_SOUND_PATH: string;
  LOG_INTERVAL: number;
  METADATA_LOG_INTERVAL: number;
}

export interface TrackerInfo {
  taskId: string;
  taskName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  durationMinutes?: number;
}

export interface InputEvent {
  timestamp: string;
  type: 'keypress' | 'mouse_move' | 'mouse_click';
  key?: string;
  rawKey?: string;
  state?: string;
  position?: { x: number; y: number };
  taskId: string;
  elapsedSinceStart: number;
}

export interface ScreenshotMetadata {
  id: string;
  path: string;
  timestamp: string;
  taskId: string;
  diffPath?: string;
  diffKey?: string;
  diffContent?: string;
  diffTruncated?: boolean;
  diffError?: string;
  git?: GitSnapshotInfo;
}

export interface GitSnapshotInfo {
  branch: string;
  headCommit: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  commits?: string[];
  error?: string;
}

export interface TrackerMetadata {
  taskId: string;
  taskName: string;
  startTime: string;
  endTime: string;
  duration: number;
  durationMinutes: number;
  screenshots: {
    count: number;
    paths: string[];
  };
  keyboardEvents: {
    count: number;
    events: InputEvent[];
  };
  mouseEvents: {
    count: number;
    events: InputEvent[];
  };
  screenshotsDir: string;
  logsDir: string;
}

export interface TrackerStatus {
  active: boolean;
  taskId?: string;
  taskName?: string;
  startTime?: Date;
  elapsed?: number;
  elapsedMinutes?: number;
  screenshots?: number;
  keyboardEvents?: number;
  mouseEvents?: number;
}

export interface TrackerInfo {
  taskId: string;
  taskName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  screenshotCount: number;
  screenshots: ScreenshotMetadata[];
  keyboardEvents: InputEvent[];
  mouseEvents: InputEvent[];
  metadataLogs: any[];
  running: boolean;
}

export interface InputLogger {
  taskId: string;
  startTime: number;
  lastKeyboardActivity: number;
  lastMouseActivity: number;
  keyboardCount: number;
  mouseCount: number;
  keyboardListener: any;
  mouseProcess: NodeJS.Timeout | null;
  lastMousePosition: { x: number; y: number } | null;
}

// ============================================================================
// Directory Selection Types
// ============================================================================

export interface DirectorySelectResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface GitVerificationResult {
  success: boolean;
  isValid?: boolean;
  path?: string;
  message?: string;
  error?: string;
}

// ============================================================================
// IPC Channel Types
// ============================================================================

export type IPCChannel = 
  | 'app:get-version'
  | 'app:get-platform'
  | 'directory:select'
  | 'directory:verify-git'
  | 'clickup:get-workspaces'
  | 'clickup:get-spaces'
  | 'clickup:get-folders'
  | 'clickup:get-lists'
  | 'clickup:get-tasks'
  | 'tracker:start'
  | 'tracker:stop'
  | 'tracker:status'
  | 'tracker:all';

export type IPCListenerChannel = 'app:update-available';

// ============================================================================
// Window Configuration Types
// ============================================================================

export interface WindowConfig {
  main: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
  };
}

// ============================================================================
// Logger Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// ============================================================================
// Component Callback Types
// ============================================================================

export type DirectorySelectedCallback = (path: string) => void;
export type ProjectSelectedCallback = (project: Project) => void;
export type NavigationCallback = (view: ViewType, data?: any) => void;
export type RenderCallback = () => void;
