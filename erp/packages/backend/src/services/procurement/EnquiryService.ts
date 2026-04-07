import { PrismaClient } from '@prisma/client';
import { getNextDocNo } from '../../utils/DocNumberService.js';
import { NotificationService } from '../NotificationService.js';

interface CreateEnquiryInput {
  companyId: string;
  prlId?: string;
  supplierIds: string[];
  remarks?: string;
}

export class EnquiryService {
  private notif: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notif = new NotificationService(prisma);
  }

  // ── List ───────────────────────────────────────────────────────────────────
  async list(companyId: string, filters: { status?: string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { companyId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.purchaseEnquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          prl: { select: { docNo: true } },
          quotations: { select: { id: true, supplierId: true, status: true } },
        },
      }),
      this.prisma.purchaseEnquiry.count({ where }),
    ]);

    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Get by ID ──────────────────────────────────────────────────────────────
  async getById(id: string, companyId: string) {
    const enquiry = await this.prisma.purchaseEnquiry.findFirst({
      where: { id, companyId },
      include: {
        prl: {
          include: {
            lines: {
              include: {
                item: { select: { code: true, name: true } },
                uom: { select: { code: true, name: true } },
              },
            },
          },
        },
        quotations: {
          include: {
            supplier: { select: { code: true, name: true } },
            currency: { select: { code: true } },
          },
        },
      },
    });

    if (!enquiry) throw Object.assign(new Error('Purchase Enquiry not found'), { statusCode: 404 });
    return enquiry;
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async create(input: CreateEnquiryInput, createdById: string) {
    const docNo = await getNextDocNo(this.prisma, input.companyId, 'PROCUREMENT', 'PE');

    const enquiry = await this.prisma.purchaseEnquiry.create({
      data: {
        companyId: input.companyId,
        docNo,
        docDate: new Date(),
        prlId: input.prlId ?? null,
        status: 'DRAFT',
        createdById,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tableName: 'PE',
        recordId: enquiry.id,
        userId: createdById,
        action: 'CREATE',
        newValues: { docNo, supplierIds: input.supplierIds },
      },
    });

    return enquiry;
  }

  // ── Send (mark as sent, notify suppliers) ─────────────────────────────────
  async send(id: string, companyId: string, userId: string) {
    const enquiry = await this.prisma.purchaseEnquiry.findFirst({
      where: { id, companyId },
      include: { quotations: { include: { supplier: { select: { contacts: true } } } } },
    });

    if (!enquiry) throw Object.assign(new Error('Purchase Enquiry not found'), { statusCode: 404 });
    if (enquiry.status !== 'DRAFT') {
      throw Object.assign(new Error('Enquiry is already sent'), { statusCode: 422 });
    }

    await this.prisma.purchaseEnquiry.update({
      where: { id },
      data: { status: 'SENT' },
    });

    // Send email notification to supplier contacts (non-blocking)
    for (const pq of enquiry.quotations) {
      const contacts = (pq.supplier as any).contacts ?? [];
      for (const contact of contacts) {
        if (contact.email) {
          await this.notif.sendEmail({
            to: contact.email,
            subject: `Request for Quotation - ${enquiry.docNo}`,
            html: `<p>Dear ${contact.name},</p><p>Please provide your quotation for RFQ <strong>${enquiry.docNo}</strong>.</p>`,
          });
        }
      }
    }

    return { message: 'Enquiry sent to suppliers', docNo: enquiry.docNo };
  }

  // ── Close ──────────────────────────────────────────────────────────────────
  async close(id: string, companyId: string, userId: string) {
    const enquiry = await this.prisma.purchaseEnquiry.findFirst({ where: { id, companyId } });
    if (!enquiry) throw Object.assign(new Error('Purchase Enquiry not found'), { statusCode: 404 });

    await this.prisma.purchaseEnquiry.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    return { message: 'Enquiry closed' };
  }
}
