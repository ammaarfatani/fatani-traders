import { Request, Response, NextFunction } from 'express';
import { PurchaseService } from '../services/purchase.service';
import { PurchaseCreateSchema, PostPurchaseExpenseSchema } from '@fatani/shared';

export class PurchaseController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = PurchaseCreateSchema.parse(req.body);
      const result = await PurchaseService.createPurchase({
        ...validated,
        userId: req.user?.id,
      });

      return res.status(201).json({
        success: true,
        message: 'Purchase recorded and lot created successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async addExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const lotId = Array.isArray(req.params.lotId) ? req.params.lotId[0] : req.params.lotId;
      const validated = PostPurchaseExpenseSchema.parse(req.body);
      const result = await PurchaseService.addPostPurchaseExpense({
        ...validated,
        lotId,
        userId: req.user?.id,
      });

      return res.status(200).json({
        success: true,
        message: 'Expense added to lot and landed cost updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const result = await PurchaseService.getPurchases(page, limit, search);
      return res.status(200).json({
        success: true,
        data: result.purchases,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const purchase = await PurchaseService.getPurchaseById(id);
      return res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (err) {
      next(err);
    }
  }
}
