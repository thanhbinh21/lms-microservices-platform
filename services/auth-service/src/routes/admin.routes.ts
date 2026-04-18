import { Router, type Router as ExpressRouter } from 'express';
import {
  listUsers,
  getUser,
  updateUserRole,
  updateUserStatus,
  updateUserPassword,
  getStats,
} from '../controllers/admin.controller.js';

const router: ExpressRouter = Router();

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/password', updateUserPassword);
router.get('/stats', getStats);

export default router;
