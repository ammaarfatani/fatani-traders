import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { gramsToKg, roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class InventoryService {
  static async getAvailableLots(productId?: string, search?: string) {
    const where: any = {
      status: 'ACTIVE',
      availableGrams: { gt: 0 },
    };

    if (productId) {
      where.productId = productId;
    }

    if (search) {
      where.OR = [
        { lotNumber: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const lots = await prisma.purchaseLot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { include: { category: true } },
        purchase: {
          select: {
            purchaseNumber: true,
            purchaseDate: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });

    return lots.map((lot) => ({
      ...lot,
      availableKg: gramsToKg(lot.availableGrams),
      purchasedKg: gramsToKg(lot.purchasedGrams),
      soldKg: gramsToKg(lot.soldGrams),
      inventoryValue: roundMoney((lot.availableGrams / 1000) * lot.landedCostPerKg),
    }));
  }

  static async getAllLots(page: number = 1, limit: number = 20, status?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { lotNumber: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, lots] = await Promise.all([
      prisma.purchaseLot.count({ where }),
      prisma.purchaseLot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { include: { category: true } },
          purchase: {
            select: {
              purchaseNumber: true,
              purchaseDate: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const formattedLots = lots.map((lot) => ({
      ...lot,
      availableKg: gramsToKg(lot.availableGrams),
      purchasedKg: gramsToKg(lot.purchasedGrams),
      soldKg: gramsToKg(lot.soldGrams),
      inventoryValue: roundMoney((lot.availableGrams / 1000) * lot.landedCostPerKg),
    }));

    return {
      lots: formattedLots,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getLotById(id: string) {
    const lot = await prisma.purchaseLot.findUnique({
      where: { id },
      include: {
        product: { include: { category: true } },
        purchase: {
          include: {
            supplier: true,
          },
        },
        expenses: {
          include: { paymentAccount: true },
        },
        costAdjustments: {
          orderBy: { createdAt: 'desc' },
        },
        movements: {
          orderBy: { date: 'desc' },
        },
        adjustments: {
          orderBy: { date: 'desc' },
        },
        saleItems: {
          include: {
            sale: {
              select: {
                invoiceNumber: true,
                invoiceDate: true,
                customer: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!lot) {
      throw new AppError('Purchase lot not found', 404);
    }

    return {
      ...lot,
      availableKg: gramsToKg(lot.availableGrams),
      purchasedKg: gramsToKg(lot.purchasedGrams),
      soldKg: gramsToKg(lot.soldGrams),
      inventoryValue: roundMoney((lot.availableGrams / 1000) * lot.landedCostPerKg),
    };
  }

  static async adjustStock(data: {
    lotId: string;
    gramsChange: number; // positive = found/added, negative = damaged/lost
    reason: string;
    date: string | Date;
    notes?: string;
    userId?: string;
  }) {
    if (!Number.isInteger(data.gramsChange) || data.gramsChange === 0) {
      throw new AppError('Adjustment grams cannot be zero', 400);
    }

    if (!data.reason || data.reason.trim().length < 3) {
      throw new AppError('Detailed reason for adjustment is required', 400);
    }

    const lot = await prisma.purchaseLot.findUnique({
      where: { id: data.lotId },
    });

    if (!lot) {
      throw new AppError('Purchase lot not found', 404);
    }

    const newAvailable = lot.availableGrams + data.gramsChange;
    if (newAvailable < 0) {
      throw new AppError(
        `Adjustment would result in negative stock. Current available: ${gramsToKg(lot.availableGrams)} KG`,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const newStatus = newAvailable === 0 ? 'DEPLETED' : 'ACTIVE';
      const updatedLot = await tx.purchaseLot.update({
        where: { id: lot.id },
        data: {
          availableGrams: newAvailable,
          adjustedGrams: lot.adjustedGrams + data.gramsChange,
          status: newStatus,
        },
      });

      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          lotId: lot.id,
          gramsChange: data.gramsChange,
          reason: data.reason.trim(),
          date: new Date(data.date),
          adjustedByUserId: data.userId,
          notes: data.notes,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          lotId: lot.id,
          type: 'ADJUSTMENT',
          gramsChange: data.gramsChange,
          resultingAvailableGrams: newAvailable,
          referenceType: 'ADJUSTMENT',
          referenceId: adjustment.id,
          date: new Date(data.date),
          notes: `Stock adjustment: ${data.gramsChange > 0 ? '+' : ''}${gramsToKg(data.gramsChange)} KG. Reason: ${data.reason}`,
        },
      });

      return {
        updatedLot,
        adjustment,
        newAvailableKg: gramsToKg(newAvailable),
      };
    });

    await logAudit(
      data.userId,
      'ADJUST_STOCK',
      'PurchaseLot',
      lot.id,
      {
        lotNumber: lot.lotNumber,
        gramsChange: data.gramsChange,
        reason: data.reason,
      }
    );

    return result;
  }
  static async changeAdjustment(id: string, data: {gramsChange?: number; reason?: string; date?: string; notes?: string} | null, userId?: string) {
    const result = await prisma.$transaction(async tx => {
      const old = await tx.inventoryAdjustment.findUnique({where:{id}});
      if (!old) throw new AppError('Adjustment not found',404);
      const source = await tx.inventoryMovement.findFirst({where:{referenceType:'ADJUSTMENT',referenceId:id}});
      if (!source) throw new AppError('This adjustment belongs to a return and must be corrected through that return',400);
      const lot = await tx.purchaseLot.findUniqueOrThrow({where:{id:old.lotId}});
      const next = data ? data.gramsChange ?? old.gramsChange : 0;
      if (!Number.isInteger(next) || (data && next === 0)) throw new AppError('Enter a nonzero integer number of grams',400);
      const delta = next - old.gramsChange;
      const availableGrams = lot.availableGrams + delta;
      if (availableGrams < 0) throw new AppError('Cannot reverse adjustment: stock has already been used',400);
      await tx.purchaseLot.update({where:{id:lot.id},data:{availableGrams,adjustedGrams:{increment:delta},status:availableGrams?'ACTIVE':'DEPLETED'}});
      await tx.inventoryMovement.create({data:{lotId:lot.id,type:'ADJUSTMENT',gramsChange:delta,resultingAvailableGrams:availableGrams,referenceType:'ADJUSTMENT_CORRECTION',referenceId:id,notes:data?'Adjustment edited':'Adjustment reversed'}});
      if (!data) return tx.inventoryAdjustment.delete({where:{id}});
      return tx.inventoryAdjustment.update({where:{id},data:{...data, date:data.date?new Date(data.date):old.date}});
    });
    await logAudit(userId,data?'UPDATE_ADJUSTMENT':'DELETE_ADJUSTMENT','InventoryAdjustment',id,{beforeOrAfter:result});
    return result;
  }

}
