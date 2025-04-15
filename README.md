# Tabby MCP STDIO Bridge

This is a bridge server that connects a stdio interface to the HTTP endpoints of Tabby MCP.

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Start with default settings
npm start

# Specify a different port for the main Tabby MCP server
npm start -- --port 3002

# Enable long-live mode to keep the process running indefinitely
npm start -- --long-live

# Get help
npm start -- --help
```

## Environment Variables

You can also configure the bridge using environment variables:

- `TABBY_MCP_PORT`: Port of the main Tabby MCP server (default: 3001)
- `TABBY_MCP_LONG_LIVE`: Set to '1' to enable long-live mode

## Development

```bash
npm run dev
``` 