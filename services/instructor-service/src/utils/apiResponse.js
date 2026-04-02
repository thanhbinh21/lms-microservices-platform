function successResponse(res, message, data, code = 200, traceId = null) {
  return res.status(code).json({
    success: true,
    code,
    message,
    data,
    trace_id: traceId,
  });
}

function errorResponse(res, message, code = 500, traceId = null) {
  return res.status(code).json({
    success: false,
    code,
    message,
    data: null,
    trace_id: traceId,
  });
}

module.exports = {
  successResponse,
  errorResponse,
};
