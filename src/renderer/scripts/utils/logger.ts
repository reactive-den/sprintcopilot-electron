/**
 * Logger utility for renderer process
 */
import type { ILogger } from '../../../types/index.js';

export class Logger implements ILogger {
  private enabled: boolean = true;

  private _log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [Renderer]`;
    console.log(prefix, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this._log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this._log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this._log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this._log('error', message, ...args);
  }
}

