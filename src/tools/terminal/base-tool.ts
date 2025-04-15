import { McpTool } from '../../type/types';

/**
 * Base class for terminal tools
 */
export abstract class BaseTool<T = any> {
  constructor() {
    // No initialization needed
  }
  
  /**
   * Get the tool definition
   */
  abstract getTool(): McpTool<T>;
}
