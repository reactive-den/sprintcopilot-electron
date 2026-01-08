// Load environment variables
import 'dotenv/config';
import { app } from 'electron';
import logger from './utils/logger.js';
import WindowManager from './windows/WindowManager.js';
import AppLifecycle from './services/AppLifecycle.js';
import IPCHandlers from './handlers/IPCHandlers.js';
import TrackerService from './services/TrackerService.js';

// Log environment variable status (without exposing tokens)
logger.info('Environment variables loaded:');
logger.info(`CLICKUP_API_TOKEN: ${process.env.CLICKUP_API_TOKEN ? '✓ Set' : '✗ Not set'}`);
logger.info(`CLICKUP_LIST_ID: ${process.env.CLICKUP_LIST_ID || '✗ Not set'}`);
logger.info(`CLICKUP_USER_ID: ${process.env.CLICKUP_USER_ID || '✗ Not set'}`);

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    WindowManager.focusMainWindow();
  });

  // Initialize application
  app.whenReady().then(() => {
    initializeApp();
  });
}

function initializeApp(): void {
  // Initialize services
  AppLifecycle.initialize();

  // Initialize IPC handlers
  IPCHandlers.initialize();

  // Create main window
  WindowManager.createMainWindow();

  // Handle window activation (macOS)
  app.on('activate', () => {
    if (WindowManager.getAllWindows().length === 0) {
      WindowManager.createMainWindow();
    }
  });

  // Handle window close
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Cleanup before quit
  app.on('before-quit', () => {
    // Stop all trackers before quitting
    TrackerService.stopAllTrackers();

    IPCHandlers.cleanup();
    AppLifecycle.cleanup();
  });
}

