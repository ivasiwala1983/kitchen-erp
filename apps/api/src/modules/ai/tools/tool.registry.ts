import { AiReadOnlyGuard, type ToolDefinition } from '../guards/ai-read-only.guard';
import { purchaseTools } from './purchase.tools';
import { vendorTools } from './vendor.tools';
import { productTools } from './product.tools';
import { inventoryTools } from './inventory.tools';
import { ledgerTools } from './ledger.tools';
import { reportTools } from './report.tools';
import { featureService } from '../../feature/feature.service';
import { FeatureCode } from '@kitchen-erp/types';

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerAll([
      ...purchaseTools,
      ...vendorTools,
      ...productTools,
      ...inventoryTools,
      ...ledgerTools,
      ...reportTools,
    ]);
  }

  /**
   * Registers a single tool, applying read-only guard check.
   */
  public register(tool: ToolDefinition): void {
    AiReadOnlyGuard.validateToolRegistration(tool);
    this.tools.set(tool.name, tool);
  }

  /**
   * Registers an array of tools.
   */
  public registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Resolves feature code and user-friendly module name required for a tool.
   */
  public resolveRequiredFeature(
    toolName: string
  ): { featureCode: FeatureCode; displayName: string } | null {
    const name = toolName.toLowerCase();
    if (name.includes('inventory') || name.includes('lowstock') || name.includes('stock')) {
      return { featureCode: FeatureCode.FEATURE_INVENTORY, displayName: 'Inventory' };
    }
    if (name.includes('ledger') || name.includes('balance') || name.includes('payment')) {
      return { featureCode: FeatureCode.FEATURE_LEDGER, displayName: 'Ledger' };
    }
    if (name.includes('purchase')) {
      return { featureCode: FeatureCode.FEATURE_PURCHASES, displayName: 'Purchase' };
    }
    if (name.includes('vendor')) {
      return { featureCode: FeatureCode.FEATURE_VENDORS, displayName: 'Vendor' };
    }
    if (name.includes('product')) {
      return { featureCode: FeatureCode.FEATURE_PRODUCTS, displayName: 'Product' };
    }
    if (name.includes('report') || name.includes('stats')) {
      return { featureCode: FeatureCode.FEATURE_REPORTS, displayName: 'Reports' };
    }
    return null;
  }

  /**
   * Returns schema definitions suitable for OpenRouter OpenAI-compatible function specs.
   * If effectiveFeatures map is provided, filters out tools for disabled tenant features.
   */
  public getOpenRouterToolSpecs(effectiveFeatures?: Record<string, boolean>): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> {
    let availableTools = Array.from(this.tools.values());

    if (effectiveFeatures) {
      availableTools = availableTools.filter((t) => {
        const feat = this.resolveRequiredFeature(t.name);
        if (!feat) return true;
        return effectiveFeatures[feat.featureCode] !== false;
      });
    }

    return availableTools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  /**
   * Gets a registered tool definition by name.
   */
  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Executes a registered tool by name with strict read-only and feature entitlement validation.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async executeTool(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: Record<string, any>,
    context: { tenantId: string; userId: string; role: string }
  ): Promise<{ success: boolean; result: unknown; dataSources: string[] }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(
        `[ToolRegistry] Unauthorized tool request: Tool '${name}' is not registered.`
      );
    }

    AiReadOnlyGuard.validateToolExecution(tool);

    // Tenant feature entitlement guard
    const reqFeature = this.resolveRequiredFeature(name);
    if (reqFeature && context.tenantId) {
      const isEnabled = await featureService.isFeatureEnabled(
        context.tenantId,
        reqFeature.featureCode
      );
      if (!isEnabled) {
        return {
          success: false,
          result: {
            message: `😊 ${reqFeature.displayName} insights aren't enabled for your workspace right now.`,
          },
          dataSources: [],
        };
      }
    }

    try {
      const result = await tool.handler(params || {}, context);
      const dataSources = this.resolveDataSources(name);
      return { success: true, result, dataSources };
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(`[ToolRegistry] Error executing tool '${name}':`, err?.message || error);
      return {
        success: false,
        result: { error: `Failed to fetch data for ${name}` },
        dataSources: [],
      };
    }
  }

  private resolveDataSources(toolName: string): string[] {
    if (toolName.includes('Purchase')) return ['Purchase History'];
    if (toolName.includes('Vendor')) return ['Vendor Data'];
    if (toolName.includes('Product')) return ['Product Catalog'];
    if (toolName.includes('Inventory') || toolName.includes('LowStock')) return ['Inventory Logs'];
    if (toolName.includes('Ledger') || toolName.includes('Balance')) return ['Ledger & Payments'];
    if (toolName.includes('Report') || toolName.includes('Stats')) return ['Analytical Reports'];
    return ['Business Records'];
  }
}

export const toolRegistry = new ToolRegistry();
