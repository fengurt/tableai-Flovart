/**
 * [INPUT]: server /api/generate + /api/images endpoints
 * [OUTPUT]: generateImageWithLiblib — returns persistent image URL
 * [POS]: services — LiblibAI frontend client
 * [PROTOCOL]: update on server generate/images API changes
 */
const API_BASE = import.meta.env.VITE_CREDITS_API_URL || '';

let tokenProvider: (() => Promise<string>) | null = null;

export const setLiblibTokenProvider = (provider: () => Promise<string>) => {
  tokenProvider = provider;
};

const authedFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  if (!tokenProvider) throw new Error('Token provider not set');
  const token = await tokenProvider();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
};

export type LiblibResult = {
  newImageBase64: string | null;
  newImageMimeType: string | null;
  textResponse: string | null;
  imageUrl?: string;
};

export async function generateImageWithLiblib(
  prompt: string,
  imageList?: string[],
): Promise<LiblibResult> {
  const res = await authedFetch('/api/generate/image', {
    method: 'POST',
    body: JSON.stringify({ prompt, imageList }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || `生图失败: ${res.status}`);
  }
  const { generateUuid, _tmpFiles } = (await res.json()) as { generateUuid: string; _tmpFiles?: string[] };

  const statusRes = await authedFetch(`/api/generate/status/${generateUuid}`, {
    headers: _tmpFiles?.length ? { 'X-Tmp-Files': _tmpFiles.join(',') } : {},
  });
  if (!statusRes.ok) {
    const data = await statusRes.json().catch(() => ({}));
    throw new Error((data as any).error || '查询生图结果失败');
  }
  const result = (await statusRes.json()) as { status: string; images: string[]; error?: string };
  if (result.status !== 'success' || !result.images?.length) {
    throw new Error(result.error || '生图未返回结果');
  }

  const persistRes = await authedFetch('/api/images/persist', {
    method: 'POST',
    body: JSON.stringify({ url: result.images[0] }),
  });
  if (!persistRes.ok) throw new Error('保存图片失败');
  const { imageUrl } = (await persistRes.json()) as { imageUrl: string };

  return {
    newImageBase64: null,
    newImageMimeType: null,
    textResponse: null,
    imageUrl,
  };
}
