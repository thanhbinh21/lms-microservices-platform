// Chuan response API thong nhat toan he thong
export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
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
