import { Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service';
import { SaleCreateSchema, SaleUpdateSchema } from '@fatani/shared';

export class SaleController {
  static async getNextNumber(_req: Request, res: Response, next: NextFunction) {
    try {
      const nextNumber=await SaleService.generateInvoiceNumber();
      return res.status(200).json({success:true,data:{nextNumber}});
    } catch(err) { next(err); }
  }

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
        summary: result.summary,
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

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = SaleUpdateSchema.parse(req.body);
      const updated = await SaleService.updateSale(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Sale invoice updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await SaleService.deleteSale(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
