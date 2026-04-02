const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const instructorRoutes = require('./routes/instructor.routes');
const { errorResponse, successResponse } = require('./utils/apiResponse');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  return successResponse(
    res,
    'Instructor service is healthy',
    {
      service: 'instructor-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    200,
    req.headers['x-trace-id'] || null,
  );
});

app.use('/instructor', instructorRoutes);

app.use((req, res) => {
  return errorResponse(res, `Route ${req.method} ${req.path} not found`, 404, req.headers['x-trace-id'] || null);
});

app.use((error, req, res, _next) => {
  return errorResponse(res, error.message || 'Internal server error', 500, req.headers['x-trace-id'] || null);
});

module.exports = app;
