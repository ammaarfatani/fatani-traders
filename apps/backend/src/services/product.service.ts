import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { gramsToKg, roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class ProductService {
  static async getCategories() {
    return prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  static async createCategory(name: string, description?: string, userId?: string) {
    const existing = await prisma.productCategory.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      throw new AppError('Product category already exists', 400);
    }

    const category = await prisma.productCategory.create({
      data: {
        name: name.trim(),
        description,
      },
    });

    await logAudit(userId, 'CREATE_CATEGORY', 'ProductCategory', category.id, { name: category.name });
    return category;
  }

  static async getProducts(search?: string, categoryId?: string) {
    const where: any = { isActive: true };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: true,
        lots: {
          where: { status: 'ACTIVE', availableGrams: { gt: 0 } },
          select: { availableGrams: true, landedCostPerKg: true },
        },
      },
    });

    return products.map((p) => {
      const totalAvailableGrams = p.lots.reduce((sum, l) => sum + l.availableGrams, 0);
      const totalValuation = roundMoney(
        p.lots.reduce((sum, l) => sum + (l.availableGrams / 1000) * l.landedCostPerKg, 0)
      );

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        category: p.category,
        defaultUnit: p.defaultUnit,
        description: p.description,
        activeLotsCount: p.lots.length,
        totalAvailableKg: gramsToKg(totalAvailableGrams),
        totalValuation,
      };
    });
  }

  static async createProduct(data: {
    name: string;
    code?: string;
    categoryId: string;
    defaultUnit?: string;
    description?: string;
    userId?: string;
  }) {
    const category = await prisma.productCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const product = await prisma.product.create({
      data: {
        name: data.name.trim(),
        code: data.code?.trim(),
        categoryId: data.categoryId,
        defaultUnit: data.defaultUnit || 'KG',
        description: data.description,
      },
      include: { category: true },
    });

    await logAudit(data.userId, 'CREATE_PRODUCT', 'Product', product.id, { name: product.name });
    return product;
  }

  static async updateProduct(
    id: string,
    data: {
      name?: string;
      code?: string;
      categoryId?: string;
      defaultUnit?: string;
      description?: string;
      isActive?: boolean;
      userId?: string;
    }
  ) {
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        code: data.code?.trim(),
        categoryId: data.categoryId,
        defaultUnit: data.defaultUnit,
        description: data.description,
        isActive: data.isActive,
      },
      include: { category: true },
    });

    await logAudit(data.userId, 'UPDATE_PRODUCT', 'Product', product.id, data);
    return product;
  }
}
