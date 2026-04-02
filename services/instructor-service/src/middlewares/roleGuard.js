const { errorResponse } = require('../utils/apiResponse');

function roleGuard(allowedRoles) {
  return (req, res, next) => {
    const traceId = req.headers['x-trace-id'] || null;
    const role = (req.user?.role || '').toUpperCase();
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, 'Forbidden: insufficient permissions', 403, traceId);
    }
    return next();
  };
}

module.exports = roleGuard;
