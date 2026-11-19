import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';

export class ReportController {
  static async getDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const dashboard = await ReportService.getDashboard();
      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProfitLoss(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const pl = await ReportService.getProfitLoss(
        startDate as string,
        endDate as string
      );
      return res.status(200).json({
        success: true,
        data: pl,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCashFlow(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const cf = await ReportService.getCashFlow(
        startDate as string,
        endDate as string
      );
      return res.status(200).json({
        success: true,
        data: cf,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInventoryReport(_req: Request, res: Response, next: NextFunction) {
    try {
      const inv = await ReportService.getInventoryReport();
      return res.status(200).json({
        success: true,
        data: inv,
      });
    } catch (err) {
      next(err);
    }
  }
}
