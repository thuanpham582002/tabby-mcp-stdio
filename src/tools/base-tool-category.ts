import { McpTool, ToolCategory } from '../type/types';

/**
 * Base class for all tool categories
 * Provides common functionality for tool management
 */
export abstract class BaseToolCategory implements ToolCategory {
  /**
   * The name of the tool category
   */
  abstract name: string;
  
  /**
   * List of MCP tools in this category
   */
  protected _mcpTools: McpTool<any>[] = [];

  /**
   * Get all MCP tools in this category
   */
  get mcpTools(): McpTool<any>[] {
    return this._mcpTools;
  }

  /**
   * Register a tool in this category
   */
  protected registerTool<T>(tool: McpTool<T>): void {
    if (!tool.description) {
      // Set a default description to avoid errors
      tool.description = `Tool: ${tool.name}`;
    }

    this._mcpTools.push(tool);
  }
}
