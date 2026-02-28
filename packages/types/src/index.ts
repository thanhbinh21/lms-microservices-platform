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

// Base event cho Kafka
export interface KafkaEvent<T = any> {
  event_id: string;
  event_type: string;
  timestamp: string;
  data: T;
  trace_id: string;
}

// Event thanh toan hoan tat
export interface PaymentCompletedEvent {
  order_id: string;
  user_id: string;
  course_id: string;
  amount: number;
  payment_method: 'vnpay';
  vnpay_transaction_id: string;
}

// Du lieu ghi danh khoa hoc
export interface EnrollmentData {
  user_id: string;
  course_id: string;
  enrolled_at: string;
  order_id: string;
}

// Response tu VNPay callback
export interface VNPayResponse {
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_OrderInfo: string;
  vnp_ResponseCode: string;
  vnp_TransactionNo: string;
  vnp_BankCode: string;
  vnp_PayDate: string;
  vnp_SecureHash: string;
  [key: string]: string;
}
