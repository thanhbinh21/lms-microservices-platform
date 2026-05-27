import { redirect } from 'next/navigation';

/**
 * Trang user duoc VNPay redirect ve.
 * Flow:
 *  1) Lay query params tu VNPay (vnp_TxnRef, vnp_ResponseCode, ...).
 *  2) Gui sang backend /payment/api/vnpay-return de verify checksum va update order
 *     (dev fallback: NODE_ENV=development tu publish Kafka event neu thanh cong).
 *  3) Chuyen ve man hinh order history duy nhat trong dashboard.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';

interface ReturnData {
  success: boolean;
  orderId: string | null;
  status: string | null;
  responseCode: string;
  transactionStatus: string;
}

async function verifyReturn(query: URLSearchParams): Promise<ReturnData | null> {
  try {
    const url = `${GATEWAY_URL}/payment/api/vnpay-return?${query.toString()}`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    const json = (await res.json()) as { success: boolean; data: ReturnData | null };
    return json.data;
  } catch {
    return null;
  }
}

export default async function VNPayReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (typeof v === 'string') query.set(k, v);
  });

  await verifyReturn(query);
  redirect('/dashboard/orders');
}
