import { Router, type IRouter } from 'express';
import {
  approve,
  createRequest,
  getMyRequest,
  getRequest,
  getRequests,
  getStats,
  reject,
} from '../controllers/instructor.controller';
import { roleGuard } from '../middlewares/roleGuard';
import { verifyToken } from '../middlewares/verifyToken';

const router: IRouter = Router();

router.post('/request', verifyToken, roleGuard(['STUDENT']), createRequest);
router.get('/my-request', verifyToken, roleGuard(['STUDENT']), getMyRequest);
router.get('/requests/stats', verifyToken, roleGuard(['ADMIN']), getStats);
router.get('/requests', verifyToken, roleGuard(['ADMIN']), getRequests);
router.get('/requests/:id', verifyToken, roleGuard(['ADMIN']), getRequest);
router.put('/approve/:id', verifyToken, roleGuard(['ADMIN']), approve);
router.put('/reject/:id', verifyToken, roleGuard(['ADMIN']), reject);

export default router;
