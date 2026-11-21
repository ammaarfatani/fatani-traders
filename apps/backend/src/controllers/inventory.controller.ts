import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service';
import { StockAdjustmentSchema } from '@fatani/shared';

export class InventoryController {
  static async changeAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.method === 'DELETE' ? null : StockAdjustmentSchema.omit({lotId:true}).partial().parse(req.body);
      const result = await InventoryService.changeAdjustment(String(req.params.id), data as any, req.user?.id);
      res.json({success:true,data:result});
    } catch(e) { next(e); }
  }

  static async getAvailableLots(req: Request, res: Response, next: NextFunction) {
    try {
      const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const lots = await InventoryService.getAvailableLots(productId, search);
      return res.status(200).json({
        success: true,
        data: lots,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAllLots(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const result = await InventoryService.getAllLots(page, limit, status, search);
      return res.status(200).json({
        success: true,
        data: result.lots,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLotById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const lot = await InventoryService.getLotById(id);
      return res.status(200).json({
        success: true,
        data: lot,
      });
    } catch (err) {
      next(err);
    }
  }

  static async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = StockAdjustmentSchema.parse(req.body);
      const result = await InventoryService.adjustStock({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Stock adjusted successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
