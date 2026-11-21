import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from '../services/expense.service';
import { ProductCategorySchema, GeneralExpenseCreateSchema, GeneralExpenseUpdateSchema } from '@fatani/shared';

export class ExpenseController {
  static async analytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, categoryId } = req.query;
      const result = await ExpenseService.getOperatingExpenseAnalytics(
        typeof startDate === 'string' ? startDate : undefined,
        typeof endDate === 'string' ? endDate : undefined,
        typeof categoryId === 'string' ? categoryId : undefined,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (err) { next(err); }
  }

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
      const { name, description } = ProductCategorySchema.parse(req.body);
      const isCapitalizableDefault = req.body.isCapitalizableDefault === true;
      const category = await ExpenseService.createCategory(name, isCapitalizableDefault, description);
      return res.status(201).json({
        success: true,
        data: category,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, description } = ProductCategorySchema.parse(req.body);
      const category = await ExpenseService.updateCategory(id, name, description);
      return res.status(200).json({
        success: true,
        message: 'Expense category updated successfully',
        data: category,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ExpenseService.deleteCategory(id);
      return res.status(200).json({
        success: true,
        message: result.message,
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

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const expense = await ExpenseService.getExpenseById(id);
      return res.status(200).json({
        success: true,
        data: expense,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = GeneralExpenseUpdateSchema.parse(req.body);
      const updated = await ExpenseService.updateOperatingExpense(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Expense updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ExpenseService.deleteOperatingExpense(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
