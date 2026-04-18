import { createHmac } from 'crypto';

/**
 * VNPay helper — tuan thu dac ta Sandbox v2.1.0.
 * Tham khao: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 *
 * Quy tac quan trong:
 *  - Tat ca tham so vnp_* phai duoc sort theo alphabet truoc khi tinh checksum.
 *  - encodeURIComponent theo chuan RFC3986 (giong Java URLEncoder.encode(.., "UTF-8")).
 *    Java encoder thay space = '+'. encodeURIComponent thay space = '%20'.
 *    VNPay yeu cau giong Java. Ham sortObject/encodeParams ben duoi xu ly dieu do.
 *  - vnp_Amount = sotien * 100 (VD 300000 VND -> 30000000).
 *  - Checksum: HMAC SHA512 tren query string sau khi sort va encode, khong co '?' o dau.
 */

export interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  url: string;
  returnUrl: string;
  ipnUrl?: string;
  version: string;
  command: string;
  currency: string;
  locale: string;
  orderType: string;
  timeoutMinutes: number;
}

export function loadVNPayConfig(): VNPayConfig {
  return {
    tmnCode: process.env.VNPAY_TMN_CODE!,
    hashSecret: process.env.VNPAY_HASH_SECRET!,
    url: process.env.VNPAY_URL!,
    returnUrl: process.env.VNPAY_RETURN_URL!,
    ipnUrl: process.env.VNPAY_IPN_URL,
    version: process.env.PAYMENT_VERSION || '2.1.0',
    command: process.env.PAYMENT_COMMAND || 'pay',
    currency: process.env.PAYMENT_CURRENCY || 'VND',
    locale: process.env.PAYMENT_LOCALE || 'vn',
    orderType: process.env.PAYMENT_ORDER_TYPE || 'other',
    timeoutMinutes: parseInt(process.env.PAYMENT_TIMEOUT || '15', 10),
  };
}

// Dung encodeURIComponent (RFC3986) - khop voi cach VNPay validate HMAC.
// Note: KHONG duoc dung encodeURI() vi no giu nguyen '&', '=' trong value.
function encodeValue(v: string | number): string {
  return encodeURIComponent(String(v)).replace(/%20/g, '+');
  // VNPay sandbox dung Java URLEncoder -> space = '+'. Neu dung '%20' checksum se lech.
}

function sortAndEncode(params: Record<string, string | number>): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort();
  return keys.map((k) => `${encodeValue(k)}=${encodeValue(params[k])}`).join('&');
}

function formatVNDate(date: Date): string {
  // Dinh dang yyyyMMddHHmmss theo timezone Asia/Ho_Chi_Minh.
  const tz = new Date(date.getTime() + 7 * 60 * 60 * 1000); // UTC+7
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    tz.getUTCFullYear().toString() +
    pad(tz.getUTCMonth() + 1) +
    pad(tz.getUTCDate()) +
    pad(tz.getUTCHours()) +
    pad(tz.getUTCMinutes()) +
    pad(tz.getUTCSeconds())
  );
}

export interface BuildPayUrlInput {
  txnRef: string;       // vnp_TxnRef - ma giao dich duy nhat (su dung lam idempotency key)
  amount: number;       // VND (so nguyen, he thong tu * 100)
  orderInfo: string;    // noi dung hien thi cho khach
  ipAddr: string;       // IP client
  createDate?: Date;    // default: now
  bankCode?: string;    // optional
}

export interface BuildPayUrlResult {
  payUrl: string;
  expireDate: Date;
  params: Record<string, string>;
  signature: string;
}

/**
 * Tao URL thanh toan VNPay co gan checksum.
 */
export function buildPayUrl(config: VNPayConfig, input: BuildPayUrlInput): BuildPayUrlResult {
  const now = input.createDate || new Date();
  const expire = new Date(now.getTime() + config.timeoutMinutes * 60 * 1000);

  const params: Record<string, string> = {
    vnp_Version: config.version,
    vnp_Command: config.command,
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(Math.round(input.amount * 100)),
    vnp_CurrCode: config.currency,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: config.orderType,
    vnp_Locale: config.locale,
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ipAddr || '127.0.0.1',
    vnp_CreateDate: formatVNDate(now),
    vnp_ExpireDate: formatVNDate(expire),
  };

  if (input.bankCode) {
    params.vnp_BankCode = input.bankCode;
  }

  const signData = sortAndEncode(params);
  const signature = createHmac('sha512', config.hashSecret).update(signData, 'utf-8').digest('hex');

  const payUrl = `${config.url}?${signData}&vnp_SecureHash=${signature}`;

  return { payUrl, expireDate: expire, params, signature };
}

export interface VerifyReturnInput {
  query: Record<string, string | string[] | undefined>;
}

export interface VerifyReturnResult {
  valid: boolean;
  /** Ma giao dich (vnp_TxnRef) — dung tim order. */
  txnRef: string;
  /** Tong tien (VND, da /100). */
  amount: number;
  /** '00' = thanh cong. */
  responseCode: string;
  /** '00' = giao dich thanh cong. */
  transactionStatus: string;
  /** Ma giao dich phia VNPay. */
  transactionNo: string;
  bankCode: string;
  payDate: string;
  /** Payload goc (da loc params vnp_*). */
  params: Record<string, string>;
  signature: string;
}

/**
 * Xac thuc chu ky tu VNPay (dung cho ca Return URL va IPN URL).
 * Loai bo vnp_SecureHash va vnp_SecureHashType truoc khi tinh lai checksum.
 */
export function verifyReturn(config: VNPayConfig, input: VerifyReturnInput): VerifyReturnResult {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.query)) {
    if (!k.startsWith('vnp_')) continue;
    if (Array.isArray(v)) {
      flat[k] = v[0] || '';
    } else if (v != null) {
      flat[k] = String(v);
    }
  }

  const signature = (flat.vnp_SecureHash || '').toLowerCase();
  delete flat.vnp_SecureHash;
  delete flat.vnp_SecureHashType;

  const signData = sortAndEncode(flat);
  const expected = createHmac('sha512', config.hashSecret)
    .update(signData, 'utf-8')
    .digest('hex')
    .toLowerCase();

  const valid = signature.length > 0 && signature === expected;
  const amount = Math.round(parseInt(flat.vnp_Amount || '0', 10) / 100);

  return {
    valid,
    txnRef: flat.vnp_TxnRef || '',
    amount,
    responseCode: flat.vnp_ResponseCode || '',
    transactionStatus: flat.vnp_TransactionStatus || '',
    transactionNo: flat.vnp_TransactionNo || '',
    bankCode: flat.vnp_BankCode || '',
    payDate: flat.vnp_PayDate || '',
    params: flat,
    signature,
  };
}

/**
 * Kiem tra trang thai giao dich thanh cong.
 * Theo VNPay: vnp_ResponseCode '00' + vnp_TransactionStatus '00' = OK.
 */
export function isSuccessful(result: VerifyReturnResult): boolean {
  return result.valid && result.responseCode === '00' && result.transactionStatus === '00';
}
