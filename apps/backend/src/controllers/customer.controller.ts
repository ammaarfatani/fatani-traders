import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service';
import { CustomerSchema } from '@fatani/shared';

export class CustomerController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const customers = await CustomerService.getCustomers(search);
      return res.status(200).json({
        success: true,
        data: customers,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const customer = await CustomerService.getCustomerById(id);
      return res.status(200).json({
        success: true,
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = CustomerSchema.parse(req.body);
      const customer = await CustomerService.createCustomer({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(201).json({
        success: true,
        message: 'Customer added successfully',
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = CustomerSchema.partial().parse(req.body);
      const customer = await CustomerService.updateCustomer(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: customer,
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

      const statement = await CustomerService.getCustomerStatement(
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
}
