#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Define the options we'll check for
const validOptions = ['enable', 'disable', 'log-file', 'log-level', 'status'];

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('enable', {
    type: 'boolean',
    description: 'Enable logging',
    conflicts: 'disable'
  })
  .option('disable', {
    type: 'boolean',
    description: 'Disable logging',
    conflicts: 'enable'
  })
  .option('log-file', {
    type: 'string',
    description: 'Set log file path'
  })
  .option('log-level', {
    type: 'string',
    description: 'Set log level (none, error, info, debug)',
    choices: ['none', 'error', 'info', 'debug']
  })
  .option('status', {
    type: 'boolean',
    description: 'Show current logging status',
    default: false
  })
  .check((argv) => {
    // Check if at least one of our options is specified
    const hasOption = validOptions.some(opt => argv[opt as keyof typeof argv] !== undefined);
    if (!hasOption) {
      throw new Error('At least one option must be specified');
    }
    return true;
  })
  .help()
  .alias('help', 'h')
  .parseSync();

// Find the PID file to get the process ID
function findPidFile(): string | null {
  // Common locations for PID files
  const pidLocations = [
    process.cwd(),
    path.join(process.cwd(), 'logs'),
    '/var/run',
    '/tmp'
  ];

  for (const location of pidLocations) {
    const pidFile = path.join(location, 'tabby-mcp-stdio.pid');
    if (fs.existsSync(pidFile)) {
      return pidFile;
    }
  }

  return null;
}

// Find the config file to read/write logging configuration
function findConfigFile(): string {
  // Default to current directory
  const configDir = process.cwd();
  return path.join(configDir, '.tabby-mcp-logging.json');
}

// Read current logging configuration
function readConfig(): any {
  const configFile = findConfigFile();

  if (fs.existsSync(configFile)) {
    try {
      const configData = fs.readFileSync(configFile, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error(`Error reading config file: ${error}`);
    }
  }

  // Default configuration
  return {
    enabled: false,
    logFile: '',
    logLevel: 'info'
  };
}

// Write updated configuration
function writeConfig(config: any): void {
  const configFile = findConfigFile();

  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
    console.log(`Configuration saved to ${configFile}`);
  } catch (error) {
    console.error(`Error writing config file: ${error}`);
  }
}

// Send signal to the process to reload configuration
function signalProcess(): void {
  const pidFile = findPidFile();

  if (!pidFile) {
    console.error('PID file not found. Is the server running?');
    return;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);

    if (isNaN(pid)) {
      console.error('Invalid PID in file');
      return;
    }

    // Send SIGUSR1 signal to reload configuration
    process.kill(pid, 'SIGUSR1');
    console.log(`Signal sent to process ${pid} to reload configuration`);
  } catch (error) {
    console.error(`Error signaling process: ${error}`);
  }
}

// Main function
function main() {
  // Read current configuration
  const config = readConfig();

  // Update configuration based on command line arguments
  let configChanged = false;

  if (argv.enable) {
    config.enabled = true;
    configChanged = true;
    console.log('Logging enabled');
  }

  if (argv.disable) {
    config.enabled = false;
    configChanged = true;
    console.log('Logging disabled');
  }

  if (argv['log-file'] !== undefined) {
    config.logFile = argv['log-file'];
    configChanged = true;
    console.log(`Log file set to: ${config.logFile}`);
  }

  if (argv['log-level'] !== undefined) {
    config.logLevel = argv['log-level'];
    configChanged = true;
    console.log(`Log level set to: ${config.logLevel}`);
  }

  // Show current status if requested
  if (argv.status) {
    console.log('Current logging configuration:');
    console.log(`- Enabled: ${config.enabled}`);
    console.log(`- Log file: ${config.logFile || '(none)'}`);
    console.log(`- Log level: ${config.logLevel}`);
  }

  // Save configuration if changed
  if (configChanged) {
    writeConfig(config);
    signalProcess();
  }
}

// Run the main function
main();
