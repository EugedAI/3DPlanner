import type { LogLevel } from '../core/types';

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export class Logger {
  private level: number;
  private prefix: string;

  constructor(logLevel: LogLevel = 'warn', prefix = 'ScreenplayParser') {
    this.level = LOG_LEVELS[logLevel];
    this.prefix = prefix;
  }

  setLevel(logLevel: LogLevel): void {
    this.level = LOG_LEVELS[logLevel];
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.error) {
      this.log('ERROR', message, args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.warn) {
      this.log('WARN', message, args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.info) {
      this.log('INFO', message, args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_LEVELS.debug) {
      this.log('DEBUG', message, args);
    }
  }

  private log(level: string, message: string, args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${this.prefix}] [${level}] ${message}`;
    if (args.length > 0) {
      // Use structured logging - no console.log
      switch (level) {
        case 'ERROR':
          console.error(formatted, ...args);
          break;
        case 'WARN':
          console.warn(formatted, ...args);
          break;
        default:
          console.info(formatted, ...args);
          break;
      }
    } else {
      switch (level) {
        case 'ERROR':
          console.error(formatted);
          break;
        case 'WARN':
          console.warn(formatted);
          break;
        default:
          console.info(formatted);
          break;
      }
    }
  }
}
