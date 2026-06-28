import { Request, Response, NextFunction } from 'express';
import { listCountries, createCountry, updateCountry, deleteCountry } from '../services/country.service';
import { logAction } from '../services/audit.service';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const activeOnly = req.query.active === 'true';
    res.json({ success: true, data: await listCountries(activeOnly) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const c = await createCountry(req.body);
    await logAction('admin.country.created', { actorId: req.user!.userId, details: { code: c.code } });
    res.status(201).json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const c = await updateCountry(req.params.id, req.body);
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteCountry(req.params.id);
    await logAction('admin.country.deleted', { actorId: req.user!.userId, details: { id: req.params.id } });
    res.json({ success: true, message: 'Country deleted' });
  } catch (err) { next(err); }
}
