import * as path from 'path';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// @ts-ignore - screenshot-desktop doesn't have types
import screenshot from 'screenshot-desktop';
import { GlobalKeyboardListener } from 'node-global-key-listener';
import logger from '../utils/logger.js';
import { getUserDataPath } from '../utils/paths.js';
import S3UploadService from './S3UploadService.js';
import type { TrackerConfig, TrackerInfo, InputLogger, InputEvent, ScreenshotMetadata, TrackerStatus, TrackerMetadata } from '../../types/index.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let robot: any = null;
// Dynamically import robotjs if available - using top-level await would require async module
// We'll import it lazily when needed
const loadRobot = async () => {
  if (!robot) {
    try {
      const robotModule = await import('robotjs');
      robot = robotModule.default || robotModule;
    } catch (error) {
      // robotjs not available, mouse tracking will be disabled
      robot = null;
    }
  }
  return robot;
};

// Configuration - Easy to change
const TRACKER_CONFIG: TrackerConfig = {
  SCREENSHOT_INTERVAL: 5 * 1000, // 5 seconds in milliseconds
  // For production: 5 * 60 * 1000 (5 minutes) or 10 * 60 * 1000 (10 minutes)

  ENABLE_KEYBOARD_TRACKING: true,
  ENABLE_MOUSE_TRACKING: true,
  ENABLE_SCREENSHOTS: true,
  ENABLE_SCREENSHOT_SOUND: true,
  SCREENSHOT_SOUND_PATH: '/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Screen Capture.aif',
  LOG_INTERVAL: 10000, // Log activity every 10 seconds
  METADATA_LOG_INTERVAL: 30000 // Log full metadata every 30 seconds
};

interface ExtendedTrackerInfo extends TrackerInfo {
  endTime?: Date;
  duration?: number;
  tenantId?: string;
  projectId?: string;
  sessionId?: string;
  gitRepoPath?: string;
}

class TrackerService {
  private activeTrackers: Map<string, ExtendedTrackerInfo> = new Map();
  private screenshotIntervals: Map<string, NodeJS.Timeout> = new Map();
  private inputLoggers: Map<string, InputLogger> = new Map();
  private metadataLogIntervals: Map<string, NodeJS.Timeout> = new Map();
  private screenshotsDir: string | null = null;
  private logsDir: string | null = null;
  private globalKeyboardListener: GlobalKeyboardListener | null = null;

  constructor() {
    this.initDirectories();
  }

  /**
   * Initialize directories
   */
  private async initDirectories(): Promise<void> {
    try {
      this.screenshotsDir = path.join(getUserDataPath(), 'screenshots');
      this.logsDir = path.join(getUserDataPath(), 'logs');
      await fs.mkdir(this.screenshotsDir, { recursive: true });
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error: any) {
      logger.error('Failed to initialize directories:', error);
    }
  }

  /**
   * Start tracking for a task
   */
  async startTracking(taskId: string, taskInfo: any = {}): Promise<any> {
    if (this.activeTrackers.has(taskId)) {
      return { success: false, error: 'Tracker already running for this task' };
    }

    const trackerInfo: ExtendedTrackerInfo = {
      taskId,
      taskName: taskInfo.name || taskId,
      startTime: new Date(),
      screenshotCount: 0,
      screenshots: [],
      keyboardEvents: [],
      mouseEvents: [],
      metadataLogs: [],
      running: true,
      tenantId: taskInfo.tenantId || process.env.TENANT_ID || 'default_tenant',
      projectId: taskInfo.projectId || process.env.PROJECT_ID || 'default_project',
      sessionId: taskInfo.sessionId || `${taskId}-${Date.now()}`,
      gitRepoPath: taskInfo.gitRepoPath || process.env.GIT_REPO_PATH
    };

    this.activeTrackers.set(taskId, trackerInfo);

    if (TRACKER_CONFIG.ENABLE_SCREENSHOTS) {
      this.startScreenshotCapture(taskId);
    }

    if (TRACKER_CONFIG.ENABLE_KEYBOARD_TRACKING || TRACKER_CONFIG.ENABLE_MOUSE_TRACKING) {
      this.startInputTracking(taskId);
    }

    this.startMetadataLogging(taskId);

    return {
      success: true,
      taskId,
      startTime: trackerInfo.startTime,
      config: {
        screenshotInterval: TRACKER_CONFIG.SCREENSHOT_INTERVAL,
        keyboardTracking: TRACKER_CONFIG.ENABLE_KEYBOARD_TRACKING,
        mouseTracking: TRACKER_CONFIG.ENABLE_MOUSE_TRACKING
      }
    };
  }

