import { prisma } from '../lib/prisma';
import { logAudit } from '../middleware/audit';

export class SettingsService {
  static async getSettings() {
    let settings = await prisma.businessSettings.findFirst();
    if (!settings) {
      settings = await prisma.businessSettings.create({
        data: {
          businessName: 'Fatani Traders',
          tagline: 'Wholesale Fabric & Textile Trading ERP',
          phone: '+92 300 1234567',
          address: 'Karachi, Pakistan',
          currencySymbol: 'PKR',
          weightUnit: 'KG',
        },
      });
    }
    return settings;
  }

  static async updateSettings(data: any, userId?: string) {
    const existing = await this.getSettings();
    const updated = await prisma.businessSettings.update({
      where: { id: existing.id },
      data,
    });
    await logAudit(userId, 'UPDATE_SETTINGS', 'BusinessSettings', updated.id, data);
    return updated;
  }

  static async getInvoiceTemplate() {
    let template = await prisma.invoiceTemplate.findFirst({
      where: { isDefault: true },
    });
    if (!template) {
      template = await prisma.invoiceTemplate.create({
        data: {
          name: 'Default Template',
          businessName: 'Fatani Traders',
          businessAddress: 'Karachi, Pakistan',
          primaryColor: '#0f172a',
          isDefault: true,
        },
      });
    }
    return template;
  }

  static async updateInvoiceTemplate(data: any, userId?: string) {
    const existing = await this.getInvoiceTemplate();
    const updated = await prisma.invoiceTemplate.update({
      where: { id: existing.id },
      data,
    });
    await logAudit(userId, 'UPDATE_INVOICE_TEMPLATE', 'InvoiceTemplate', updated.id, data);
    return updated;
  }

  static async getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { email: true, fullName: true } },
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
