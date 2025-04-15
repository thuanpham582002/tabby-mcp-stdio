#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { TerminalToolCategory } from './tools/terminal';
import logger, { LogLevel } from './utils/logger';
import fs from 'fs';
import path from 'path';

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

// Configuration variables from command line and environment
const port = process.env.TABBY_MCP_PORT || argv.port;

// Configure logger
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

logger.updateConfig({
  enabled: loggingEnabled,
  logFile: logFile,
  logLevel
});

// If logging is enabled, create logs directory if it doesn't exist
if (loggingEnabled && logFile) {
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create log directory: ${error}`);
    }
  }
}

// Setup functions
async function createStdioServer() {
  logger.info('[Bridge] Starting stdio server...');

  const server = new McpServer({
    name: "Tabby-Bridge",
    version: "1.0.0"
  });

  // Create terminal tool category
  const terminalTools = new TerminalToolCategory();

  // Register all terminal tools
  terminalTools.mcpTools.forEach(tool => {
    server.tool(tool.name, tool.description, tool.schema || {}, tool.handler);
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('[Bridge] Stdio server started successfully');
  logger.info(`[Bridge] Connected to main server at http://localhost:${port}`);
}

// Start the server
createStdioServer().catch(error => {
  logger.error('[Bridge] Failed to start stdio server:', error);
  process.exit(1);
});

// Handle process exit to close logger
process.on('exit', () => {
  logger.close();
});

// Write PID file for the toggle-logging utility
function writePidFile() {
  const pidDir = process.cwd();
  const pidFile = path.join(pidDir, 'tabby-mcp-stdio.pid');

  try {
    fs.writeFileSync(pidFile, process.pid.toString(), 'utf8');
    logger.debug(`PID file written to ${pidFile}`);

    // Remove PID file on exit
    process.on('exit', () => {
      try {
        fs.unlinkSync(pidFile);
        logger.debug('PID file removed');
      } catch (error) {
        // Ignore errors when removing PID file
      }
    });
  } catch (error) {
    logger.error(`Failed to write PID file: ${error}`);
  }
}

// Read logging configuration from file
function readLoggingConfig() {
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

// Write initial PID file
writePidFile();

// Handle signals
process.on('SIGUSR1', () => {
  logger.info('[Bridge] Received SIGUSR1, reloading logging configuration...');
  readLoggingConfig();
});

process.on('SIGINT', () => {
  logger.info('[Bridge] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('[Bridge] Received SIGTERM, shutting down...');
  process.exit(0);
});