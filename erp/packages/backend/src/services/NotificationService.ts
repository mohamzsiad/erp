import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { config } from '../config.js';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  docType?: string;
  docId?: string;
}

export class NotificationService {
  private mailer: nodemailer.Transporter | null = null;

  constructor(private prisma: PrismaClient) {
    if (config.SMTP_HOST) {
      this.mailer = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT ?? 587,
        auth: config.SMTP_USER
          ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
          : undefined,
      });
    }
  }

  // ── Create in-app notification ─────────────────────────────────────────────
  async createNotification(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        docType: input.docType ?? null,
        docId: input.docId ?? null,
        isRead: false,
      },
    });
  }

  // ── Create multiple notifications (e.g. for all approvers) ──────────────
  async createNotifications(inputs: CreateNotificationInput[]) {
    return this.prisma.notification.createMany({
      data: inputs.map((i) => ({
        userId: i.userId,
        type: i.type,
        title: i.title,
        message: i.message,
        docType: i.docType ?? null,
        docId: i.docId ?? null,
        isRead: false,
      })),
    });
  }

  // ── Get unread notifications for a user ────────────────────────────────────
  async getUnread(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Mark as read ───────────────────────────────────────────────────────────
  async markRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notif) {
      throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // ── Mark all as read ───────────────────────────────────────────────────────
  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // ── Send email (non-blocking, logs errors) ─────────────────────────────────
  async sendEmail(opts: { to: string; subject: string; html: string }) {
    if (!this.mailer || !config.SMTP_FROM) return;
    try {
      await this.mailer.sendMail({
        from: config.SMTP_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
    } catch (err) {
      // Email failures should not crash the main flow
      console.error('[NotificationService] Email send failed:', err);
    }
  }

  // ── Notify approver that document needs review ─────────────────────────────
  async notifyApprover(approverUserId: string, docType: string, docNo: string, docId: string) {
    await this.createNotification({
      userId: approverUserId,
      type: 'APPROVAL_REQUIRED',
      title: `${docType} Awaiting Your Approval`,
      message: `Document ${docNo} requires your approval.`,
      docType,
      docId,
    });
  }

  // ── Notify requestor of approval decision ────────────────────────────────
  async notifyRequestor(
    requestorUserId: string,
    docType: string,
    docNo: string,
    docId: string,
    action: 'approved' | 'rejected',
    comment?: string
  ) {
    const approved = action === 'approved';
    await this.createNotification({
      userId: requestorUserId,
      type: approved ? 'DOC_APPROVED' : 'DOC_REJECTED',
      title: `${docType} ${approved ? 'Approved' : 'Rejected'}`,
      message: comment
        ? `${docNo} was ${action}: "${comment}"`
        : `${docNo} has been ${action}.`,
      docType,
      docId,
    });
  }
}
