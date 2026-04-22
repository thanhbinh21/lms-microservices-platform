import { Request, Response, NextFunction } from 'express';
import { createRequireAuth } from '@lms/types';

export const requireAuth = createRequireAuth() as (req: Request, res: Response, next: NextFunction) => void;
