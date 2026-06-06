import { pgTable, bigserial, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const creditLedger = pgTable('credit_ledger', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  type: text('type').notNull(), // signup_bonus | topup | generation | refund
  refId: text('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_ledger_user_created').on(table.userId, table.createdAt),
]);

export const topupOrder = pgTable('topup_order', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tier: text('tier').notNull(),
  amountCents: integer('amount_cents').notNull(),
  credits: integer('credits').notNull(),
  status: text('status').default('pending').notNull(), // pending | paid | failed
  channel: text('channel'),
  channelTxId: text('channel_tx_id'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_order_user').on(table.userId),
]);
