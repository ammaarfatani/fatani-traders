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
      const status = req.query.status as 'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID' | undefined;
      const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
      const unknownSupplier = req.query.unknownSupplier === 'true';

      const result = await PurchaseService.getPurchases(page, limit, search, status, supplierId, unknownSupplier);
      return res.status(200).json({
        success: true,
        data: result.purchases,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getNextNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const nextNumber = await PurchaseService.generatePurchaseNumber();
      return res.status(200).json({
        success: true,
        data: { nextNumber },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPayable(req: Request, res: Response, next: NextFunction) {
    try {
      const payablePurchases = await PurchaseService.getPayablePurchases();
      return res.status(200).json({
        success: true,
        data: payablePurchases,
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
