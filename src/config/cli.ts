import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { LogLevel } from '../utils/logger';

/**
 * CLI configuration interface
 */
export interface CliConfig {
  port: number;
  logFile: string | undefined;
  logLevel: LogLevel;
  loggingEnabled: boolean;
}

/**
 * Parse command line arguments and return configuration
 */
export function parseCliArgs(): CliConfig {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option('port', {
      type: 'number',
      description: 'Port of the main Tabby-MCP server',
      default: 3001
    })
    .option('log-file', {
      type: 'string',
      description: 'Path to log file',
      default: ''
    })
    .option('log-level', {
      type: 'string',
      description: 'Log level (none, error, info, debug)',
      default: 'info',
      choices: ['none', 'error', 'info', 'debug']
    })
    .option('log-enabled', {
      type: 'boolean',
      description: 'Enable logging',
      default: false,
      alias: 'enable'
    })
    .help()
    .alias('help', 'h')
    .parseSync();
  
  // Set environment variable for the forwarding service
  process.env.TABBY_MCP_PORT = String(argv.port);
  
  // Determine log level
  const logLevel = (() => {
    // Check environment variable first, then command line argument
    const level = process.env.TABBY_LOG_LEVEL || argv['log-level'];
    switch (level) {
      case 'none': return LogLevel.NONE;
      case 'error': return LogLevel.ERROR;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  })();
  
  // Check if logging is enabled from environment or command line
  const loggingEnabled =
    process.env.TABBY_LOG_ENABLED === '1' ||
    Boolean(argv['log-enabled']);
  
  // Get log file from environment or command line
  const logFile = process.env.TABBY_LOG_FILE || argv['log-file'] || undefined;

  return {
    port: argv.port,
    logFile,
    logLevel,
    loggingEnabled
  };
}