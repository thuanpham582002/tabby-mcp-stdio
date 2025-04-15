import fs from 'fs';
import path from 'path';

/**
 * Log levels
 */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  enabled: boolean;
  logFile?: string;
  logLevel: LogLevel;
}

/**
 * Logger class for handling application logging
 * Supports both console and file logging with toggle functionality
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private fileStream: fs.WriteStream | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: LoggerConfig) {
    this.config = {
      enabled: config.enabled,
      logFile: config.logFile,
      logLevel: config.logLevel || LogLevel.INFO
    };

    // Initialize file stream if logging is enabled and a log file is specified
    this.initializeFileStream();
  }

  /**
   * Get the logger instance (singleton)
   */
  public static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config || {
        enabled: false,
        logLevel: LogLevel.INFO
      });
    } else if (config) {
      // Update configuration if provided
      Logger.instance.updateConfig(config);
    }
    
    return Logger.instance;
  }

  /**
   * Initialize or reinitialize the file stream
   */
  private initializeFileStream(): void {
    // Close existing stream if it exists
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }

    // Create a new stream if logging is enabled and a log file is specified
    if (this.config.enabled && this.config.logFile) {
      try {
        // Ensure directory exists
        const dir = path.dirname(this.config.logFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Create write stream
        this.fileStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });
        
        // Log initialization
        const timestamp = new Date().toISOString();
        this.fileStream.write(`[${timestamp}] [INFO] Logger initialized\n`);
      } catch (error) {
        console.error(`Failed to initialize log file: ${error}`);
        this.fileStream = null;
      }
    }
  }

  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    const oldConfig = { ...this.config };
    
    // Update config
    this.config = {
      ...this.config,
      ...config
    };

    // Reinitialize file stream if necessary
    if (
      oldConfig.enabled !== this.config.enabled ||
      oldConfig.logFile !== this.config.logFile
    ) {
      this.initializeFileStream();
    }
  }

  /**
   * Enable or disable logging
   */
  public setEnabled(enabled: boolean): void {
    this.updateConfig({ enabled });
  }

  /**
   * Set log level
   */
  public setLogLevel(level: LogLevel): void {
    this.updateConfig({ logLevel: level });
  }

  /**
   * Set log file
   */
  public setLogFile(logFile: string): void {
    this.updateConfig({ logFile });
  }

  /**
   * Log a message with the specified level
   */
  private log(level: LogLevel, prefix: string, message: string, ...args: any[]): void {
    // Skip if logging is disabled or level is higher than configured
    if (!this.config.enabled || level > this.config.logLevel) {
      return;
    }

    // Format message with timestamp
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${prefix}] ${message}`;
    
    // Format arguments if provided
    if (args.length > 0) {
      try {
        const formattedArgs = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        formattedMessage += ` ${formattedArgs}`;
      } catch (error) {
        formattedMessage += ` [Error formatting args: ${error}]`;
      }
    }

    // Write to console (always use stderr for consistency with existing code)
    console.error(formattedMessage);

    // Write to file if available
    if (this.fileStream) {
      this.fileStream.write(formattedMessage + '\n');
    }
  }

  /**
   * Log an error message
   */
  public error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  /**
   * Log an info message
   */
  public info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  /**
   * Log a debug message
   */
  public debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  /**
   * Close the logger and any open file streams
   */
  public close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

// Export a default logger instance
export default Logger.getInstance();
