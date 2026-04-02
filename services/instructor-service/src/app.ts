import cors from 'cors';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import instructorRoutes from './routes/instructor.routes';
import { errorResponse, successResponse } from './utils/apiResponse';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req: Request, res: Response) => {
  return successResponse(
    res,
    'Instructor service is healthy',
    {
      service: 'instructor-service',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    200,
    (req.headers['x-trace-id'] as string | undefined) || null,
  );
});

app.use('/instructor', instructorRoutes);

app.use((req: Request, res: Response) => {
  return errorResponse(
    res,
    `Route ${req.method} ${req.path} not found`,
    404,
    (req.headers['x-trace-id'] as string | undefined) || null,
  );
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : 'Internal server error';
  return errorResponse(res, message, 500, (req.headers['x-trace-id'] as string | undefined) || null);
});

export default app;
