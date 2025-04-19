import fs from 'fs';
import path from 'path';
import logger, { LogLevel } from '../utils/logger';

/**
 * Initialize logging based on configuration
 */
export function initializeLogging(enabled: boolean, logFile?: string, logLevel: LogLevel = LogLevel.INFO): void {
  logger.updateConfig({
    enabled,
    logFile,
    logLevel
  });

  // If logging is enabled and a log file is specified, create logs directory if needed
  if (enabled && logFile) {
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create log directory: ${error}`);
      }
    }
  }
}

/**
 * Read logging configuration from file
 */
export function readLoggingConfig(): void {
  const configFile = path.join(process.cwd(), '.tabby-mcp-logging.json');

  if (fs.existsSync(configFile)) {
    try {
      const configData = fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(configData);

      // Convert string log level to enum
      const logLevel = (() => {
        switch (config.logLevel) {
          case 'none': return LogLevel.NONE;
          case 'error': return LogLevel.ERROR;
          case 'info': return LogLevel.INFO;
          case 'debug': return LogLevel.DEBUG;
          default: return LogLevel.INFO;
        }
      })();

      // Update logger configuration
      logger.updateConfig({
        enabled: config.enabled,
        logFile: config.logFile || undefined,
        logLevel
      });

      logger.info(`Logging configuration reloaded from ${configFile}`);
      logger.info(`Logging ${config.enabled ? 'enabled' : 'disabled'}, level: ${config.logLevel}, file: ${config.logFile || '(none)'}`);
    } catch (error) {
      logger.error(`Failed to read logging config: ${error}`);
    }
  }
}

// Signal handling removed along with PID functionality