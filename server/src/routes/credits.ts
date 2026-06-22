import { Hono } from 'hono';
import { db } from '../db/index.js';
import { creditLedger } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { CREDIT_COST_PER_IMAGE, SIGNUP_BONUS } from '../config.js';

type Env = { Variables: { userId: string } };

export const creditsRouter = new Hono<Env>();

const getBalance = async (userId: string): Promise<number> => {
  const latest = await db
    .select({ balanceAfter: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.id))
    .limit(1);
  return latest[0]?.balanceAfter ?? 0;
};

const ensureSignupBonus = async (userId: string): Promise<boolean> => {
  const exists = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .limit(1);
  if (exists.length > 0) return false;

  await db.insert(creditLedger).values({
    userId,
    amount: SIGNUP_BONUS,
    balanceAfter: SIGNUP_BONUS,
    type: 'signup_bonus',
  });
  return true;
};

// GET /balance
creditsRouter.get('/balance', async (c) => {
  const userId = c.get('userId');
  await ensureSignupBonus(userId);
  const balance = await getBalance(userId);
  return c.json({ balance, costPerImage: CREDIT_COST_PER_IMAGE });
});

// GET /history
creditsRouter.get('/history', async (c) => {
  const userId = c.get('userId');
  const page = Math.max(1, Number(c.req.query('page') || '1'));
  const pageSize = 20;

  const rows = await db
    .select({
      id: creditLedger.id,
      amount: creditLedger.amount,
      balanceAfter: creditLedger.balanceAfter,
      type: creditLedger.type,
      refId: creditLedger.refId,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return c.json({ items: rows, page, pageSize });
});

// POST /deduct — 生成前扣积分
creditsRouter.post('/deduct', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ taskId: string }>();
  const cost = CREDIT_COST_PER_IMAGE;

  // advisory lock 序列化同一用户的扣减，防止并发竞态
  const result = await db.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${userId}));
    WITH latest AS (
      SELECT COALESCE(
        (SELECT balance_after FROM credit_ledger
         WHERE user_id = ${userId} ORDER BY id DESC LIMIT 1),
        0
      ) AS balance
    )
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, ref_id)
    SELECT ${userId}, ${-cost}, latest.balance - ${cost}, 'generation', ${body.taskId}
    FROM latest
    WHERE latest.balance >= ${cost}
    RETURNING balance_after
  `);

  if (result.length === 0) {
    const balance = await getBalance(userId);
    return c.json({ error: 'INSUFFICIENT_CREDITS', balance, required: cost }, 402);
  }

  return c.json({ balance: result[0].balance_after });
});

// POST /refund — 生成失败退积分（从原始扣减记录派生金额，原子操作）
creditsRouter.post('/refund', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ taskId: string }>();

  const result = await db.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${userId}));
    WITH deduction AS (
      SELECT amount FROM credit_ledger
      WHERE user_id = ${userId} AND ref_id = ${body.taskId} AND type = 'generation'
      LIMIT 1
    ),
    no_dup AS (
      SELECT 1 WHERE NOT EXISTS (
        SELECT 1 FROM credit_ledger
        WHERE user_id = ${userId} AND ref_id = ${body.taskId} AND type = 'refund'
      )
    ),
    latest AS (
      SELECT COALESCE(
        (SELECT balance_after FROM credit_ledger
         WHERE user_id = ${userId} ORDER BY id DESC LIMIT 1),
        0
      ) AS balance
    )
    INSERT INTO credit_ledger (user_id, amount, balance_after, type, ref_id)
    SELECT ${userId}, -deduction.amount, latest.balance + (-deduction.amount), 'refund', ${body.taskId}
    FROM deduction, no_dup, latest
    RETURNING balance_after
  `);

  if (result.length === 0) {
    return c.json({ error: 'REFUND_NOT_APPLICABLE' }, 409);
  }

  return c.json({ balance: result[0].balance_after });
});
