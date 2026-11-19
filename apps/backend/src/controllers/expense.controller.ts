import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service';
import { GeneralExpenseCreateSchema } from '@fatani/shared';

export class ExpenseController {
  static async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await ExpenseService.getCategories();
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, isCapitalizableDefault, description } = req.body;
      const category = await ExpenseService.createCategory(name, isCapitalizableDefault, description);
      return res.status(201).json({
        success: true,
        data: category,
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = GeneralExpenseCreateSchema.parse(req.body);
      const expense = await ExpenseService.createOperatingExpense({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(201).json({
        success: true,
        message: 'Operating expense recorded successfully',
        data: expense,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const { categoryId, startDate, endDate } = req.query;

      const result = await ExpenseService.getOperatingExpenses(
        page,
        limit,
        categoryId as string,
        startDate as string,
        endDate as string
      );

      return res.status(200).json({
        success: true,
        data: result.expenses,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }
}
