/**
 * [INPUT]: LiblibAI F.1 Kontext API, credit_ledger
 * [OUTPUT]: /generate route for image generation
 * [POS]: server/src/routes — image generation endpoint
 * [PROTOCOL]: update on LiblibAI API or generation flow changes
 */
import { Hono } from 'hono';
import { kontextText2Img, kontextImg2Img, waitForResult } from '../liblib.js';

type Env = { Variables: { userId: string } };

export const generateRouter = new Hono<Env>();

generateRouter.post('/image', async (c) => {
  const body = await c.req.json<{
    prompt: string;
    imageList?: string[];
    aspectRatio?: string;
    imgCount?: number;
  }>();

  if (!body.prompt) return c.json({ error: 'MISSING_PROMPT' }, 400);

  const aspectRatio = (body.aspectRatio as any) || '1:1';

  const { generateUuid } = body.imageList?.length
    ? await kontextImg2Img(body.prompt, body.imageList, { aspectRatio, imgCount: body.imgCount })
    : await kontextText2Img(body.prompt, { aspectRatio, imgCount: body.imgCount });

  return c.json({ generateUuid });
});

generateRouter.get('/status/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  try {
    const result = await waitForResult(uuid, 120_000);
    const images = result.images
      .filter(img => img.auditStatus === 3)
      .map(img => img.imageUrl);
    return c.json({ status: 'success', images, pointsCost: result.pointsCost });
  } catch (e) {
    return c.json({ status: 'failed', error: (e as Error).message }, 500);
  }
});
