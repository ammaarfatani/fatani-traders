import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { PaymentCreateSchema } from '@fatani/shared';
import { AppError } from '../middleware/errorHandler';

export class PaymentController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = PaymentCreateSchema.parse(req.body);

      if (validated.type === 'CUSTOMER_PAYMENT') {
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
      } else {
        if (!validated.supplierId) {
          throw new AppError('Supplier is required for supplier payment', 400);
        }
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

      const result = await PaymentService.getPayments(page, limit, type);
      return res.status(200).json({
        success: true,
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }
}
