'use server';

import { callApi } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface CreateOrderResult {
  orderId: string;
  payUrl: string;
  amount: number;
  currency: string;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Tao order va nhan URL VNPay de redirect user. */
export async function createOrderAction(courseId: string) {
  return callApi<CreateOrderResult>(
    `/payment/api/orders`,
    {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    },
    true,
  );
}

/** Xem chi tiet mot order. */
export async function getOrderAction(orderId: string) {
  return callApi<OrderDto>(`/payment/api/orders/${orderId}`, { method: 'GET' }, true);
}

/** Lich su order cua user hien tai. */
export async function getMyOrdersAction() {
  return callApi<OrderDto[]>(`/payment/api/orders/my`, { method: 'GET' }, true);
}
