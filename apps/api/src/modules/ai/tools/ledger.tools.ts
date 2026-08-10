/**
 * Ledger Domain Read-Only AI Tools
 */

import { ledgerRepository } from '@kitchen-erp/database';
import type { ToolDefinition } from '../guards/ai-read-only.guard';

export const ledgerTools: ToolDefinition[] = [
  {
    name: 'getLedgerSummary',
    description:
      'Get tenant-wide ledger summary including total payable balance, credit, and vendor count.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async (_params, context) => {
      const summary = await ledgerRepository.getTenantLedgerSummary(context.tenantId);
      return {
        totalPayable: Number(summary.totalPayable || 0),
        totalCredit: Number(summary.totalCredit || 0),
        netBalance: Number(summary.netBalance || 0),
        vendorCount: summary.vendorCount,
      };
    },
  },
  {
    name: 'getVendorLedger',
    description:
      'Get transaction history and current balance for a specific vendor ledger account.',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        vendorId: { type: 'string', description: 'Vendor UUID' },
        startDate: { type: 'string', description: 'ISO start date' },
        endDate: { type: 'string', description: 'ISO end date' },
      },
      required: ['vendorId'],
    },
    handler: async (params, context) => {
      const account = await ledgerRepository.findAccountByVendor(context.tenantId, params.vendorId);
      if (!account) {
        return { found: false, message: 'Vendor ledger account not found for this tenant.' };
      }

      const { items, total } = await ledgerRepository.findTransactions(
        context.tenantId,
        account.id,
        {
          skip: 0,
          take: 15,
          startDate: params.startDate,
          endDate: params.endDate,
        }
      );

      return {
        found: true,
        vendorName: account.vendor?.name || 'Unknown',
        currentBalance: Number(account.currentBalance || 0),
        openingBalance: Number(account.openingBalance || 0),
        totalTransactions: total,
        recentTransactions: items.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          transactionDate: t.transactionDate,
          paymentMethod: t.paymentMethod,
          note: t.note,
        })),
      };
    },
  },
  {
    name: 'getOutstandingVendorBalances',
    description:
      'Get list of top vendors with highest outstanding payable balances (amount owed to vendors).',
    isReadOnly: true,
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of vendors to return (default 10)' },
      },
    },
    handler: async (params, context) => {
      const limit = Math.min(params.limit || 10, 20);
      const { items } = await ledgerRepository.findAllAccounts(context.tenantId, {
        skip: 0,
        take: 50,
      });

      const summary = await ledgerRepository.getTenantLedgerSummary(context.tenantId);

      const accountsWithBalance = items
        .map((acc) => ({
          vendorId: acc.vendorId,
          vendorName: acc.vendor?.name || 'Unknown Vendor',
          categoryName: acc.vendor?.category?.name || 'Uncategorized',
          phone: acc.vendor?.phone || null,
          balance: Number(acc.currentBalance || 0),
        }))
        .filter((acc) => acc.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      return {
        totalPayable: Number(summary.totalPayable || 0),
        totalVendorsWithBalance: accountsWithBalance.length,
        topOutstandingVendors: accountsWithBalance.slice(0, limit),
      };
    },
  },
];
