import { createErrorResponse, McpResponse } from '../../type/types';
import { BaseTool } from './base-tool';
import { forwardToMainServer } from '../../services/forward.service';
import { z } from 'zod';

/**
 * Tool for getting terminal buffer content with line range options
 */
export class GetTerminalBufferTool extends BaseTool {
  constructor() {
    super();
  }

  getTool() {
    return {
      name: 'get_terminal_buffer',
      description: 'Get terminal buffer content with options to retrieve specific line ranges from the bottom',
      schema: {
        tabId: z.string().describe('Tab ID to get buffer from, get from get_ssh_session_list'),
        startLine: z.number().int().min(1).optional().default(1)
          .describe('Starting line number from the bottom (1-based, default: 1)'),
        endLine: z.number().int().optional().default(-1)
          .describe('Ending line number from the bottom (1-based, default: -1 for all lines)')
      },
      handler: async (params: {
        tabId: string;
        startLine?: number;
        endLine?: number;
      }): Promise<McpResponse> => {
        try {
          // Forward request to main server
          return await forwardToMainServer('get_terminal_buffer', params);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createErrorResponse(`Failed to get terminal buffer: ${errorMessage}`);
        }
      }
    };
  }
}
