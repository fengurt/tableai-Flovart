/**
 * [INPUT]: generation_history table
 * [OUTPUT]: /history routes for generation history CRUD
 * [POS]: server/src/routes — history persistence
 * [PROTOCOL]: update on history schema changes
 */
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { generationHistory } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

type Env = { Variables: { userId: string } };

const MAX_ITEMS = 50;

export const historyRouter = new Hono<Env>();

historyRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const items = await db
    .select()
    .from(generationHistory)
    .where(eq(generationHistory.userId, userId))
    .orderBy(desc(generationHistory.createdAt))
    .limit(MAX_ITEMS);
  return c.json({ items });
});

historyRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    id: string;
    name?: string;
    imageUrl: string;
    mimeType?: string;
    width?: number;
    height?: number;
    prompt?: string;
    mediaType?: string;
  }>();

  if (!body.id || !body.imageUrl) {
    return c.json({ error: 'MISSING_FIELDS' }, 400);
  }

  await db.insert(generationHistory).values({
    id: body.id,
    userId,
    name: body.name,
    imageUrl: body.imageUrl,
    mimeType: body.mimeType || 'image/png',
    width: body.width,
    height: body.height,
    prompt: body.prompt,
    mediaType: body.mediaType || 'image',
  }).onConflictDoNothing();

  return c.json({ ok: true });
});

historyRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await db.delete(generationHistory)
    .where(and(eq(generationHistory.id, id), eq(generationHistory.userId, userId)));
  return c.json({ ok: true });
});
