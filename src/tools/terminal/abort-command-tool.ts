import { createErrorResponse, McpResponse } from '../../type/types';
import { BaseTool } from './base-tool';
import { forwardToMainServer } from '../../services/forward.service';

/**
 * Tool for aborting the current command
 */
export class AbortCommandTool extends BaseTool<void> {
  constructor() {
    super();
  }

  getTool() {
    return {
      name: 'abort_command',
      description: 'Abort the currently running command',
      schema: undefined,
      handler: async (): Promise<McpResponse> => {
        try {
          // Forward request to main server
          return await forwardToMainServer('abort_command', undefined);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createErrorResponse(`Failed to abort command: ${errorMessage}`);
        }
      }
    };
  }
}
