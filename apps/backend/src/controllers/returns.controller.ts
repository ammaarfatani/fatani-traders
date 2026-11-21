import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { ReturnsService } from '../services/returns.service';
import { SalesReturnCreateSchema, PurchaseReturnCreateSchema } from '@fatani/shared';

export class ReturnsController {
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = z.object({returnDate:z.string().date().optional(),notes:z.string().optional()}).strict().parse(req.body);
      const kind = req.path.includes('/sales/') ? 'sales' : 'purchases';
      const result = await ReturnsService.updateReturn(kind, String(req.params.id), data, req.user?.id);
      res.json({success:true,data:result});
    } catch (e) { next(e); }
  }

  static async createSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = SalesReturnCreateSchema.parse(req.body);
      const result = await ReturnsService.createSalesReturn({
        ...validated,
        userId: req.user?.id,
      });

      return res.status(201).json({
        success: true,
        message: 'Sales return processed and customer khata adjusted',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createPurchaseReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = PurchaseReturnCreateSchema.parse(req.body);
      const result = await ReturnsService.createPurchaseReturn({
        ...validated,
        userId: req.user?.id,
      });

      return res.status(201).json({
        success: true,
        message: 'Purchase return processed and supplier ledger adjusted',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listSalesReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await ReturnsService.getSalesReturns(page, limit);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listPurchaseReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await ReturnsService.getPurchaseReturns(page, limit);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSalesReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ReturnsService.deleteSalesReturn(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deletePurchaseReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ReturnsService.deletePurchaseReturn(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
