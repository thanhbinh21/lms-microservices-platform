import { Router, type Router as ExpressRouter } from 'express';
import {
  listUsers,
  getUser,
  updateUserRole,
  updateUserStatus,
  updateUserPassword,
  getStats,
} from '../controllers/admin.controller.js';
import { listAuditLogs } from '../controllers/audit.controller.js';
import { listSystemConfigs, upsertSystemConfig } from '../controllers/system-config.controller.js';

const router: ExpressRouter = Router();

router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/password', updateUserPassword);
router.get('/stats', getStats);
router.get('/audit-logs', listAuditLogs);
router.get('/system-configs', listSystemConfigs);
router.put('/system-configs', upsertSystemConfig);

export default router;
