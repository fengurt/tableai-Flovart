/**
 * [INPUT]: LiblibAI F.1 Kontext API, credit_ledger
 * [OUTPUT]: /generate route for image generation + temp image hosting
 * [POS]: server/src/routes — image generation endpoint
 * [PROTOCOL]: update on LiblibAI API or generation flow changes
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { kontextText2Img, kontextImg2Img, waitForResult } from '../liblib.js';
import { config } from '../config.js';

type Env = { Variables: { userId: string } };

export const generateRouter = new Hono<Env>();
export const generatePublicRouter = new Hono();

const TMP_DIR = '/tmp/flovart-uploads';
fs.mkdirSync(TMP_DIR, { recursive: true });

const saveDataUrl = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid data URL');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(TMP_DIR, name), Buffer.from(match[2], 'base64'));
  return name;
};

const SAFE_NAME = /^[a-f0-9]{32}\.(png|jpg|webp)$/;
const cleanup = (names: string[]) => {
  for (const name of names) {
    if (!SAFE_NAME.test(name)) continue;
    fs.unlink(path.join(TMP_DIR, name), () => {});
  }
};

// 临时图片公开访问（不走 auth）
generatePublicRouter.get('/tmp/:name', async (c) => {
  const name = c.req.param('name');
  if (/[\/\\]/.test(name)) return c.json({ error: 'INVALID_NAME' }, 400);
  const filePath = path.join(TMP_DIR, name);
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(name).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'application/octet-stream';
    return new Response(buf, { headers: { 'Content-Type': mime, 'Cache-Control': 'no-store' } });
  } catch {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }
});

generateRouter.post('/image', async (c) => {
  const body = await c.req.json<{
    prompt: string;
    imageList?: string[];
    aspectRatio?: string;
    imgCount?: number;
  }>();

  if (!body.prompt) return c.json({ error: 'MISSING_PROMPT' }, 400);

  const aspectRatio = (body.aspectRatio as any) || '1:1';
  const tmpFiles: string[] = [];

  try {
    let imageUrls: string[] | undefined;
    if (body.imageList?.length) {
      const origin = config.corsOrigin;
      imageUrls = body.imageList.map(item => {
        if (item.startsWith('data:')) {
          const name = saveDataUrl(item);
          tmpFiles.push(name);
          return `${origin}/api/generate/tmp/${name}`;
        }
        return item;
      });
    }

    const { generateUuid } = imageUrls?.length
      ? await kontextImg2Img(body.prompt, imageUrls, { aspectRatio, imgCount: body.imgCount })
      : await kontextText2Img(body.prompt, { aspectRatio, imgCount: body.imgCount });

    return c.json({ generateUuid, _tmpFiles: tmpFiles });
  } catch (e) {
    cleanup(tmpFiles);
    throw e;
  }
});

generateRouter.get('/status/:uuid', async (c) => {
  const uuid = c.req.param('uuid');
  const tmpFilesHeader = c.req.header('X-Tmp-Files');
  const tmpFiles = tmpFilesHeader ? tmpFilesHeader.split(',') : [];

  try {
    const result = await waitForResult(uuid, 120_000);
    const images = result.images
      .filter(img => img.auditStatus === 3)
      .map(img => img.imageUrl);
    return c.json({ status: 'success', images, pointsCost: result.pointsCost });
  } catch (e) {
    return c.json({ status: 'failed', error: (e as Error).message }, 500);
  } finally {
    cleanup(tmpFiles);
  }
});
