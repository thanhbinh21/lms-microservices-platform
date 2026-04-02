const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/apiResponse');

function verifyToken(req, res, next) {
  const traceId = req.headers['x-trace-id'] || null;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Missing or invalid authorization token', 401, traceId);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };
    return next();
  } catch (error) {
    return errorResponse(res, 'Invalid or expired token', 401, traceId);
  }
}

module.exports = verifyToken;
