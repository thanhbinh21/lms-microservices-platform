// Chuan response API thong nhat toan he thong
export interface ApiResponse<T = unknown> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
}

export function createSuccessResponse<T>(data: T, message = 'OK', traceId = '', code = 200): ApiResponse<T> {
  return { success: true, code, message, data, trace_id: traceId };
}

export function createErrorResponse(message: string, code = 500, traceId = ''): ApiResponse<null> {
  return { success: false, code, message, data: null, trace_id: traceId };
}

// Thong tin user tu JWT (Gateway inject vao header)
export interface UserContext {
  userId: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
}

// Headers tu Kong Gateway
export interface GatewayHeaders {
  'x-user-id': string;
  'x-user-role': string;
  'x-trace-id': string;
}

// Base event cho Kafka (envelope co field chuan)
export interface KafkaEvent<T = any> {
  event_id: string;
  event_type: string;
  timestamp: string;
  data: T;
  trace_id: string;
}

// ─── Payment / Order domain ───────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';

export interface OrderDto {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: 'vnpay';
  vnpTxnRef: string;
  vnpPayUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}

export interface CreateOrderInput {
  courseId: string;
}

export interface CreateOrderResult {
  orderId: string;
  payUrl: string;
  amount: number;
  currency: string;
}

// Event thanh toan hoan tat (publish boi payment-service)
export interface PaymentCompletedEvent {
  order_id: string;
  user_id: string;
  course_id: string;
  amount: number;
  currency: string;
  payment_method: 'vnpay';
  vnp_txn_ref: string;
  vnp_transaction_no: string;
  paid_at: string;
  instructor_share_ratio?: number;
  platform_fee_ratio?: number;
}

// Event enrollment (publish boi course-service sau khi tao enrollment)
export interface EnrollmentCreatedEvent {
  user_id: string;
  course_id: string;
  order_id: string;
  enrolled_at: string;
}

// Data chung cho enrollment (dung cho API response)
export interface EnrollmentData {
  user_id: string;
  course_id: string;
  enrolled_at: string;
  order_id: string;
}

// Response tu VNPay (callback query params)
export interface VNPayResponse {
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_OrderInfo: string;
  vnp_ResponseCode: string;
  vnp_TransactionNo: string;
  vnp_TransactionStatus: string;
  vnp_BankCode: string;
  vnp_PayDate: string;
  vnp_SecureHash: string;
  [key: string]: string;
}

export interface RequireAdminMiddlewareOptions {
  unauthorizedMessage?: string;
  forbiddenMessage?: string;
  traceIdFallback?: string;
}

export interface RequireInternalMiddlewareOptions {
  internalSecret: string;
  forbiddenMessage?: string;
  traceIdFallback?: string;
}

type GatewayHeaderValue = string | string[] | undefined;

export interface AdminGuardRequestLike {
  headers: Record<string, GatewayHeaderValue>;
}

export interface AdminGuardResponseLike {
  locals: Record<string, unknown>;
  status: (code: number) => {
    json: (body: ApiResponse<null>) => unknown;
  };
}

export type AdminGuardNext = () => void;

function readHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

interface GatewayUserContext {
  userId: string;
  userRole: string;
  userEmail: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readUserContextFromHeaders(headers: Record<string, GatewayHeaderValue>): GatewayUserContext {
  const gatewayUserId = readHeaderValue(headers['x-user-id']);
  const gatewayUserRole = readHeaderValue(headers['x-user-role']);
  const gatewayUserEmail = readHeaderValue(headers['x-user-email']);

  if (gatewayUserId) {
    return {
      userId: gatewayUserId,
      userRole: gatewayUserRole,
      userEmail: gatewayUserEmail,
    };
  }

  const authorization = readHeaderValue(headers.authorization);
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return { userId: '', userRole: '', userEmail: '' };
  }

  const token = authorization.slice(7).trim();
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { userId: '', userRole: '', userEmail: '' };
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : '';
  const userRole = typeof payload.role === 'string' ? payload.role : '';
  const userEmail = typeof payload.email === 'string' ? payload.email : '';

  return { userId, userRole, userEmail };
}

/**
 * Tao middleware check vai tro ADMIN tu header do Gateway inject.
 * Dung factory de cac service co the tuy bien message theo domain.
 */
export function createRequireAdmin(options: RequireAdminMiddlewareOptions = {}) {
  const unauthorizedMessage = options.unauthorizedMessage || 'Unauthorized - missing x-user-id header';
  const forbiddenMessage = options.forbiddenMessage || 'Forbidden - admin access required';
  const traceIdFallback = options.traceIdFallback || 'unknown';

  return function requireAdmin(
    req: AdminGuardRequestLike,
    res: AdminGuardResponseLike,
    next: AdminGuardNext,
  ): void {
    const context = readUserContextFromHeaders(req.headers);
    const userId = context.userId;
    const userRole = context.userRole.toUpperCase();
    const traceId = readHeaderValue(req.headers['x-trace-id']) || traceIdFallback;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: unauthorizedMessage,
        data: null,
        trace_id: traceId,
      };
      res.status(401).json(response);
      return;
    }

    if (userRole !== 'ADMIN') {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: forbiddenMessage,
        data: null,
        trace_id: traceId,
      };
      res.status(403).json(response);
      return;
    }

    res.locals.userId = userId;
    res.locals.userRole = userRole;
    res.locals.userEmail = context.userEmail;
    next();
  };
}

/**
 * Tao middleware check xac thuc tu header (do Gateway inject).
 * Service con cung co the tuy bien message neu can.
 */
export function createRequireAuth(options: RequireAdminMiddlewareOptions = {}) {
  const unauthorizedMessage = options.unauthorizedMessage || 'Unauthorized - missing x-user-id header';
  const traceIdFallback = options.traceIdFallback || 'unknown';

  return function requireAuth(
    req: AdminGuardRequestLike,
    res: AdminGuardResponseLike,
    next: AdminGuardNext,
  ): void {
    const context = readUserContextFromHeaders(req.headers);
    const userId = context.userId;
    const traceId = readHeaderValue(req.headers['x-trace-id']) || traceIdFallback;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        code: 401,
        message: unauthorizedMessage,
        data: null,
        trace_id: traceId,
      };
      res.status(401).json(response);
      return;
    }

    res.locals.userId = userId;
    res.locals.userRole = context.userRole;
    res.locals.userEmail = context.userEmail;
    next();
  };
}

/**
 * Tao middleware cho endpoint /internal/*.
 * Header x-internal-secret moi la bien xac thuc, x-internal-call chi de trace nguon goi.
 */
export function createRequireInternal(options: RequireInternalMiddlewareOptions) {
  const internalSecret = options.internalSecret;
  const forbiddenMessage = options.forbiddenMessage || 'Forbidden - invalid internal secret';
  const traceIdFallback = options.traceIdFallback || 'unknown';

  return function requireInternal(
    req: AdminGuardRequestLike,
    res: AdminGuardResponseLike,
    next: AdminGuardNext,
  ): void {
    const providedSecret = readHeaderValue(req.headers['x-internal-secret']);
    const traceId = readHeaderValue(req.headers['x-trace-id']) || traceIdFallback;
    const internalCaller = readHeaderValue(req.headers['x-internal-call']);

    if (!internalSecret || !providedSecret || providedSecret !== internalSecret) {
      const response: ApiResponse<null> = {
        success: false,
        code: 403,
        message: forbiddenMessage,
        data: null,
        trace_id: traceId,
      };
      res.status(403).json(response);
      return;
    }

    res.locals.internalCaller = internalCaller;
    next();
  };
}
