# Tabby MCP STDIO Bridge

This is a bridge server that connects a stdio interface to the HTTP endpoints of Tabby MCP.

> Part of the [Tabby MCP Server](https://github.com/thuanpham582002/tabby-mcp-server) project.

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Start with default settings
npm start

# Specify the same port that the Tabby MCP server is running on
npm start -- --port 3002

# Enable logging to a file
npm start -- --log-enabled --log-file ~/logs/tabby.log

# Set log level (none, error, info, debug)
npm start -- --log-enabled --log-level debug

# Get help
npm start -- --help
```

## Environment Variables

You can also configure the bridge using environment variables:

- `TABBY_MCP_PORT`: Port of the main Tabby MCP server (default: 3001)
- `TABBY_LOG_ENABLED`: Set to '1' to enable logging
- `TABBY_LOG_FILE`: Path to log file
- `TABBY_LOG_LEVEL`: Log level (none, error, info, debug)

## Development

```bash
npm run dev
```

## Logging

The bridge supports logging to a file with different log levels. You can enable or disable logging at runtime using the toggle-logging utility:

```bash
# Enable logging
npm run toggle-logging -- --enable --log-file ~/logs/tabby.log

# Disable logging
npm run toggle-logging -- --disable

# Change log level
npm run toggle-logging -- --log-level debug

# Check current logging status
npm run toggle-logging -- --status
```

After installation, you can also use the global command:

```bash
tabby-toggle-logging --enable --log-file ~/logs/tabby.log
```

The logging configuration is stored in a `.tabby-mcp-logging.json` file in the current directory and can be reloaded without restarting the server.