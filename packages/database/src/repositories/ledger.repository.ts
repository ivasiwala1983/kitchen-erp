/**
 * LedgerRepository
 * Encapsulates all Vendor Ledger data access queries and balance calculations.
 */

import {
  Prisma,
  LedgerAccount,
  LedgerTransaction,
  LedgerTransactionType,
  LedgerAccountStatus,
} from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateLedgerTransactionDto {
  tenantId: string;
  ledgerAccountId: string;
  vendorId: string;
  type: LedgerTransactionType;
  amount: number | Prisma.Decimal;
  referenceType?: string | null;
  referenceId?: string | null;
  transactionDate?: Date;
  paymentMethod?: any | null;
  note?: string | null;
  createdBy?: string | null;
}

export class LedgerRepository {
  /**
   * Find or atomically create a LedgerAccount for a given tenant + vendor.
   * Can accept an optional Prisma transaction client `tx`.
   */
  async findOrCreateAccount(
    tenantId: string,
    vendorId: string,
    tx?: Prisma.TransactionClient
  ): Promise<LedgerAccount> {
    const client = tx || prisma;
    const existing = await client.ledgerAccount.findUnique({
      where: {
        tenantId_vendorId: {
          tenantId,
          vendorId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return client.ledgerAccount.create({
      data: {
        tenantId,
        vendorId,
        openingBalance: 0,
        status: LedgerAccountStatus.ACTIVE,
      },
    });
  }

  /**
   * Compute current balance for a ledger account based on transactions.
   * Formula:
   * Balance = Opening Balance + Sum(PURCHASE, ADJUSTMENT) - Sum(PAYMENT, REFUND)
   */
  async computeBalance(
    ledgerAccountId: string,
    openingBalance: Prisma.Decimal | number = 0,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    const transactions = await client.ledgerTransaction.findMany({
      where: { ledgerAccountId },
      select: {
        type: true,
        amount: true,
      },
    });

    let balance = Number(openingBalance) || 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      if (
        tx.type === LedgerTransactionType.PURCHASE ||
        tx.type === LedgerTransactionType.DEBIT_NOTE
      ) {
        balance += amt;
      } else if (
        tx.type === LedgerTransactionType.PAYMENT ||
        tx.type === LedgerTransactionType.REFUND ||
        tx.type === LedgerTransactionType.CREDIT_NOTE
      ) {
        balance -= amt;
      } else if (tx.type === LedgerTransactionType.OPENING_BALANCE) {
        balance += amt;
      }
    }

    return balance;
  }

  /**
   * Find a single vendor's ledger account with computed balance and vendor details.
   */
  async findAccountByVendor(tenantId: string, vendorId: string) {
    const account = await this.findOrCreateAccount(tenantId, vendorId);

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
      include: { category: true },
    });

    if (!vendor) return null;

    const balance = await this.computeBalance(account.id, account.openingBalance);

    return {
      ...account,
      vendor,
      currentBalance: balance,
      isVendorCredit: balance < 0,
      absBalance: Math.abs(balance),
    };
  }

  /**
   * Find all vendor ledger accounts for a tenant with pagination, search, and balances.
   */
  async findAllAccounts(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      search?: string;
      categoryId?: string;
      isActive?: boolean;
    }
  ) {
    const whereVendor: Prisma.VendorWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search, mode: 'insensitive' } },
          { gst: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [vendors, totalVendors] = await Promise.all([
      prisma.vendor.findMany({
        where: whereVendor,
        skip: params.skip,
        take: params.take,
        orderBy: { name: 'asc' },
        include: { category: true },
      }),
      prisma.vendor.count({ where: whereVendor }),
    ]);

    // Ensure a ledger account exists for each vendor and compute balance
    const items = await Promise.all(
      vendors.map(async (vendor) => {
        const account = await this.findOrCreateAccount(tenantId, vendor.id);
        const balance = await this.computeBalance(account.id, account.openingBalance);

        // Fetch last transaction for display summary
        const lastTx = await prisma.ledgerTransaction.findFirst({
          where: { ledgerAccountId: account.id },
          orderBy: { transactionDate: 'desc' },
        });

        return {
          id: account.id,
          tenantId: account.tenantId,
          vendorId: vendor.id,
          vendor,
          openingBalance: Number(account.openingBalance),
          status: account.status,
          currentBalance: balance,
          isVendorCredit: balance < 0,
          absBalance: Math.abs(balance),
          lastTransactionDate: lastTx?.transactionDate || account.createdAt,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        };
      })
    );

    return { items, total: totalVendors };
  }

  /**
   * Summary overview of ledger payables and credits for a tenant.
   */
  async getTenantLedgerSummary(tenantId: string) {
    const vendors = await prisma.vendor.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      select: { id: true },
    });

    let totalPayable = 0;
    let totalCredit = 0;

    for (const v of vendors) {
      const account = await this.findOrCreateAccount(tenantId, v.id);
      const balance = await this.computeBalance(account.id, account.openingBalance);

      if (balance > 0) {
        totalPayable += balance;
      } else if (balance < 0) {
        totalCredit += Math.abs(balance);
      }
    }

    return {
      totalPayable,
      totalCredit,
      vendorCount: vendors.length,
      netBalance: totalPayable - totalCredit,
    };
  }

  /**
   * Create a LedgerTransaction (supports transaction client for atomic execution).
   */
  async createTransaction(
    dto: CreateLedgerTransactionDto,
    tx?: Prisma.TransactionClient
  ): Promise<LedgerTransaction> {
    const client = tx || prisma;
    return client.ledgerTransaction.create({
      data: {
        tenantId: dto.tenantId,
        ledgerAccountId: dto.ledgerAccountId,
        vendorId: dto.vendorId,
        type: dto.type,
        amount: dto.amount,
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId || null,
        transactionDate: dto.transactionDate || new Date(),
        paymentMethod: dto.paymentMethod || null,
        note: dto.note || null,
        createdBy: dto.createdBy || null,
      },
    });
  }

  /**
   * Find paginated transactions for a vendor ledger account.
   */
  async findTransactions(
    tenantId: string,
    ledgerAccountId: string,
    params: {
      skip: number;
      take: number;
      type?: LedgerTransactionType;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const where: Prisma.LedgerTransactionWhereInput = {
      tenantId,
      ledgerAccountId,
      ...(params.type && { type: params.type }),
      ...(params.startDate || params.endDate
        ? {
            transactionDate: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.ledgerTransaction.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { transactionDate: 'desc' },
      }),
      prisma.ledgerTransaction.count({ where }),
    ]);

    return { items, total };
  }
}

export const ledgerRepository = new LedgerRepository();
