#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { TerminalToolCategory } from './tools/terminal';

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('port', {
    type: 'number',
    description: 'Port of the main Tabby-MCP server',
    default: 3001
  })
  .help()
  .alias('help', 'h')
  .parseSync();

// Configuration variables from command line and environment
const port = process.env.TABBY_MCP_PORT || argv.port;

// Setup functions
async function createStdioServer() {
  console.error('[Bridge] Starting stdio server...');
  
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
  
  console.error('[Bridge] Stdio server started successfully');
  console.error(`[Bridge] Connected to main server at http://localhost:${port}`);
}

// Start the server
createStdioServer().catch(error => {
  console.error('[Bridge] Failed to start stdio server:', error);
  process.exit(1);
}); 