import { Request, Response, NextFunction } from 'express';
import { AccountService } from '../services/account.service';
import { FinancialAccountSchema, AccountTransferSchema } from '@fatani/shared';

export class AccountController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await AccountService.getAccounts();
      return res.status(200).json({
        success: true,
        data: accounts,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const account = await AccountService.getAccountById(id);
      return res.status(200).json({
        success: true,
        data: account,
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = FinancialAccountSchema.parse(req.body);
      const account = await AccountService.createAccount({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(201).json({
        success: true,
        message: 'Financial account created successfully',
        data: account,
      });
    } catch (err) {
      next(err);
    }
  }

  static async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = AccountTransferSchema.parse(req.body);
      const result = await AccountService.transferFunds({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Funds transferred successfully between accounts',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = FinancialAccountSchema.partial().parse(req.body);
      const account = await AccountService.updateAccount(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: account,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AccountService.deleteAccount(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
