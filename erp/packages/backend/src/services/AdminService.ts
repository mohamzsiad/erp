import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { hashPassword, validatePasswordStrength } from '../utils/password.js';
import { MODULES, type Module } from '@clouderp/shared';

export class AdminService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  // ── Module Configuration ─────────────────────────────────────────────────

  async getModuleConfig(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { modulesEnabled: true },
    });

    const enabled = company.modulesEnabled as string[];

    return Object.values(MODULES)
      .filter((m) => m !== 'CORE') // CORE is always on
      .map((m) => ({
        module: m,
        label: m.charAt(0) + m.slice(1).toLowerCase(),
        enabled: enabled.includes(m),
      }));
  }

  async updateModuleConfig(
    companyId: string,
    updates: Array<{ module: Module; enabled: boolean }>
  ) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { modulesEnabled: true },
    });

    let enabled = company.modulesEnabled as string[];

    for (const { module, enabled: isEnabled } of updates) {
      if (module === 'CORE') continue; // Cannot disable CORE
      if (isEnabled) {
        if (!enabled.includes(module)) enabled.push(module);
      } else {
        enabled = enabled.filter((m) => m !== module);
      }
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { modulesEnabled: enabled },
    });

    return this.getModuleConfig(companyId);
  }

  // ── Document Sequences ───────────────────────────────────────────────────

  async getSequences(companyId: string) {
    return this.prisma.docSequence.findMany({
      where: { companyId },
      orderBy: [{ module: 'asc' }, { docType: 'asc' }],
    });
  }

  async updateSequence(id: string, companyId: string, data: { prefix?: string; nextNo?: number; padLength?: number }) {
    return this.prisma.docSequence.update({
      where: { id },
      data,
    });
  }

  // ── User Management ──────────────────────────────────────────────────────

  async getUsers(
    companyId: string,
    params: { search?: string; page?: number; limit?: number; isActive?: boolean }
  ) {
    const { search, page = 1, limit = 50, isActive } = params;

    const where: any = { companyId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createUser(
    companyId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      roleId: string;
      locationId?: string;
    }
  ) {
    const strength = validatePasswordStrength(data.password);
    if (!strength.valid) {
      throw Object.assign(new Error(strength.message), { statusCode: 400 });
    }

    // Check email uniqueness within company
    const existing = await this.prisma.user.findFirst({
      where: { companyId, email: data.email.toLowerCase().trim() },
    });
    if (existing) {
      throw Object.assign(new Error('A user with this email already exists'), { statusCode: 409 });
    }

    // Validate role belongs to this company
    await this.prisma.role.findFirstOrThrow({
      where: { id: data.roleId, companyId },
    });

    const passwordHash = await hashPassword(data.password);

    return this.prisma.user.create({
      data: {
        companyId,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        roleId: data.roleId,
        locationId: data.locationId ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async updateUser(
    id: string,
    companyId: string,
    data: { firstName?: string; lastName?: string; roleId?: string; locationId?: string; isActive?: boolean }
  ) {
    // Ensure user belongs to this company
    await this.prisma.user.findFirstOrThrow({ where: { id, companyId } });

    if (data.roleId) {
      await this.prisma.role.findFirstOrThrow({ where: { id: data.roleId, companyId } });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        role: { select: { id: true, name: true } },
      },
    });

    // Invalidate permission cache for this user
    await this.redis.del(`perms:${id}`);

    return updated;
  }

  // ── Role Management ──────────────────────────────────────────────────────

  async getRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      include: {
        permissions: true,
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async createRole(companyId: string, data: { name: string; description?: string }) {
    const existing = await this.prisma.role.findFirst({
      where: { companyId, name: data.name },
    });
    if (existing) {
      throw Object.assign(new Error('A role with this name already exists'), { statusCode: 409 });
    }

    return this.prisma.role.create({
      data: { companyId, name: data.name, description: data.description, isSystem: false },
    });
  }

  async updateRolePermissions(
    roleId: string,
    companyId: string,
    permissions: Array<{ module: string; resource: string; action: string }>
  ) {
    // Ensure role belongs to this company and is not a system role
    const role = await this.prisma.role.findFirstOrThrow({ where: { id: roleId, companyId } });
    if (role.isSystem) {
      throw Object.assign(new Error('System roles cannot be modified'), { statusCode: 403 });
    }

    // Replace all permissions for this role in a transaction
    await this.prisma.$transaction([
      this.prisma.permission.deleteMany({ where: { roleId } }),
      this.prisma.permission.createMany({
        data: permissions.map((p) => ({
          roleId,
          module: p.module as any,
          resource: p.resource,
          action: p.action as any,
        })),
        skipDuplicates: true,
      }),
    ]);

    // Invalidate all users' permission caches for this role
    const users = await this.prisma.user.findMany({
      where: { roleId, companyId },
      select: { id: true },
    });
    await Promise.all(users.map((u) => this.redis.del(`perms:${u.id}`)));

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
  }
}