  /**
   * Stop tracking for a task
   */
  stopTracking(taskId: string): any {
    if (!this.activeTrackers.has(taskId)) {
      return { success: false, error: 'No active tracker for this task' };
    }

    const trackerInfo = this.activeTrackers.get(taskId)!;
    trackerInfo.running = false;
    trackerInfo.endTime = new Date();
    trackerInfo.duration = trackerInfo.endTime.getTime() - trackerInfo.startTime.getTime();

    if (this.screenshotIntervals.has(taskId)) {
      clearInterval(this.screenshotIntervals.get(taskId)!);
      this.screenshotIntervals.delete(taskId);
    }

    if (this.inputLoggers.has(taskId)) {
      this.stopInputTracking(taskId);
      this.inputLoggers.delete(taskId);
    }

    if (this.metadataLogIntervals.has(taskId)) {
      clearInterval(this.metadataLogIntervals.get(taskId)!);
      this.metadataLogIntervals.delete(taskId);
    }

    this.saveMetadataLog(taskId, trackerInfo);

    // Generate and upload git diff if repo path is available
    if (trackerInfo.gitRepoPath && trackerInfo.tenantId && trackerInfo.projectId && trackerInfo.sessionId) {
      this.generateAndUploadGitDiff(taskId, trackerInfo).catch((error) => {
        logger.error(`Failed to generate/upload git diff for task ${taskId}:`, error);
      });
    }

    // Generate summary
    const summary: TrackerMetadata = {
      taskId: trackerInfo.taskId,
      taskName: trackerInfo.taskName,
      startTime: trackerInfo.startTime.toISOString(),
      endTime: trackerInfo.endTime!.toISOString(),
      duration: trackerInfo.duration,
      durationMinutes: Math.round(trackerInfo.duration / 60000),
      screenshots: {
        count: trackerInfo.screenshotCount,
        paths: trackerInfo.screenshots.map(ss => ss.path)
      },
      keyboardEvents: {
        count: trackerInfo.keyboardEvents.length,
        events: trackerInfo.keyboardEvents
      },
      mouseEvents: {
        count: trackerInfo.mouseEvents.length,
        events: trackerInfo.mouseEvents
      },
      screenshotsDir: this.screenshotsDir || '',
      logsDir: this.logsDir || ''
    };

    this.activeTrackers.delete(taskId);

    return {
      success: true,
      summary
    };
  }

  /**
   * Start screenshot capture for a task
   */
  private startScreenshotCapture(taskId: string): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    // Take initial screenshot
    this.captureScreenshot(taskId);

    // Set up interval
    const interval = setInterval(() => {
      if (trackerInfo.running) {
        this.captureScreenshot(taskId);
      }
    }, TRACKER_CONFIG.SCREENSHOT_INTERVAL);

