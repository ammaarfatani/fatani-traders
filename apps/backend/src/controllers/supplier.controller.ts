import { Request, Response, NextFunction } from 'express';
import { SupplierService } from '../services/supplier.service';
import { SupplierSchema } from '@fatani/shared';

export class SupplierController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const suppliers = await SupplierService.getSuppliers(search);
      return res.status(200).json({
        success: true,
        data: suppliers,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const supplier = await SupplierService.getSupplierById(id);
      return res.status(200).json({
        success: true,
        data: supplier,
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = SupplierSchema.parse(req.body);
      const supplier = await SupplierService.createSupplier({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(201).json({
        success: true,
        message: 'Supplier added successfully',
        data: supplier,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = SupplierSchema.partial().parse(req.body);
      const supplier = await SupplierService.updateSupplier(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Supplier updated successfully',
        data: supplier,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

      const statement = await SupplierService.getSupplierStatement(
        id,
        startDate,
        endDate
      );
      return res.status(200).json({
        success: true,
        data: statement,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await SupplierService.deleteSupplier(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
