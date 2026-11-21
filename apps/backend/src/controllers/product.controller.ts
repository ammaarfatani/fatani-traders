import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';
import { ProductSchema, ProductCategorySchema } from '@fatani/shared';

export class ProductController {
  static async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await ProductService.getCategories();
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
      const validated = ProductCategorySchema.parse(req.body);
      const category = await ProductService.createCategory(
        validated.name,
        validated.description,
        req.user?.id
      );
      return res.status(201).json({
        success: true,
        message: 'Product category created successfully',
        data: category,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;

      const products = await ProductService.getProducts(search, categoryId);
      return res.status(200).json({
        success: true,
        data: products,
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = ProductSchema.parse(req.body);
      const product = await ProductService.createProduct({
        ...validated,
        userId: req.user?.id,
      });
      return res.status(201).json({
        success: true,
        message: 'Product added successfully',
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, description } = ProductCategorySchema.parse(req.body);
      const category = await ProductService.updateCategory(id, name, description);
      return res.status(200).json({
        success: true,
        message: 'Product category updated successfully',
        data: category,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ProductService.deleteCategory(id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = ProductSchema.partial().parse(req.body);
      const product = await ProductService.updateProduct(id, {
        ...validated,
        userId: req.user?.id,
      });
      return res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await ProductService.deleteProduct(id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}
