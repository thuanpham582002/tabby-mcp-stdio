import fetch from 'node-fetch';
import { McpResponse, createErrorResponse, createSuccessResponse, createJsonResponse } from '../type/types';

// Port of the main Tabby-MCP server
const port = process.env.TABBY_MCP_PORT || 3001;

/**
 * Forwards requests to the main server
 */
export async function forwardToMainServer(toolName: string, params: any): Promise<McpResponse> {
  try {
    const url = `http://localhost:${port}/api/tool/${toolName}`;
    
    // Format as JSON-RPC 2.0
    const jsonRpcRequest = {
      jsonrpc: "2.0",
      method: toolName,
      params: params,
      id: Date.now()
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonRpcRequest)
    };
    
    console.error(`[Bridge] Forwarding to ${url} with body:`, options.body);
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bridge] HTTP error! Status: ${response.status}, Response: ${errorText}`);
      return createErrorResponse(`HTTP error! status: ${response.status}, Response: ${errorText}`);
    }
    
    const responseText = await response.text();
    console.error(`[Bridge] Raw response text:`, responseText);
    
    try {
      const jsonRpcResponse = JSON.parse(responseText);
      
      // Check for JSON-RPC error
      if (jsonRpcResponse.error) {
        console.error(`[Bridge] JSON-RPC error:`, JSON.stringify(jsonRpcResponse.error));
        return createErrorResponse(`JSON-RPC error: ${JSON.stringify(jsonRpcResponse.error)}`);
      }
      
      // Extract result from JSON-RPC response and pass it through
      return jsonRpcResponse.result ? 
        (typeof jsonRpcResponse.result === 'object' ? 
          createJsonResponse(jsonRpcResponse.result) : 
          createSuccessResponse(String(jsonRpcResponse.result))) :
        createSuccessResponse('Operation completed successfully');
    } catch (e) {
      console.error(`[Bridge] Failed to parse response as JSON:`, e);
      return createSuccessResponse(responseText);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Bridge] Error forwarding ${toolName} to main server:`, errorMessage);
    return createErrorResponse(`Error forwarding request: ${errorMessage}`);
  }
} 