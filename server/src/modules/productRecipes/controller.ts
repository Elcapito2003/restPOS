import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(_req: Request, res: Response) {
  res.json(await service.getProductsWithRecipes());
}

export async function getRecipe(req: Request, res: Response) {
  res.json(await service.getRecipe(Number(req.params.productId)));
}

export async function setRecipe(req: Request, res: Response) {
  try {
    const recipe = await service.setRecipe(Number(req.params.productId), req.body.ingredients);
    res.json(recipe);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
