/**
 * AuditLoggerService
 * Service for capturing system activity and tenant audit logs.
 */

import { auditRepository, CreateAuditLogDto } from '../repositories/audit.repository';

export class AuditLoggerService {
  public static async log(dto: CreateAuditLogDto) {
    try {
      return await auditRepository.log(dto);
    } catch (err) {
      console.error('Failed to log audit event:', err);
      return null;
    }
  }
}
