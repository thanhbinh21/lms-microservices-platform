import { Router, type Router as ExpressRouter } from 'express';
import {
  listAdminCourses,
  updateCourseStatus,
  listAdminReviews,
  flagReview,
  deleteReview,
  getAdminStats,
} from '../controllers/admin.controller';
import {
  listFailedEvents,
  getFailedEventStats,
  getFailedEvent,
  retryFailedEvent,
  resolveFailedEvent,
} from '../controllers/dlq.controller';

const router: ExpressRouter = Router();

// Course moderation
router.get('/courses', listAdminCourses);
router.patch('/courses/:id/status', updateCourseStatus);

// Review moderation
router.get('/reviews', listAdminReviews);
router.patch('/reviews/:id/flag', flagReview);
router.delete('/reviews/:id', deleteReview);

// DLQ / Failed events — /stats must come before /:id
router.get('/failed-events/stats', getFailedEventStats);
router.get('/failed-events', listFailedEvents);
router.get('/failed-events/:id', getFailedEvent);
router.post('/failed-events/:id/retry', retryFailedEvent);
router.patch('/failed-events/:id/resolve', resolveFailedEvent);

// Stats
router.get('/stats', getAdminStats);

export default router;
