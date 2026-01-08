import { BrowserWindow } from 'electron';
import { getPreloadPath, getRendererPath } from '../utils/paths.js';
import { isDevelopment } from '../../shared/utils/env.js';
import windowConfig from '../../shared/constants/windowConfig.js';

class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  /**
   * Create the main application window
   */
  createMainWindow(): BrowserWindow | undefined {
    if (this.windows.has('main')) {
      this.focusWindow('main');
      return this.windows.get('main');
    }

    const window = new BrowserWindow({
      width: windowConfig.main.width,
      height: windowConfig.main.height,
      minWidth: windowConfig.main.minWidth,
      minHeight: windowConfig.main.minHeight,
      webPreferences: {
        preload: getPreloadPath('preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true
      },
      show: false, // Don't show until ready
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      frame: true // Use default frame to avoid drag issues
    });

    // Load the renderer
    window.loadFile(getRendererPath('index.html'));

    // Show window when ready
    window.once('ready-to-show', () => {
      window.show();

      if (isDevelopment()) {
        window.webContents.openDevTools();
      }
    });

    // Handle window closed
    window.on('closed', () => {
      this.windows.delete('main');
    });

    this.windows.set('main', window);
    return window;
  }

  /**
   * Focus a specific window by ID
   */
  focusWindow(id: string): void {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.focus();
    }
  }

  /**
   * Focus the main window
   */
  focusMainWindow(): void {
    this.focusWindow('main');
  }

  /**
   * Get a window by ID
   */
  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * Get all windows
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  /**
   * Close all windows
   */
  closeAllWindows(): void {
    this.windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.windows.clear();
  }
}

// Export singleton instance
export default new WindowManager();

