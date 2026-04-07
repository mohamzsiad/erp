import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { verifyPassword, hashPassword } from '../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  verifyAccessToken,
} from '../utils/jwt.js';
import type { LoginResponse, AuthUser, PermissionSet, JwtPayload } from '@clouderp/shared';

const PERMISSIONS_CACHE_TTL = 300; // 5 minutes in seconds

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    // Find user with role
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), isActive: true },
      include: {
        role: true,
        company: {
          select: { modulesEnabled: true, isActive: true },
        },
      },
    });

    if (!user) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    if (!user.company.isActive) {
      throw Object.assign(new Error('Company account is inactive'), { statusCode: 403 });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Load permissions
    const permissions = await this.loadPermissions(user.id, user.roleId);

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user.id,
      companyId: user.companyId,
      roleId: user.roleId,
      email: user.email,
    });

    const rawRefreshToken = generateRefreshToken();
    const hashedRefreshToken = hashRefreshToken(rawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashedRefreshToken,
        deviceInfo: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: refreshTokenExpiresAt(),
      },
    });

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId,
      roleId: user.roleId,
      roleName: user.role.name,
      locationId: user.locationId,
      enabledModules: (user.company.modulesEnabled as string[]) as any,
    };

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: authUser,
      permissions,
    };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────
  async refresh(rawRefreshToken: string): Promise<{ accessToken: string }> {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, companyId: true, roleId: true, email: true, isActive: true },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
    }

    if (!stored.user.isActive) {
      throw Object.assign(new Error('User account is inactive'), { statusCode: 401 });
    }

    const accessToken = signAccessToken({
      userId: stored.user.id,
      companyId: stored.user.companyId,
      roleId: stored.user.roleId,
      email: stored.user.email,
    });

    return { accessToken };
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Get current user ─────────────────────────────────────────────────────
  async getMe(userId: string): Promise<AuthUser & { permissions: PermissionSet[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        role: true,
        company: { select: { modulesEnabled: true } },
      },
    });

    const permissions = await this.loadPermissions(userId, user.roleId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId,
      roleId: user.roleId,
      roleName: user.role.name,
      locationId: user.locationId,
      enabledModules: (user.company.modulesEnabled as string[]) as any,
      permissions,
    };
  }

  // ── Load & cache permissions ─────────────────────────────────────────────
  async loadPermissions(userId: string, roleId: string): Promise<PermissionSet[]> {
    const cacheKey = `perms:${userId}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PermissionSet[];
    }

    const perms = await this.prisma.permission.findMany({
      where: { roleId },
      select: { module: true, resource: true, action: true },
    });

    const permissionSets: PermissionSet[] = perms.map((p) => ({
      module: p.module as any,
      resource: p.resource as any,
      action: p.action as any,
    }));

    await this.redis.setex(cacheKey, PERMISSIONS_CACHE_TTL, JSON.stringify(permissionSets));

    return permissionSets;
  }

  // ── Invalidate permission cache (call after role change) ─────────────────
  async invalidatePermissionCache(userId: string): Promise<void> {
    await this.redis.del(`perms:${userId}`);
  }
}
