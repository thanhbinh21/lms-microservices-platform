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
    const userId = readHeaderValue(req.headers['x-user-id']);
    const userRole = readHeaderValue(req.headers['x-user-role']).toUpperCase();
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
    const userId = readHeaderValue(req.headers['x-user-id']);
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
    // userRole co the co hoac khong, chu yeu la can userId
    res.locals.userRole = readHeaderValue(req.headers['x-user-role']);
    next();
  };
}
