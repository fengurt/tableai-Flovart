/**
 * [INPUT]: external image URLs
 * [OUTPUT]: persistent image storage + serving
 * [POS]: server/src/routes — image persistence for canvas
 * [PROTOCOL]: update on storage strategy changes
 */
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';

const IMAGES_DIR = '/data/flovart-images';
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const isPrivateIP = (ip: string): boolean =>
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|fc|fd|fe80)/.test(ip);

export const imagesRouter = new Hono();
export const imagesPublicRouter = new Hono();

// POST /api/images/persist — 下载外部图片保存到本地
imagesRouter.post('/persist', async (c) => {
  const body = await c.req.json<{ url: string }>();
  if (!body.url) return c.json({ error: 'MISSING_URL' }, 400);

  let parsed: URL;
  try {
    parsed = new URL(body.url);
    if (parsed.protocol !== 'https:') {
      return c.json({ error: 'URL_NOT_ALLOWED' }, 400);
    }
  } catch {
    return c.json({ error: 'INVALID_URL' }, 400);
  }

  // SSRF: DNS 解析后拦截私有/回环/元数据地址
  try {
    const { address } = await dns.lookup(parsed.hostname);
    if (isPrivateIP(address)) return c.json({ error: 'URL_NOT_ALLOWED' }, 400);
  } catch {
    return c.json({ error: 'DNS_RESOLVE_FAILED' }, 400);
  }

  const res = await fetch(body.url, { redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) return c.json({ error: 'REDIRECT_NOT_ALLOWED' }, 400);
  if (!res.ok) return c.json({ error: 'DOWNLOAD_FAILED' }, 502);

  const contentType = res.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
    : contentType.includes('webp') ? 'webp' : 'png';
  const id = crypto.randomBytes(16).toString('hex');
  const filename = `${id}.${ext}`;

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);

  const origin = c.req.header('Origin') || c.req.header('Referer')?.replace(/\/+$/, '') || '';
  const imageUrl = `${origin}/api/images/${filename}`;

  return c.json({ imageUrl, filename });
});

// GET /api/images/:filename — 公开访问已保存的图片
imagesPublicRouter.get('/:filename', async (c) => {
  const filename = c.req.param('filename');
  if (/[\/\\]/.test(filename) || filename.includes('..')) {
    return c.json({ error: 'INVALID_FILENAME' }, 400);
  }

  const filePath = path.join(IMAGES_DIR, filename);
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filename).slice(1);
    const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return new Response(buf, {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }
});
