import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { PaymentCreateSchema, PaymentUpdateSchema } from '@fatani/shared';
import { AppError } from '../middleware/errorHandler';

export class PaymentController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = PaymentCreateSchema.parse(req.body);

      if (validated.purchaseId) {
        // Direct Purchase / Lot payment (works with or without registered supplier)
        const result = await PaymentService.recordPurchasePayment({
          purchaseId: validated.purchaseId,
          accountId: validated.accountId,
          amount: validated.amount,
          paymentDate: validated.paymentDate,
          referenceNumber: validated.referenceNumber,
          notes: validated.notes,
          userId: req.user?.id,
        });

        return res.status(201).json({
          success: true,
          message: 'Purchase payment recorded successfully',
          data: result,
        });
      } else if (validated.type === 'CUSTOMER_PAYMENT') {
        if (!validated.customerId) {
          throw new AppError('Customer is required for customer payment', 400);
        }
        const result = await PaymentService.recordCustomerPayment({
          customerId: validated.customerId,
          accountId: validated.accountId,
          amount: validated.amount,
          paymentDate: validated.paymentDate,
          referenceNumber: validated.referenceNumber,
          notes: validated.notes,
          saleId: validated.saleId,
          userId: req.user?.id,
        });

        return res.status(201).json({
          success: true,
          message: 'Customer payment recorded and allocated successfully',
          data: result,
        });
      } else if (validated.supplierId) {
        const result = await PaymentService.recordSupplierPayment({
          supplierId: validated.supplierId,
          accountId: validated.accountId,
          amount: validated.amount,
          paymentDate: validated.paymentDate,
          referenceNumber: validated.referenceNumber,
          notes: validated.notes,
          purchaseId: validated.purchaseId,
          userId: req.user?.id,
        });

        return res.status(201).json({
          success: true,
          message: 'Supplier payment recorded and allocated successfully',
          data: result,
        });
      } else {
        throw new AppError('Either purchaseId, supplierId, or customerId is required for payment', 400);
      }
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const type = req.query.type as string;
      const search = req.query.search as string;

      const result = await PaymentService.getPayments(page, limit, type, search);
      return res.status(200).json({
        success: true,
        data: result.payments,
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
      const payment = await PaymentService.getPaymentById(id);
      return res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = PaymentUpdateSchema.parse(req.body);
      const updated = await PaymentService.updatePayment(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Payment updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await PaymentService.deletePayment(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
