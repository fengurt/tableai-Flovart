/**
 * [INPUT]: config.fenpayBaseUrl, config.fenpayAppId, config.fenpayAppSecret
 * [OUTPUT]: FenPay Open API client (payments, refunds, queries)
 * [POS]: server/src — payment gateway adapter
 * [PROTOCOL]: update on FenPay API changes
 */
import crypto from 'node:crypto';
import { config } from './config.js';

const sign = (method: string, path: string, query: string, timestamp: string, nonce: string, body: string): string => {
  const signStr = `${method}\n${path}\n${query}\n${timestamp}\n${nonce}\n${body}`;
  return crypto.createHmac('sha256', config.fenpayAppSecret).update(signStr).digest('hex');
};

const request = async <T>(method: string, path: string, opts?: { body?: Record<string, unknown>; query?: string }): Promise<T> => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const query = opts?.query ?? '';
  const body = opts?.body ? JSON.stringify(opts.body, null, 0) : '';

  const signature = sign(method, path, query, timestamp, nonce, body);
  const url = `${config.fenpayBaseUrl}${path}${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': config.fenpayAppId,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
    },
    ...(body ? { body } : {}),
  });

  const data = await res.json() as { code: string; message?: string; data?: T };
  if (data.code !== 'SUCCESS') {
    throw new Error(`FenPay ${method} ${path}: ${data.message ?? data.code}`);
  }
  return data.data as T;
};

// ── 支付 ──

export type FenpayPayment = {
  payment_id: string;
  out_trade_no: string;
  amount: string;
  status: string;
  pay_params: Record<string, unknown>;
};

export const createPayment = (outTradeNo: string, amount: string, opts?: {
  subject?: string;
  openid?: string;
  payType?: string;
  metadata?: Record<string, unknown>;
}): Promise<FenpayPayment> =>
  request<FenpayPayment>('POST', '/open/v1/payments', {
    body: {
      out_trade_no: outTradeNo,
      amount,
      ...(opts?.subject && { subject: opts.subject }),
      ...(opts?.openid && { openid: opts.openid }),
      ...(opts?.payType && { pay_type: opts.payType }),
      ...(opts?.metadata && { metadata: opts.metadata }),
    },
  });

export const getPayment = (outTradeNo: string): Promise<FenpayPayment> =>
  request<FenpayPayment>('GET', `/open/v1/payments/${outTradeNo}`);

export const closePayment = (outTradeNo: string): Promise<void> =>
  request('POST', `/open/v1/payments/${outTradeNo}/close`);

// ── 收银台 ──

export type FenpayCashier = {
  cashier_url: string;
  payment_id: string;
};

export const getCashierUrl = (outTradeNo: string, returnUrl?: string): Promise<FenpayCashier> =>
  request<FenpayCashier>('POST', `/open/v1/payments/${outTradeNo}/cashier`, {
    body: {
      ...(returnUrl && { return_url: returnUrl }),
    },
  });

// ── Webhook 签名验证 ──

export const verifyWebhook = (timestamp: string, nonce: string, body: string, signature: string): boolean => {
  const signStr = `${timestamp}\n${nonce}\n${body}`;
  const expected = crypto.createHmac('sha256', config.fenpayWebhookSecret).update(signStr).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
};
