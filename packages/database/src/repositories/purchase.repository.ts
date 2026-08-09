/**
 * PurchaseRepository
 * Encapsulates all Purchase data access queries.
 */

import { Prisma, Purchase, PurchaseStatus, LedgerTransactionType } from '@prisma/client';
import { prisma } from '../client/prisma';
import { ledgerRepository } from './ledger.repository';

export interface PurchaseItemInput {
  productId: string;
  qty: number;
  rate: number;
}

export interface CreatePurchaseDto {
  tenantId: string;
  vendorId: string;
  userId: string;
  items: PurchaseItemInput[];
  notes?: string;
  purchaseDate?: Date;
  status?: PurchaseStatus;
}

export interface UpdatePurchaseDto {
  vendorId?: string;
  items?: PurchaseItemInput[];
  notes?: string | null;
  status?: PurchaseStatus;
  invoiceUrl?: string | null;
  invoiceFid?: string | null;
  invoiceStoragePath?: string | null;
  invoiceFileName?: string | null;
  invoiceMimeType?: string | null;
  invoiceSize?: number | null;
  invoiceUploadedAt?: Date | null;
  invoiceUploadedBy?: string | null;
  updatedBy?: string;
}

export class PurchaseRepository {
  async findById(id: string, tenantId: string) {
    return prisma.purchase.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        vendor: { include: { category: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
        items: { include: { product: { include: { category: true } } } },
      },
    });
  }

  async findAll(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      search?: string;
      vendorId?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      status?: PurchaseStatus;
    }
  ) {
    const where: Prisma.PurchaseWhereInput = {
      tenantId,
      deletedAt: null,
      ...(params.vendorId && { vendorId: params.vendorId }),
      ...(params.userId && { userId: params.userId }),
      ...(params.status && { status: params.status }),
      ...(params.startDate || params.endDate
        ? {
            purchaseDate: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { purchaseDate: 'desc' },
        include: {
          vendor: { include: { category: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
          items: { include: { product: { include: { category: true } } } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    return { items, total };
  }

  async create(dto: CreatePurchaseDto) {
    const preparedItems = dto.items.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      rate: item.rate,
      total: item.qty * item.rate,
    }));

    const grandTotal = preparedItems.reduce((acc, curr) => acc + curr.total, 0);

    return prisma.$transaction(async (tx) => {
      // 1. Create Purchase record with items
      const purchase = await tx.purchase.create({
        data: {
          tenantId: dto.tenantId,
          vendorId: dto.vendorId,
          userId: dto.userId,
          grandTotal,
          notes: dto.notes || null,
          status: dto.status || PurchaseStatus.CONFIRMED,
          purchaseDate: dto.purchaseDate || new Date(),
          createdBy: dto.userId,
          updatedBy: dto.userId,
          items: {
            createMany: {
              data: preparedItems,
            },
          },
        },
        include: {
          vendor: { include: { category: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
          items: { include: { product: { include: { category: true } } } },
        },
      });

      // 2. Ensure LedgerAccount exists for Tenant + Vendor
      const account = await ledgerRepository.findOrCreateAccount(dto.tenantId, dto.vendorId, tx);

      // 3. Create LedgerTransaction atomically
      await tx.ledgerTransaction.create({
        data: {
          tenantId: dto.tenantId,
          ledgerAccountId: account.id,
          vendorId: dto.vendorId,
          type: LedgerTransactionType.PURCHASE,
          amount: grandTotal,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          transactionDate: purchase.purchaseDate,
          note: dto.notes || null,
          createdBy: dto.userId,
        },
      });

      return purchase;
    });
  }

  async update(id: string, tenantId: string, dto: UpdatePurchaseDto) {
    return prisma.$transaction(async (tx) => {
      let grandTotal: number | undefined;

      if (dto.items && dto.items.length > 0) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

        const preparedItems = dto.items.map((item) => ({
          purchaseId: id,
          productId: item.productId,
          qty: item.qty,
          rate: item.rate,
          total: item.qty * item.rate,
        }));

        grandTotal = preparedItems.reduce((acc, curr) => acc + curr.total, 0);

        await tx.purchaseItem.createMany({ data: preparedItems });
      }

      return tx.purchase.update({
        where: { id },
        data: {
          ...(dto.vendorId && { vendorId: dto.vendorId }),
          ...(grandTotal !== undefined && { grandTotal }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.status && { status: dto.status }),
          ...(dto.invoiceUrl !== undefined && { invoiceUrl: dto.invoiceUrl }),
          ...(dto.invoiceFid !== undefined && { invoiceFid: dto.invoiceFid }),
          ...(dto.invoiceStoragePath !== undefined && {
            invoiceStoragePath: dto.invoiceStoragePath,
          }),
          ...(dto.invoiceFileName !== undefined && { invoiceFileName: dto.invoiceFileName }),
          ...(dto.invoiceMimeType !== undefined && { invoiceMimeType: dto.invoiceMimeType }),
          ...(dto.invoiceSize !== undefined && { invoiceSize: dto.invoiceSize }),
          ...(dto.invoiceUploadedAt !== undefined && { invoiceUploadedAt: dto.invoiceUploadedAt }),
          ...(dto.invoiceUploadedBy !== undefined && { invoiceUploadedBy: dto.invoiceUploadedBy }),
          ...(dto.updatedBy && { updatedBy: dto.updatedBy }),
        },
        include: {
          vendor: { include: { category: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
          items: { include: { product: { include: { category: true } } } },
        },
      });
    });
  }

  async softDelete(id: string, tenantId: string, deletedBy?: string): Promise<Purchase> {
    return prisma.purchase.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: deletedBy,
      },
    });
  }
}

export const purchaseRepository = new PurchaseRepository();
