/**
 * [INPUT]: FenPay payment gateway, credit_ledger, topup_order tables
 * [OUTPUT]: topup create/tiers routes, FenPay webhook handler
 * [POS]: server/src/routes — payment flow
 * [PROTOCOL]: update on FenPay API or schema changes
 */
import crypto from 'node:crypto';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { creditLedger, topupOrder } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { TOPUP_TIERS, type TopupTier } from '../config.js';
import { createPayment, getCashierUrl, getPayment, verifyWebhook } from '../fenpay.js';

type Env = { Variables: { userId: string } };

export const topupRouter = new Hono<Env>();
export const topupPublicRouter = new Hono();

const generateOrderId = () =>
  `ord_${crypto.randomBytes(16).toString('hex')}`;

// 分转元，保留两位小数
const centsToYuan = (cents: number): string =>
  (cents / 100).toFixed(2);

// GET /tiers — 公开接口，无需认证
topupPublicRouter.get('/tiers', (c) => {
  const tiers = Object.entries(TOPUP_TIERS).map(([id, tier]) => ({
    id,
    priceCents: tier.amountCents,
    credits: tier.credits,
  }));
  return c.json({ tiers });
});

// POST /create — 创建充值订单，调用 FenPay 下单
topupRouter.post('/create', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ tier: string; openid?: string; payType?: string }>();

  if (!(body.tier in TOPUP_TIERS)) {
    return c.json({ error: 'INVALID_TIER' }, 400);
  }

  const tier = TOPUP_TIERS[body.tier as TopupTier];
  const orderId = generateOrderId();

  await db.insert(topupOrder).values({
    id: orderId,
    userId,
    tier: body.tier,
    amountCents: tier.amountCents,
    credits: tier.credits,
    status: 'pending',
    channel: 'fenpay',
  });

  const payment = await createPayment(orderId, centsToYuan(tier.amountCents), {
    subject: `Flovart 积分充值 - ${tier.credits} 积分`,
    payType: 'WX_NATIVE',
    metadata: { userId, tier: body.tier },
  });

  await db.update(topupOrder)
    .set({ channelTxId: payment.payment_id })
    .where(eq(topupOrder.id, orderId));

  const returnUrl = c.req.header('Origin') || c.req.header('Referer') || '';
  const cashier = await getCashierUrl(orderId, returnUrl || undefined);

  return c.json({
    orderId,
    amountCents: tier.amountCents,
    credits: tier.credits,
    cashierUrl: cashier.cashier_url,
  });
});

// ── FenPay Webhook ──

export const paymentWebhook = new Hono();

paymentWebhook.post('/payment', async (c) => {
  const rawBody = await c.req.text();
  const timestamp = c.req.header('X-FenPay-Timestamp') ?? '';
  const nonce = c.req.header('X-FenPay-Nonce') ?? '';
  const signature = c.req.header('X-FenPay-Signature') ?? '';

  if (!verifyWebhook(timestamp, nonce, rawBody, signature)) {
    return c.json({ error: 'INVALID_SIGNATURE' }, 403);
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    payment_id: string;
    out_trade_no: string;
    amount: string;
    status: string;
    paid_at: string;
  };

  if (event.event !== 'payment.success') {
    return c.json({ ok: true });
  }

  // 主动查询 FenPay 确认支付状态（防伪造）
  const confirmed = await getPayment(event.out_trade_no);
  if (confirmed.status !== 'paid') {
    return c.json({ error: 'PAYMENT_NOT_CONFIRMED' }, 400);
  }

  const orders = await db
    .select()
    .from(topupOrder)
    .where(eq(topupOrder.id, event.out_trade_no))
    .limit(1);

  if (orders.length === 0) return c.json({ error: 'ORDER_NOT_FOUND' }, 404);

  const order = orders[0];
  if (order.status === 'paid') return c.json({ ok: true });

  // 验证金额匹配（FenPay 返回元，订单存分）
  const paidCents = Math.round(Number(confirmed.amount) * 100);
  if (paidCents !== order.amountCents) {
    return c.json({ error: 'AMOUNT_MISMATCH' }, 400);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(topupOrder)
      .set({
        status: 'paid',
        channelTxId: confirmed.payment_id,
        paidAt: new Date(event.paid_at),
      })
      .where(eq(topupOrder.id, order.id));

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${order.userId}))`);
    await tx.execute(sql`
      WITH latest AS (
        SELECT COALESCE(
          (SELECT balance_after FROM credit_ledger
           WHERE user_id = ${order.userId} ORDER BY id DESC LIMIT 1),
          0
        ) AS balance
      )
      INSERT INTO credit_ledger (user_id, amount, balance_after, type, ref_id)
      SELECT ${order.userId}, ${order.credits}, latest.balance + ${order.credits}, 'topup', ${order.id}
      FROM latest
    `);
  });

  return c.json({ ok: true });
});
