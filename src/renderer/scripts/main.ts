import { App } from './app/App.js';
import { Logger } from './utils/logger.js';

// Prevent drag event errors
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('dragEvent')) {
    event.preventDefault();
    console.warn('Suppressed dragEvent error:', event.message);
  }
});

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  const logger = new Logger();
  logger.info('Renderer process initialized');

  try {
    const app = new App();
    await app.initialize();
  } catch (error: any) {
    logger.error('Failed to initialize app:', error);
  }
});

