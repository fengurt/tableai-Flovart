/**
 * [INPUT]: config.liblibAccessKey, config.liblibSecretKey
 * [OUTPUT]: LiblibAI F.1 Kontext text2img/img2img + status polling
 * [POS]: server/src — image generation adapter
 * [PROTOCOL]: update on LiblibAI API changes
 */
import crypto from 'node:crypto';
import { config } from './config.js';

const BASE = 'https://openapi.liblibai.cloud';

const sign = (uri: string): { url: string } => {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const content = `${uri}&${timestamp}&${nonce}`;
  const hmac = crypto.createHmac('sha1', config.liblibSecretKey).update(content).digest('base64url');
  return {
    url: `${BASE}${uri}?AccessKey=${config.liblibAccessKey}&Signature=${hmac}&Timestamp=${timestamp}&SignatureNonce=${nonce}`,
  };
};

const post = async <T>(uri: string, body: Record<string, unknown>): Promise<T> => {
  const { url } = sign(uri);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { code: number; msg: string; data?: T };
  if (data.code !== 0) throw new Error(`LiblibAI ${uri}: [${data.code}] ${data.msg}`);
  return data.data as T;
};

// ── F.1 Kontext 文生图 ──

const KONTEXT_T2I_TEMPLATE = 'fe9928fde1b4491c9b360dd24aa2b115';
const KONTEXT_I2I_TEMPLATE = '1c0a9712b3d84e1b8a9f49514a46d88c';

type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '9:21' | '21:9';

export const kontextText2Img = (prompt: string, opts?: {
  model?: 'pro' | 'max';
  aspectRatio?: AspectRatio;
  guidanceScale?: number;
  imgCount?: number;
}): Promise<{ generateUuid: string }> =>
  post('/api/generate/kontext/text2img', {
    templateUuid: KONTEXT_T2I_TEMPLATE,
    generateParams: {
      prompt,
      model: opts?.model ?? 'pro',
      aspectRatio: opts?.aspectRatio ?? '1:1',
      ...(opts?.guidanceScale !== undefined && { guidance_scale: opts.guidanceScale }),
      imgCount: opts?.imgCount ?? 1,
    },
  });

export const kontextImg2Img = (prompt: string, imageList: string[], opts?: {
  model?: 'pro' | 'max';
  aspectRatio?: AspectRatio;
  guidanceScale?: number;
  imgCount?: number;
}): Promise<{ generateUuid: string }> =>
  post('/api/generate/kontext/img2img', {
    templateUuid: KONTEXT_I2I_TEMPLATE,
    generateParams: {
      prompt,
      image_list: imageList,
      model: opts?.model ?? 'max',
      aspectRatio: opts?.aspectRatio ?? '1:1',
      ...(opts?.guidanceScale !== undefined && { guidance_scale: opts.guidanceScale }),
      imgCount: opts?.imgCount ?? 1,
    },
  });

// ── 查询任务状态 ──

export type GenerateResult = {
  generateUuid: string;
  generateStatus: number; // 1=waiting 2=running 5=success 6=failed 7=timeout
  percentCompleted: number;
  generateMsg: string;
  pointsCost: number;
  accountBalance: number;
  images: { imageUrl: string; seed: number; auditStatus: number }[];
};

export const queryStatus = (generateUuid: string): Promise<GenerateResult> =>
  post('/api/generate/status', { generateUuid });

// 轮询直到完成
export const waitForResult = async (generateUuid: string, timeoutMs = 120_000): Promise<GenerateResult> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await queryStatus(generateUuid);
    if (result.generateStatus === 5) return result;
    if (result.generateStatus === 6) throw new Error(`生图失败: ${result.generateMsg}`);
    if (result.generateStatus === 7) throw new Error('生图超时');
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('等待生图结果超时');
};
