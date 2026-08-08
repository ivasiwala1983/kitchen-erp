/**
 * AuditRepository
 * Encapsulates all Audit Trail data access queries.
 */

import { Prisma, AuditLog } from '@prisma/client';
import { prisma } from '../client/prisma';

export interface CreateAuditLogDto {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export class AuditRepository {
  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        tenantId: dto.tenantId || null,
        userId: dto.userId || null,
        action: dto.action,
        entity: dto.entity,
        entityId: dto.entityId || null,
        oldValues: (dto.oldValues as Prisma.InputJsonValue) || Prisma.JsonNull,
        newValues: (dto.newValues as Prisma.InputJsonValue) || Prisma.JsonNull,
        ip: dto.ip || null,
        userAgent: dto.userAgent || null,
      },
    });
  }

  async findAll(params: {
    skip: number;
    take: number;
    tenantId?: string | null;
    userId?: string;
    entity?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    items: (AuditLog & { user?: { id: string; name: string; email: string } | null })[];
    total: number;
  }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(params.tenantId !== undefined && { tenantId: params.tenantId }),
      ...(params.userId && { userId: params.userId }),
      ...(params.entity && { entity: params.entity }),
      ...(params.action && { action: params.action }),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate && { gte: new Date(params.startDate) }),
              ...(params.endDate && { lte: new Date(params.endDate) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}

export const auditRepository = new AuditRepository();
