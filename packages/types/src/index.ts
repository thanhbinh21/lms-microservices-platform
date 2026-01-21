// API Response Standard
export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
}

// User Context (from JWT)
export interface UserContext {
  userId: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
}

// Gateway Headers
export interface GatewayHeaders {
  'x-user-id': string;
  'x-user-role': string;
  'x-trace-id': string;
}

// Kafka Event Base
export interface KafkaEvent<T = any> {
  event_id: string;
  event_type: string;
  timestamp: string;
  data: T;
  trace_id: string;
}

// Payment Events
export interface PaymentCompletedEvent {
  order_id: string;
  user_id: string;
  course_id: string;
  amount: number;
  payment_method: 'vnpay';
  vnpay_transaction_id: string;
}

// Course Enrollment
export interface EnrollmentData {
  user_id: string;
  course_id: string;
  enrolled_at: string;
  order_id: string;
}

// VNPay Response
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
