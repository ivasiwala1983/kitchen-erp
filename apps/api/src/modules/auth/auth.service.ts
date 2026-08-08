/**
 * Auth Module — Service
 * Business logic for login, token refresh, and password management.
 */

import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../config/jwt';
import { AuthRepository } from './auth.repository';
import { UnauthorizedError, BadRequestError } from '../../shared/errors';
import type { LoginInput, RefreshTokenInput, ChangePasswordInput } from './auth.validation';
import type { TokenPair } from './auth.types';
import type { UserPublic } from '@kitchen-erp/types';
import { Role } from '@kitchen-erp/types';
import { recordAuditLog } from '../auditLog/auditLog.routes';

export class AuthService {
  private repo = new AuthRepository();

  /**
   * Authenticate a user by email/password.
   * For non-super-admin users, validates the tenantSlug matches.
   */
  async login(dto: LoginInput): Promise<{ tokens: TokenPair; user: UserPublic }> {
    const user = await this.repo.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Tenant check for non-SUPER_ADMIN users
    if (user.role !== Role.SUPER_ADMIN) {
      if (!user.tenant || !user.tenant.isActive) {
        throw new UnauthorizedError('Tenant organization is inactive or deleted');
      }

      if (dto.tenantSlug && user.tenant.slug !== dto.tenantSlug.toLowerCase()) {
        throw new UnauthorizedError(
          `Account belongs to tenant '${user.tenant.slug}', not '${dto.tenantSlug}'`
        );
      }
    }

    const tokenPayload = {
      sub: user.id,
      userId: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug || null,
      role: user.role as Role,
      email: user.email,
    };

    const tokens: TokenPair = {
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
    };

    const userPublic: UserPublic = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            plan: user.tenant.plan,
            currency: user.tenant.currency,
          }
        : null,
    };

    recordAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
    });

    return { tokens, user: userPublic };
  }

  /**
   * Issue a new access token using a valid refresh token.
   */
  async refreshToken(dto: RefreshTokenInput): Promise<TokenPair> {
    let payload;
    try {
      payload = verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await this.repo.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or inactive');
    }

    const tokenPayload = {
      sub: user.id,
      userId: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug || null,
      role: user.role as Role,
      email: user.email,
    };

    return {
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
    };
  }

  /**
   * Get the current authenticated user's profile.
   */
  async getMe(userId: string): Promise<UserPublic> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            plan: user.tenant.plan,
            currency: user.tenant.currency,
          }
        : null,
    };
  }

  /**
   * Change the current user's password.
   */
  async changePassword(userId: string, dto: ChangePasswordInput): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.repo.updatePassword(userId, newHash);
  }
}
