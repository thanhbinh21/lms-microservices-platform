const express = require('express');
const verifyToken = require('../middlewares/verifyToken');
const roleGuard = require('../middlewares/roleGuard');
const {
  createRequest,
  getMyRequest,
  getStats,
  getRequests,
  getRequest,
  approve,
  reject,
} = require('../controllers/instructor.controller');

const router = express.Router();

router.post('/request', verifyToken, roleGuard(['STUDENT']), createRequest);
router.get('/my-request', verifyToken, roleGuard(['STUDENT']), getMyRequest);
router.get('/requests/stats', verifyToken, roleGuard(['ADMIN']), getStats);
router.get('/requests', verifyToken, roleGuard(['ADMIN']), getRequests);
router.get('/requests/:id', verifyToken, roleGuard(['ADMIN']), getRequest);
router.put('/approve/:id', verifyToken, roleGuard(['ADMIN']), approve);
router.put('/reject/:id', verifyToken, roleGuard(['ADMIN']), reject);

module.exports = router;
