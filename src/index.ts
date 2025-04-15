#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
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

// Set environment variable for the forwarding service
process.env.TABBY_MCP_PORT = String(argv.port);

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

// Import StdioServerTransport at the top of the file

// Main function to run the client-server bridge
async function main() {
  try {
    // Check if a server script path was provided
    const serverScriptPath = process.argv[2];
    if (!serverScriptPath) {
      logger.error('No server script path provided. Usage: tabby-mcp-stdio <server-script-path>');
      process.exit(1);
    }

    // Create a new MCP client
    const client = new MCPClient();

    // Connect to the specified server
    await client.connectToServer(serverScriptPath);

    // Create an MCP server that exposes the tools from the client
    await client.createMcpServer();

    // Handle cleanup on exit
    process.on('exit', async () => {
      await client.disconnect();
    });

    // Handle signals for graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('[Bridge] Received SIGINT, shutting down...');
      await client.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('[Bridge] Received SIGTERM, shutting down...');
      await client.disconnect();
      process.exit(0);
    });

    logger.info('[Bridge] Client-server bridge is running');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Bridge] Failed to start client-server bridge: ${errorMessage}`);
    process.exit(1);
  }
}

// Start the application
main();

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

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types';

class MCPClient {
  private mcp: Client;
  private transport: SSEClientTransport | null = null;
  private tools: Tool[] = [];
  private server: McpServer | null = null;

  constructor() {
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }

  /**
   * Connect to an MCP server and retrieve its tools
   */
  async connectToServer(serverScriptPath: string): Promise<void> {
    try {
      logger.info(`[Client] Connecting to MCP server at ${serverScriptPath}...`);

      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      if (!isJs && !isPy) {
        throw new Error("Server script must be a .js or .py file");
      }

      // For SSE transport, we need to connect to a server URL
      // Assuming the server is running on localhost with the port from command line
      const serverUrl = `http://localhost:${process.env.TABBY_MCP_PORT}/sse`;
      logger.info(`[Client] Using SSE transport with URL: ${serverUrl}`);

      this.transport = new SSEClientTransport(new URL(serverUrl));

      await this.mcp.connect(this.transport);
      logger.info(`[Client] Connected to MCP server`);

      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools;

      logger.info(
        `[Client] Retrieved ${this.tools.length} tools from server: ${this.tools.map(({ name }) => name).join(', ')}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Client] Failed to connect to MCP server: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create an MCP server that exposes the tools retrieved from the client connection
   */
  async createMcpServer(): Promise<void> {
    if (this.tools.length === 0) {
      throw new Error("No tools available. Connect to a server first.");
    }

    try {
      logger.info('[Server] Starting MCP server...');

      this.server = new McpServer({
        name: "Tabby-Bridge",
        version: "1.0.0"
      });

      // Register all tools retrieved from the client
      for (const tool of this.tools) {
        logger.debug(`[Server] Registering tool: ${tool.name}`);
        // Convert the inputSchema to a proper Zod schema
        // For simplicity, we'll just use an empty schema if the original is complex
        const schema = {};

        this.server.tool(
          tool.name,
          tool.description || '',
          schema,
          async (args: any, _extra: any): Promise<CallToolResult> => {
            try {
              // Call the tool on the original server through our client connection
              const result = await this.mcp.callTool({
                name: tool.name,
                arguments: args
              });
              return result as CallToolResult;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error(`[Server] Error calling tool ${tool.name}: ${errorMessage}`);
              return {
                content: [{ type: "text", text: `Error: ${errorMessage}` }],
                isError: true
              };
            }
          }
        );
      }

      // Connect transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('[Server] MCP server started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Server] Failed to start MCP server: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Disconnect from the server and clean up resources
   */
  async disconnect(): Promise<void> {
    try {
      if (this.server) {
        await this.server.close();
        this.server = null;
        logger.info('[Server] MCP server closed');
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
        logger.info('[Client] Disconnected from MCP server');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to clean up resources: ${errorMessage}`);
    }
  }
}
