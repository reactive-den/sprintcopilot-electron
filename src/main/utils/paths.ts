import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const IS_PACKAGED = app.isPackaged;
export const APP_PATH = app.getAppPath();

/**
 * Get the path to a file in the preload directory
 */
export function getPreloadPath(filename: string): string {
  // Replace .js extension with .cjs for CommonJS preload script
  const cjsFilename = filename.replace(/\.js$/, '.cjs');
  if (IS_PACKAGED) {
    return path.join(APP_PATH, 'dist/preload', cjsFilename);
  }
  // In development, __dirname is in dist/main/utils, preload is compiled to dist/preload
  return path.join(__dirname, '../../preload', cjsFilename);
}

/**
 * Get the path to a file in the renderer directory
 */
export function getRendererPath(filename: string): string {
  if (IS_PACKAGED) {
    return path.join(APP_PATH, 'dist/renderer', filename);
  }
  // In development, __dirname is in dist/main/utils, renderer files are in dist/renderer
  return path.join(__dirname, '../../renderer', filename);
}

/**
 * Get the path to a file in the assets directory
 */
export function getAssetsPath(...paths: string[]): string {
  if (IS_PACKAGED) {
    return path.join(APP_PATH, 'assets', ...paths);
  }
  return path.join(__dirname, '../../../assets', ...paths);
}

/**
 * Get the path to user data directory
 */
export function getUserDataPath(...paths: string[]): string {
  return path.join(app.getPath('userData'), ...paths);
}
