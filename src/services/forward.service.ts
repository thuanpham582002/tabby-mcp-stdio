import fetch from 'node-fetch';
import { McpResponse, createErrorResponse, createSuccessResponse } from '../type/types';
import logger from '../utils/logger';

// Port of the main Tabby-MCP server
const port = process.env.TABBY_MCP_PORT || 3001;

/**
 * Forwards requests to the main server
 */
export async function forwardToMainServer(toolName: string, params: any): Promise<McpResponse> {
  try {
    const url = `http://localhost:${port}/api/tool/${toolName}`;

    // The main server's API endpoints expect the parameters directly in the request body,
    // not wrapped in a JSON-RPC structure with a 'params' field.
    // We'll send the parameters directly to match the server's expectations.

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params) // Send params directly, not wrapped in jsonRpcRequest
    };

    // Log the request for debugging
    logger.debug(`[Bridge] Forwarding to ${url} with params:`, params);
    logger.debug(`[Bridge] Request body:`, options.body);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[Bridge] HTTP error! Status: ${response.status}, Response: ${errorText}`);
      return createErrorResponse(`HTTP error! status: ${response.status}, Response: ${errorText}`);
    }

    const responseText = await response.text();
    logger.debug(`[Bridge] Raw response text:`, responseText);

    try {
      // Parse the response as JSON
      const responseData = JSON.parse(responseText);

      // Check for error in the response
      if (responseData.isError) {
        logger.error(`[Bridge] Error in response:`, responseData);
        return responseData; // Return the error response directly
      }

      // Return the response directly since it should already be in McpResponse format
      return responseData;
    } catch (e) {
      logger.error(`[Bridge] Failed to parse response as JSON:`, e);
      return createSuccessResponse(responseText);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[Bridge] Error forwarding ${toolName} to main server:`, errorMessage);
    return createErrorResponse(`Error forwarding request: ${errorMessage}`);
  }
}