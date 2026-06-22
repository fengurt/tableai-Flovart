import crypto from 'node:crypto';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { creditLedger, topupOrder } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { config, TOPUP_TIERS, type TopupTier } from '../config.js';

type Env = { Variables: { userId: string } };

export const topupRouter = new Hono<Env>();
export const topupPublicRouter = new Hono();

const generateOrderId = () =>
  `ord_${crypto.randomBytes(16).toString('hex')}`;

// GET /tiers — 公开接口，无需认证
topupPublicRouter.get('/tiers', (c) => {
  const tiers = Object.entries(TOPUP_TIERS).map(([id, tier]) => ({
    id,
    priceCents: tier.amountCents,
    credits: tier.credits,
  }));
  return c.json({ tiers });
});

// POST /create
topupRouter.post('/create', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ tier: string }>();

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
  });

  // TODO: 对接支付渠道，生成支付链接
  return c.json({ orderId, amountCents: tier.amountCents, credits: tier.credits });
});

// ── 支付回调（独立路由，不走 JWT，走签名验证） ──

export const paymentWebhook = new Hono();

const verifyWebhookSignature = (body: string, signature: string | undefined): boolean => {
  if (!config.webhookSecret) return false;
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', config.webhookSecret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

paymentWebhook.post('/payment', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Webhook-Signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return c.json({ error: 'INVALID_SIGNATURE' }, 403);
  }

  const body = JSON.parse(rawBody) as {
    orderId: string;
    channelTxId?: string;
    amountCents?: number;
  };

  const orders = await db
    .select()
    .from(topupOrder)
    .where(eq(topupOrder.id, body.orderId))
    .limit(1);

  if (orders.length === 0) return c.json({ error: 'ORDER_NOT_FOUND' }, 404);

  const order = orders[0];
  if (order.status === 'paid') return c.json({ error: 'ALREADY_PAID' }, 409);

  // 验证金额匹配
  if (body.amountCents !== undefined && body.amountCents !== order.amountCents) {
    return c.json({ error: 'AMOUNT_MISMATCH' }, 400);
  }

  await db
    .update(topupOrder)
    .set({
      status: 'paid',
      channelTxId: body.channelTxId,
      paidAt: new Date(),
    })
    .where(eq(topupOrder.id, body.orderId));

  await db.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${order.userId}));
    WITH latest AS (
      SELECT COALESCE(
        (SELECT balance_after FROM credit_ledger
         WHERE user_id = ${order.userId} ORDER BY id DESC LIMIT 1),
        0
      ) AS balance
    )
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, ref_id)
    SELECT ${order.userId}, ${order.credits}, latest.balance + ${order.credits}, 'topup', ${body.orderId}
    FROM latest
  `);

  return c.json({ ok: true });
});
