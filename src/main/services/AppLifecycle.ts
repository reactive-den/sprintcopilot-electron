import { app } from 'electron';
import logger from '../utils/logger.js';

class AppLifecycle {
  private initialized: boolean = false;

  /**
   * Initialize application services
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('AppLifecycle already initialized');
      return;
    }

    logger.info('Initializing application...');

    // Set app user model ID (Windows)
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.sprintcopilot.app');
    }

    // Prevent navigation to external websites
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        if (parsedUrl.origin !== 'file://') {
          event.preventDefault();
          logger.warn('Prevented navigation to:', navigationUrl);
        }
      });
    });

    // Prevent new window creation
    app.on('web-contents-created', (_event, contents) => {
      contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
      });

      // Suppress console errors for dragEvent (common Electron issue)
      contents.on('console-message', (event, _level, message, _line, _sourceId) => {
        if (message.includes('dragEvent') && message.includes('not defined')) {
          event.preventDefault();
          logger.debug('Suppressed dragEvent console error');
        }
      });
    });

    this.initialized = true;
    logger.info('Application initialized successfully');
  }

  /**
   * Cleanup before application quit
   */
  cleanup(): void {
    logger.info('Cleaning up application...');
    // Add cleanup logic here (close database connections, etc.)
    this.initialized = false;
  }
}

// Export singleton instance
export default new AppLifecycle();

