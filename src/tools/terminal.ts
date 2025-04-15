import { McpTool, ToolCategory } from '../type/types';
import {
  AbortCommandTool,
  ExecCommandTool,
  GetTerminalBufferTool,
  SshSessionListTool
} from './terminal/index';

/**
 * Terminal tool category - contains all terminal-related tools
 */
export class TerminalToolCategory implements ToolCategory {
  name = 'terminal';
  mcpTools: McpTool<any>[] = [];

  constructor() {
    // Create and register all terminal tools
    const sshSessionListTool = new SshSessionListTool();
    const abortCommandTool = new AbortCommandTool();
    const execCommandTool = new ExecCommandTool();
    const getTerminalBufferTool = new GetTerminalBufferTool();

    // Add all tools to the registry
    this.mcpTools.push(
      sshSessionListTool.getTool(),
      abortCommandTool.getTool(),
      execCommandTool.getTool(),
      getTerminalBufferTool.getTool()
    );
  }
}