    this.screenshotIntervals.set(taskId, interval);
  }

  /**
   * Capture a screenshot
   */
  private async captureScreenshot(taskId: string): Promise<void> {
    try {
      const trackerInfo = this.activeTrackers.get(taskId);
      if (!trackerInfo || !this.screenshotsDir) return;

      const timestamp = new Date();
      const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');
      const filename = `task-${taskId}-${timestampStr}.png`;
      const filepath = path.join(this.screenshotsDir, filename);

      // Capture screenshot using screenshot-desktop
      const imgBuffer = await screenshot({ screen: 0, format: 'png' });

      await fs.writeFile(filepath, imgBuffer);

      // Store screenshot metadata
      const screenshotMetadata: ScreenshotMetadata = {
        timestamp: timestamp.toISOString(),
        path: filepath,
        taskId
      };

      trackerInfo.screenshotCount++;
      trackerInfo.screenshots.push(screenshotMetadata);

      // Upload screenshot to S3 (async, don't wait)
      logger.info(`[Screenshot] Checking upload conditions for ${filename}...`);
      logger.info(`[Screenshot] tenantId: ${trackerInfo.tenantId}, projectId: ${trackerInfo.projectId}, sessionId: ${trackerInfo.sessionId}`);
      
      if (trackerInfo.tenantId && trackerInfo.projectId && trackerInfo.sessionId) {
        logger.info(`[Screenshot] ✓ All IDs present, starting S3 upload for: ${filename} (task: ${taskId})`);
        const uploadStartTime = Date.now();
        
        S3UploadService.uploadScreenshot(
          filepath,
          trackerInfo.tenantId,
          trackerInfo.projectId,
          trackerInfo.sessionId
        ).then((result) => {
          const uploadDuration = Date.now() - uploadStartTime;
          if (result.success) {
            logger.info(`[Screenshot] ✓ Upload completed in ${uploadDuration}ms: ${filename}`);
          } else {
            logger.error(`[Screenshot] ✗ Upload failed after ${uploadDuration}ms: ${filename} - ${result.error}`);
          }
        }).catch((uploadError) => {
          const uploadDuration = Date.now() - uploadStartTime;
          logger.error(`[Screenshot] ✗ Upload error after ${uploadDuration}ms for task ${taskId}:`, uploadError);
          logger.error(`[Screenshot] Error details:`, uploadError.message, uploadError.stack);
        });
      } else {
        logger.warn(`[Screenshot] ⚠ Skipping upload - missing IDs (tenantId: ${trackerInfo.tenantId || 'MISSING'}, projectId: ${trackerInfo.projectId || 'MISSING'}, sessionId: ${trackerInfo.sessionId || 'MISSING'})`);
      }

      // Play screenshot sound
      if (TRACKER_CONFIG.ENABLE_SCREENSHOT_SOUND) {
        this.playScreenshotSound();
      }

    } catch (error: any) {
      logger.error(`Failed to capture screenshot for task ${taskId}:`, error);
    }
  }

  /**
   * Play screenshot sound
   */
  private playScreenshotSound(): void {
    try {
      const platform = process.platform;

      if (platform === 'darwin') {
        const soundPath = TRACKER_CONFIG.SCREENSHOT_SOUND_PATH;
        const childProcess = exec(`afplay "${soundPath}"`, (error) => {
          if (error) {
            // Try fallback sounds
            exec('afplay "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Shutter.aif"', (shutterError) => {
              if (shutterError) {
                exec('afplay "/System/Library/Sounds/Glass.aiff"', (glassError) => {
                  if (glassError) {
                    exec('osascript -e "beep"', () => {});
                  }
                });
              }
            });
          }
        });
        childProcess.unref();
      } else if (platform === 'win32') {
        exec('powershell -c "[console]::beep(800,200)"', () => {});
      } else {
        exec('paplay /usr/share/sounds/freedesktop/stereo/camera-shutter.oga 2>/dev/null || beep -f 800 -l 200', () => {});
      }
    } catch (error) {
      // Silent fail for sound
    }
  }

  private startInputTracking(taskId: string): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    const inputLogger: InputLogger = {
      taskId,
      startTime: Date.now(),
      lastKeyboardActivity: Date.now(),
      lastMouseActivity: Date.now(),
      keyboardCount: 0,
      mouseCount: 0,
      keyboardListener: null,
      mouseProcess: null,
      lastMousePosition: null
    };

    this.inputLoggers.set(taskId, inputLogger);

    if (TRACKER_CONFIG.ENABLE_KEYBOARD_TRACKING) {
      this.startKeyboardTracking(taskId, inputLogger).catch(error => {
        logger.error(`Error in startKeyboardTracking for task ${taskId}:`, (error as Error).message);
      });
    }

    if (TRACKER_CONFIG.ENABLE_MOUSE_TRACKING) {
      this.startMouseTracking(taskId, inputLogger);
    }
  }

  /**
   * Start real keyboard tracking using node-global-key-listener
   */
  private async startKeyboardTracking(taskId: string, inputLogger: InputLogger): Promise<void> {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    try {
      if (!this.globalKeyboardListener) {
        if (process.platform === 'darwin') {
          const possiblePaths = [
            path.join(process.cwd(), 'node_modules/node-global-key-listener/bin/MacKeyServer'),
            path.join(__dirname, '../../node_modules/node-global-key-listener/bin/MacKeyServer'),
            path.resolve(__dirname, '../../../node_modules/node-global-key-listener/bin/MacKeyServer')
          ];

          for (const possiblePath of possiblePaths) {
            try {
              if (fsSync.existsSync(possiblePath)) {
                const stats = fsSync.statSync(possiblePath);
                if (!(stats.mode & parseInt('111', 8))) {
                  fsSync.chmodSync(possiblePath, '755');
                }
                break;
              }
            } catch (chmodError) {
              continue;
            }
          }
        }

        this.globalKeyboardListener = new GlobalKeyboardListener({
          mac: {
            onError: (errorCode: number | null) => {
              if (errorCode === -1 || errorCode === 1000) {
                logger.warn('⚠️  macOS Accessibility permissions required for keyboard tracking');
              }
            }
          }
        });
      }

      const listenerCallback = (e: any, _down: any) => {
        if (!trackerInfo || !trackerInfo.running) return;

        if (e && e.state === 'DOWN') {
          const timestamp = new Date();
          const now = Date.now();

          const keyboardEvent: InputEvent = {
            timestamp: timestamp.toISOString(),
            type: 'keypress',
            key: e.name || 'unknown',
            rawKey: e.rawKey ? e.rawKey._nameRaw : undefined,
            state: e.state,
            taskId,
            elapsedSinceStart: now - trackerInfo.startTime.getTime()
          };

          trackerInfo.keyboardEvents.push(keyboardEvent);
          inputLogger.keyboardCount++;
          inputLogger.lastKeyboardActivity = now;
        }
      };

      await this.globalKeyboardListener!.addListener(listenerCallback);
      inputLogger.keyboardListener = listenerCallback;
    } catch (error: any) {
      logger.error(`Failed to start keyboard tracking for task ${taskId}:`, error.message);
      if (process.platform === 'darwin' && error.message && error.message.includes('permission')) {
        logger.warn('⚠️  macOS Accessibility permissions required');
      }
    }
  }

  /**
   * Start real mouse tracking using system-level monitoring
   */
  private startMouseTracking(taskId: string, inputLogger: InputLogger): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    try {
      if (process.platform === 'darwin') {
        this.startMacMouseTracking(taskId, inputLogger);
      } else if (process.platform === 'win32') {
        this.startWindowsMouseTracking(taskId, inputLogger);
      } else {
        this.startLinuxMouseTracking(taskId, inputLogger);
      }
    } catch (error: any) {
      logger.error(`Failed to start mouse tracking for task ${taskId}:`, error.message);
    }
  }

  /**
   * Start mouse tracking on macOS using system monitoring
   */
  private async startMacMouseTracking(taskId: string, inputLogger: InputLogger): Promise<void> {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    const robotLib = await loadRobot();
    if (!robotLib) return;

    const mouseCheckInterval = setInterval(() => {
      if (!trackerInfo.running) {
        clearInterval(mouseCheckInterval);
        return;
      }

      try {
        const mousePos = robotLib.getMousePos();
        if (!mousePos || mousePos.x === undefined || mousePos.y === undefined) {
          return;
        }

        const currentPos = { x: mousePos.x, y: mousePos.y };

        if (!inputLogger.lastMousePosition ||
            inputLogger.lastMousePosition.x !== currentPos.x ||
            inputLogger.lastMousePosition.y !== currentPos.y) {

          const timestamp = new Date();
          const now = Date.now();

          trackerInfo.mouseEvents.push({
            timestamp: timestamp.toISOString(),
            type: 'mouse_move',
            position: currentPos,
            taskId,
            elapsedSinceStart: now - trackerInfo.startTime.getTime()
          });

          inputLogger.mouseCount++;
          inputLogger.lastMouseActivity = now;
          inputLogger.lastMousePosition = currentPos;
        }
      } catch (error) {
        // Silent fail for mouse tracking errors
      }
    }, 100);

    inputLogger.mouseProcess = mouseCheckInterval;
  }

  private startWindowsMouseTracking(taskId: string, inputLogger: InputLogger): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    const mouseCheckInterval = setInterval(() => {
      if (!trackerInfo.running) {
        clearInterval(mouseCheckInterval);
        return;
      }

      exec('powershell -Command "[System.Windows.Forms.Cursor]::Position"', (error, stdout) => {
        if (!error && stdout) {
          const coords = stdout.trim().match(/\d+/g);
          if (coords && coords.length >= 2) {
            const currentPos = { x: parseInt(coords[0]), y: parseInt(coords[1]) };
            if (!inputLogger.lastMousePosition ||
                inputLogger.lastMousePosition.x !== currentPos.x ||
                inputLogger.lastMousePosition.y !== currentPos.y) {

              const timestamp = new Date();
              const now = Date.now();

              trackerInfo.mouseEvents.push({
                timestamp: timestamp.toISOString(),
                type: 'mouse_move',
                position: currentPos,
                taskId,
                elapsedSinceStart: now - trackerInfo.startTime.getTime()
              });

              inputLogger.mouseCount++;
              inputLogger.lastMouseActivity = now;
              inputLogger.lastMousePosition = currentPos;
            }
          }
        }
      });
    }, 100);

    inputLogger.mouseProcess = mouseCheckInterval;
  }

  private startLinuxMouseTracking(taskId: string, inputLogger: InputLogger): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    const mouseCheckInterval = setInterval(() => {
      if (!trackerInfo.running) {
        clearInterval(mouseCheckInterval);
        return;
      }

      exec('xdotool getmouselocation --shell', (error, stdout) => {
        if (!error && stdout) {
          const match = stdout.match(/X=(\d+).*Y=(\d+)/);
          if (match) {
            const currentPos = { x: parseInt(match[1]), y: parseInt(match[2]) };
            if (!inputLogger.lastMousePosition ||
                inputLogger.lastMousePosition.x !== currentPos.x ||
                inputLogger.lastMousePosition.y !== currentPos.y) {

              const timestamp = new Date();
              const now = Date.now();

              trackerInfo.mouseEvents.push({
                timestamp: timestamp.toISOString(),
                type: 'mouse_move',
                position: currentPos,
                taskId,
                elapsedSinceStart: now - trackerInfo.startTime.getTime()
              });

              inputLogger.mouseCount++;
              inputLogger.lastMouseActivity = now;
              inputLogger.lastMousePosition = currentPos;
            }
          }
        }
      });
    }, 100);

    inputLogger.mouseProcess = mouseCheckInterval;
  }

  /**
   * Stop input tracking for a task
   */
  private stopInputTracking(taskId: string): void {
    const inputLogger = this.inputLoggers.get(taskId);
    if (!inputLogger) return;

    if (inputLogger.keyboardListener && this.globalKeyboardListener) {
      try {
        this.globalKeyboardListener.removeListener(inputLogger.keyboardListener);
      } catch (error: any) {
        logger.error(`Failed to remove keyboard listener for task ${taskId}:`, error.message);
      }
      inputLogger.keyboardListener = null;
    }

    // Stop mouse tracking
    if (inputLogger.mouseProcess) {
      clearInterval(inputLogger.mouseProcess);
      inputLogger.mouseProcess = null;
    }
  }

  /**
   * Start metadata logging for a task
   */
  private startMetadataLogging(taskId: string): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    // Log metadata at intervals
    const metadataInterval = setInterval(() => {
      if (!trackerInfo.running) {
        clearInterval(metadataInterval);
        return;
      }

      this.logMetadata(taskId);
    }, TRACKER_CONFIG.METADATA_LOG_INTERVAL);

    this.metadataLogIntervals.set(taskId, metadataInterval);
  }

  /**
   * Log current metadata
   */
  private logMetadata(taskId: string): void {
    const trackerInfo = this.activeTrackers.get(taskId);
    if (!trackerInfo) return;

    const now = new Date();
    const elapsed = now.getTime() - trackerInfo.startTime.getTime();

    const metadata = {
      timestamp: now.toISOString(),
      taskId: trackerInfo.taskId,
      taskName: trackerInfo.taskName,
      elapsed: elapsed,
      elapsedMinutes: Math.round(elapsed / 60000),
      screenshots: {
        count: trackerInfo.screenshotCount,
        latest: trackerInfo.screenshots[trackerInfo.screenshots.length - 1] || null
      },
      keyboardEvents: {
        count: trackerInfo.keyboardEvents.length,
        latest: trackerInfo.keyboardEvents[trackerInfo.keyboardEvents.length - 1] || null
      },
      mouseEvents: {
        count: trackerInfo.mouseEvents.length,
        latest: trackerInfo.mouseEvents[trackerInfo.mouseEvents.length - 1] || null
      }
    };

    trackerInfo.metadataLogs.push(metadata);
  }

  /**
   * Save metadata log to file
   */
  private async saveMetadataLog(taskId: string, trackerInfo: ExtendedTrackerInfo): Promise<void> {
    try {
      if (!this.logsDir || !trackerInfo) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `task-${taskId}-${timestamp}.json`;
      const filepath = path.join(this.logsDir, filename);

      const logData = {
        taskId: trackerInfo.taskId,
        taskName: trackerInfo.taskName,
        startTime: trackerInfo.startTime.toISOString(),
        endTime: trackerInfo.endTime ? trackerInfo.endTime.toISOString() : new Date().toISOString(),
        duration: trackerInfo.duration || (new Date().getTime() - trackerInfo.startTime.getTime()),
        durationMinutes: Math.round((trackerInfo.duration || (new Date().getTime() - trackerInfo.startTime.getTime())) / 60000),
        summary: {
          screenshots: trackerInfo.screenshotCount,
          keyboardEvents: trackerInfo.keyboardEvents.length,
          mouseEvents: trackerInfo.mouseEvents.length
        },
        screenshots: trackerInfo.screenshots,
        keyboardEvents: trackerInfo.keyboardEvents,
        mouseEvents: trackerInfo.mouseEvents,
        metadataLogs: trackerInfo.metadataLogs
      };

      await fs.writeFile(filepath, JSON.stringify(logData, null, 2));
    } catch (error: any) {
      logger.error(`Failed to save metadata log for task ${taskId}:`, error.message);
    }
  }

  /**
   * Get tracker status for a task
   */
  getTrackerStatus(taskId: string): TrackerStatus {
    if (!this.activeTrackers.has(taskId)) {
      return { active: false };
    }

    const trackerInfo = this.activeTrackers.get(taskId)!;
    const now = Date.now();
    const elapsed = now - trackerInfo.startTime.getTime();

    return {
      active: true,
      taskId: trackerInfo.taskId,
      taskName: trackerInfo.taskName,
      startTime: trackerInfo.startTime,
      elapsed: elapsed,
      elapsedMinutes: Math.round(elapsed / 60000),
      screenshots: trackerInfo.screenshotCount,
      keyboardEvents: trackerInfo.keyboardEvents.length,
      mouseEvents: trackerInfo.mouseEvents.length
    };
  }

  /**
   * Generate and upload git diff
   */
  private async generateAndUploadGitDiff(taskId: string, trackerInfo: ExtendedTrackerInfo): Promise<void> {
    try {
      if (!trackerInfo.gitRepoPath || !this.logsDir) {
        logger.warn(`Cannot generate git diff: missing gitRepoPath or logsDir for task ${taskId}`);
        return;
      }

      // Check if it's a valid git repository
      const gitPath = path.join(trackerInfo.gitRepoPath, '.git');
      if (!fsSync.existsSync(gitPath)) {
        logger.warn(`Git repository not found at ${trackerInfo.gitRepoPath}`);
        return;
      }

      // Generate git diff
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `diff-${taskId}-${timestamp}.txt`;
      const filepath = path.join(this.logsDir, filename);

      try {
        // Get git diff (staged and unstaged changes)
        const { stdout: diffOutput } = await execAsync('git diff HEAD', {
          cwd: trackerInfo.gitRepoPath,
          timeout: 10000
        });

        // If no changes, try to get diff from start of tracking
        // For now, we'll use HEAD diff. In the future, we could store the initial commit hash
        if (!diffOutput || diffOutput.trim().length === 0) {
          logger.info(`No git changes found for task ${taskId}`);
          // Still create an empty file to indicate we checked
          await fs.writeFile(filepath, 'No changes detected.\n');
        } else {
          await fs.writeFile(filepath, diffOutput);
        }

        // Upload to S3
        if (trackerInfo.tenantId && trackerInfo.projectId && trackerInfo.sessionId) {
          const result = await S3UploadService.uploadRepoDiff(
            filepath,
            trackerInfo.tenantId,
            trackerInfo.projectId,
            trackerInfo.sessionId
          );

          if (result.success) {
            logger.info(`Successfully uploaded git diff for task ${taskId}`);
          } else {
            logger.error(`Failed to upload git diff for task ${taskId}: ${result.error}`);
          }
        }
      } catch (gitError: any) {
        logger.error(`Error generating git diff for task ${taskId}:`, gitError.message);
        // Create a file with the error message
        await fs.writeFile(filepath, `Error generating git diff: ${gitError.message}\n`);
      }
    } catch (error: any) {
      logger.error(`Failed to generate/upload git diff for task ${taskId}:`, error);
    }
  }

  /**
   * Get all active trackers
   */
  getAllActiveTrackers(): any[] {
    return Array.from(this.activeTrackers.values()).map(tracker => ({
      taskId: tracker.taskId,
      taskName: tracker.taskName,
      startTime: tracker.startTime,
      screenshots: tracker.screenshotCount
    }));
  }

  /**
   * Stop all trackers
   */
  stopAllTrackers(): void {
    const taskIds = Array.from(this.activeTrackers.keys());
    taskIds.forEach(taskId => this.stopTracking(taskId));

    // Cleanup global keyboard listener
    if (this.globalKeyboardListener) {
      try {
        this.globalKeyboardListener.kill();
        this.globalKeyboardListener = null;
      } catch (error: any) {
        logger.error('Failed to cleanup global keyboard listener:', error.message);
      }
    }
  }
}

export default new TrackerService();

