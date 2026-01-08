import { isDevelopment } from '../../shared/utils/env.js';
import type { ILogger, LogLevel } from '../../types/index.js';

class Logger implements ILogger {
  private logLevel: LogLevel;

  constructor() {
    this.logLevel = isDevelopment() ? 'debug' : 'info';
  }

  private _log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    console.log(prefix, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel === 'debug') {
      this._log('debug', message, ...args);
    }
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

export default new Logger();

