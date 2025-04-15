import { createErrorResponse, McpResponse } from '../../type/types';
import { BaseTool } from './base-tool';
import { forwardToMainServer } from '../../services/forward.service';

/**
 * Tool for getting a list of SSH sessions
 */
export class SshSessionListTool extends BaseTool<void> {
  constructor() {
    super();
  }

  getTool() {
    return {
      name: 'get_ssh_session_list',
      description: 'Get a list of all SSH sessions',
      schema: undefined,
      handler: async (): Promise<McpResponse> => {
        try {
          // Forward request to main server
          return await forwardToMainServer('get_ssh_session_list', {});
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return createErrorResponse(`Failed to get SSH sessions: ${errorMessage}`);
        }
      }
    };
  }
}
