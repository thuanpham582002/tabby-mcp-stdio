#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import logger, { LogLevel } from './utils/logger';
import fs from 'fs';
import path from 'path';
import { forwardToMainServer } from './services/forward.service';


import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types';
import { z, ZodRawShape } from 'zod';


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
  async connectToServer(): Promise<void> {
    try {
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
   * Converts JSON Schema properties to Zod schema
   * Handles the core types and properties needed for our use case
   */
  fromJsonSchema(jsonProps: Record<string, any>): ZodRawShape {
    const shape: ZodRawShape = {};
  
    for (const key in jsonProps) {
      const def = jsonProps[key];
      
      // Start with basic type
      try {
        if (def.type === "string") {
          let schema = z.string();
          
          // Add description if available
          if (def.description) {
            schema = schema.describe(def.description);
          }
          
          shape[key] = schema;
        }
        else if (def.type === "integer") {
          let schema = z.number().int();
          
          // Handle minimum constraint
          if (typeof def.minimum === "number") {
            schema = schema.min(def.minimum);
          }
          
          // Add description if available
          if (def.description) {
            schema = schema.describe(def.description);
          }
          
          // Handle default value
          if (def.default !== undefined) {
            shape[key] = schema.default(def.default);
          } else {
            shape[key] = schema;
          }
        }
        else if (def.type === "number") {
          let schema = z.number();
          
          // Handle minimum constraint
          if (typeof def.minimum === "number") {
            schema = schema.min(def.minimum);
          }
          
          // Add description if available
          if (def.description) {
            schema = schema.describe(def.description);
          }
          
          // Handle default value
          if (def.default !== undefined) {
            shape[key] = schema.default(def.default);
          } else {
            shape[key] = schema;
          }
        }
        else if (def.type === "boolean") {
          let schema = z.boolean();
          
          // Add description if available
          if (def.description) {
            schema = schema.describe(def.description);
          }
          
          shape[key] = schema;
        }
        else if (def.type === "object" && def.properties) {
          // For nested objects, recursively process
          const nestedShape = this.fromJsonSchema(def.properties);
          shape[key] = z.object(nestedShape);
        }
        else if (def.type === "array") {
          // Handle arrays
          shape[key] = z.array(z.any());
        }
        else {
          // Fallback for any other types
          shape[key] = z.any();
          if (def.description) {
            shape[key] = shape[key].describe(def.description);
          }
        }
      } catch (error) {
        // If any error occurs during conversion, fallback to any()
        logger.error(`[Server] Error converting schema for ${key}:`, error);
        shape[key] = z.any();
      }
    }
    
    return shape;
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
        logger.debug(`[Server] Tool ${tool.name} input schema:`, tool.inputSchema.properties);
        
        // Convert the JSON Schema to a Zod schema using the fromJsonSchema method
        // Ensure properties exists, default to empty object if undefined
        const inputProperties = tool.inputSchema.properties || {};
        const zodSchema = this.fromJsonSchema(inputProperties);
        logger.debug(`[Server] Tool ${tool.name} zod schema:`, zodSchema);
        
        this.server.tool(
          tool.name,
          tool.description || '',
          zodSchema,
          async (args, extra)=> {
            logger.debug(`[Server] Tool ${tool.name} called with params:`, args);
            
            try {
              // Call the tool on the original server through our client connection
              const { success, data, error } = await forwardToMainServer(tool.name, args);
              if (!success) {
                return {
                  content: [{ type: "text", text: `Error: ${error}` }],
                  isError: true
                };
              }
              return data;
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

// Main function to run the client-server bridge
async function main() {
  logger.info('[Bridge] Starting client-server bridge...');
  try {
    // Create a new MCP client
    const client = new MCPClient();

    // Connect to the specified server
    await client.connectToServer();

    // Create an MCP server that exposes the tools from the client
    await client.createMcpServer();

    // Handle cleanup on exit
    process.on('exit', async () => {
      await client.disconnect();
      logger.close();
    });

    // Handle signals for graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('[Bridge] Received SIGINT, shutting down...');
      await client.disconnect();
      logger.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('[Bridge] Received SIGTERM, shutting down...');
      await client.disconnect();
      logger.close();
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

// Handle SIGUSR1 for reloading logging configuration
process.on('SIGUSR1', () => {
  logger.info('[Bridge] Received SIGUSR1, reloading logging configuration...');
  readLoggingConfig();
});
