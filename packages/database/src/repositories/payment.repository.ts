/**
 * PaymentRepository
 * Encapsulates Vendor Payment data access and atomic ledger payment recording.
 */

import { Prisma, VendorPayment, PaymentMethod, LedgerTransactionType } from '@prisma/client';
import { prisma } from '../client/prisma';
import { ledgerRepository } from './ledger.repository';

export interface CreatePaymentDto {
  tenantId: string;
  vendorId: string;
  amount: number | Prisma.Decimal;
  paymentDate?: Date;
  paymentMethod: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  createdBy: string;
}

export class PaymentRepository {
  /**
   * Create a vendor payment and corresponding ledger transaction atomically inside a single Prisma transaction.
   */
  async createPayment(
    dto: CreatePaymentDto
  ): Promise<{ payment: VendorPayment; currentBalance: number }> {
    return prisma.$transaction(async (tx) => {
      // 1. Get or create ledger account
      const account = await ledgerRepository.findOrCreateAccount(dto.tenantId, dto.vendorId, tx);

      // 2. Create VendorPayment entity
      const payment = await tx.vendorPayment.create({
        data: {
          tenantId: dto.tenantId,
          vendorId: dto.vendorId,
          ledgerAccountId: account.id,
          amount: dto.amount,
          paymentDate: dto.paymentDate || new Date(),
          paymentMethod: dto.paymentMethod,
          reference: dto.reference || null,
          note: dto.note || null,
          createdBy: dto.createdBy,
        },
        include: {
          vendor: { include: { category: true } },
          ledgerAccount: true,
        },
      });

      // 3. Create LedgerTransaction entity
      await tx.ledgerTransaction.create({
        data: {
          tenantId: dto.tenantId,
          ledgerAccountId: account.id,
          vendorId: dto.vendorId,
          type: LedgerTransactionType.PAYMENT,
          amount: dto.amount,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          transactionDate: payment.paymentDate,
          paymentMethod: dto.paymentMethod,
          note: dto.note || null,
          createdBy: dto.createdBy,
        },
      });

      // 4. Compute updated balance after payment
      const currentBalance = await ledgerRepository.computeBalance(
        account.id,
        account.openingBalance,
        tx
      );

      return { payment, currentBalance };
    });
  }

  async findById(id: string, tenantId: string) {
    return prisma.vendorPayment.findFirst({
      where: { id, tenantId },
      include: {
        vendor: { include: { category: true } },
        ledgerAccount: true,
      },
    });
  }

  async findAll(
    tenantId: string,
    params: {
      skip: number;
      take: number;
      vendorId?: string;
      startDate?: string;
      endDate?: string;
      paymentMethod?: PaymentMethod;
    }
  ) {
    const where: Prisma.VendorPaymentWhereInput = {
      tenantId,
      ...(params.vendorId && { vendorId: params.vendorId }),
      ...(params.paymentMethod && { paymentMethod: params.paymentMethod }),
      ...(params.startDate || params.endDate
        ? {
            paymentDate: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vendorPayment.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { paymentDate: 'desc' },
        include: {
          vendor: { include: { category: true } },
        },
      }),
      prisma.vendorPayment.count({ where }),
    ]);

    return { items, total };
  }
}

export const paymentRepository = new PaymentRepository();
