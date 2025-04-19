#!/usr/bin/env node

import { MCPClient } from './client/mcp-client';
import { parseCliArgs } from './config/cli';
import { initializeLogging } from './config/logging';
import logger from './utils/logger';

/**
 * Main function to run the client-server bridge
 */
async function main() {
  // Parse command line arguments
  const config = parseCliArgs();

  // Initialize logging
  initializeLogging(config.loggingEnabled, config.logFile, config.logLevel);

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
