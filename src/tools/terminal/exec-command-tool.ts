import * as z from 'zod';
import { createErrorResponse, McpResponse } from '../../type/types';
import { BaseTool } from './base-tool';
import { forwardToMainServer } from '../../services/forward.service';

/**
 * Tool for executing a command in a terminal
 */
export class ExecCommandTool extends BaseTool<{
  command: string;
  tabId?: string;
}> {
  constructor() {
    super();
  }

  getTool() {
    return {
      name: 'exec_command',
      description: 'Execute a command in a terminal session and return the output',
      schema: {
        command: z.string().describe('Command to execute in the terminal'),
        tabId: z.string().optional().describe('Tab ID to execute in, get from get_ssh_session_list')
      },
      handler: async (params: {
        command: string;
        tabId?: string;
      }): Promise<McpResponse> => {
        try {
          // Forward request to main server, keeping tabId as string
          return await forwardToMainServer('exec_command', {
            command: params.command,
            tabId: params.tabId
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createErrorResponse(`Failed to execute command: ${errorMessage}`);
        }
      }
    };
  }
}
