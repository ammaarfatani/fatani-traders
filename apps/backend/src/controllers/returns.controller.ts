import { Request, Response, NextFunction } from 'express';
import { ReturnsService } from '../services/returns.service';
import { SalesReturnCreateSchema, PurchaseReturnCreateSchema } from '@fatani/shared';

export class ReturnsController {
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
}
