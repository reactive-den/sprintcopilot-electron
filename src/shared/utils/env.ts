/**
 * Environment utility functions
 */

/**
 * Check if application is in development mode
 */
export function isDevelopment(): boolean {
  // In ES modules, we can check NODE_ENV and use a global check
  // For main process, electron.app will be available via import
  return process.env.NODE_ENV === 'development' ||
         (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');
}

/**
 * Check if application is in production mode
 */
export function isProduction(): boolean {
  return !isDevelopment();
}

/**
 * Get current environment
 */
export function getEnvironment(): 'development' | 'production' {
  return isDevelopment() ? 'development' : 'production';
}

