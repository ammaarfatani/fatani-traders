import { Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service';
import { SaleCreateSchema } from '@fatani/shared';

export class SaleController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = SaleCreateSchema.parse(req.body);
      const result = await SaleService.createSale({
        ...validated,
        userId: req.user?.id,
      });

      return res.status(201).json({
        success: true,
        message: 'Sale invoice generated and stock updated atomically',
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

      const result = await SaleService.getSales(page, limit, search);
      return res.status(200).json({
        success: true,
        data: result.sales,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sale = await SaleService.getSaleById(id);
      return res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (err) {
      next(err);
    }
  }
}
