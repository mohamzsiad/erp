import { PrismaClient, Prisma } from '@prisma/client';

export interface UpsertCountryInput {
  code: string;
  name: string;
  vatPrefix?: string | null;
  vatLength?: number | null;
  vatFormatHint?: string | null;
  isActive?: boolean;
}

export interface UpsertCityInput {
  code: string;
  name: string;
  isActive?: boolean;
}

function notFound(msg = 'Country not found') {
  return Object.assign(new Error(msg), { statusCode: 404 });
}

/**
 * Country / city reference data. Shared across companies: it drives the city
 * dropdown on an address and the VAT-registration length rule for that country.
 */
export class CountryService {
  constructor(private prisma: PrismaClient) {}

  async list(opts: { search?: string; isActive?: boolean } = {}) {
    const where: Prisma.CountryWhereInput = {};
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    if (opts.search) {
      where.OR = [
        { code: { contains: opts.search, mode: 'insensitive' } },
        { name: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.country.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { cities: true } } },
    }).then((rows) => rows.map((r) => ({
      id: r.id, code: r.code, name: r.name,
      vatPrefix: r.vatPrefix, vatLength: r.vatLength, vatFormatHint: r.vatFormatHint,
      isActive: r.isActive, cityCount: r._count.cities,
    })));
  }

  async getById(id: string) {
    const row = await this.prisma.country.findUnique({
      where: { id },
      include: { cities: { orderBy: { name: 'asc' } } },
    });
    if (!row) throw notFound();
    return row;
  }

  /** Cities of one country — the address screen's city dropdown. */
  async cities(countryId: string, opts: { search?: string } = {}) {
    const where: Prisma.CityWhereInput = { countryId, isActive: true };
    if (opts.search) where.name = { contains: opts.search, mode: 'insensitive' };
    return this.prisma.city.findMany({
      where,
      select: { id: true, code: true, name: true, countryId: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(input: UpsertCountryInput) {
    const code = input.code.trim().toUpperCase();
    const clash = await this.prisma.country.findUnique({ where: { code }, select: { id: true } });
    if (clash) throw Object.assign(new Error(`Country code "${code}" already exists`), { statusCode: 409 });
    return this.prisma.country.create({
      data: {
        code,
        name: input.name.trim(),
        vatPrefix: input.vatPrefix ?? null,
        vatLength: input.vatLength ?? null,
        vatFormatHint: input.vatFormatHint ?? null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(id: string, input: Partial<UpsertCountryInput>) {
    const existing = await this.prisma.country.findUnique({ where: { id } });
    if (!existing) throw notFound();
    return this.prisma.country.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        vatPrefix: input.vatPrefix,
        vatLength: input.vatLength,
        vatFormatHint: input.vatFormatHint,
        isActive: input.isActive,
      },
    });
  }

  async addCity(countryId: string, input: UpsertCityInput) {
    const country = await this.prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
    if (!country) throw notFound();
    const code = input.code.trim().toUpperCase();
    const clash = await this.prisma.city.findFirst({ where: { countryId, code }, select: { id: true } });
    if (clash) throw Object.assign(new Error(`City code "${code}" already exists for this country`), { statusCode: 409 });
    return this.prisma.city.create({
      data: { countryId, code, name: input.name.trim(), isActive: input.isActive ?? true },
    });
  }

  async removeCity(countryId: string, cityId: string) {
    const used = await this.prisma.customerAddress.count({ where: { cityId } });
    if (used > 0) throw Object.assign(new Error('City is used by an address — deactivate it instead'), { statusCode: 409 });
    await this.prisma.city.deleteMany({ where: { id: cityId, countryId } });
    return { ok: true };
  }
}
