import { Request, Response, NextFunction } from 'express';
import { SettingsService } from '../services/settings.service';
import { BusinessSettingsSchema, InvoiceTemplateSchema } from '@fatani/shared';

export class SettingsController {
  static async getSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await SettingsService.getSettings();
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = BusinessSettingsSchema.partial().parse(req.body);
      const settings = await SettingsService.updateSettings(validated, req.user?.id);
      return res.status(200).json({
        success: true,
        message: 'Business settings updated successfully',
        data: settings,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInvoiceTemplate(_req: Request, res: Response, next: NextFunction) {
    try {
      const template = await SettingsService.getInvoiceTemplate();
      return res.status(200).json({
        success: true,
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateInvoiceTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = InvoiceTemplateSchema.partial().parse(req.body);
      const template = await SettingsService.updateInvoiceTemplate(validated, req.user?.id);
      return res.status(200).json({
        success: true,
        message: 'Invoice template updated successfully',
        data: template,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await SettingsService.getAuditLogs(page, limit);
      return res.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }
}
