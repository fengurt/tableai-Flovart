/**
 * [INPUT]: server /api/generate endpoints
 * [OUTPUT]: generateImageWithLiblib — calls server-side LiblibAI, returns base64
 * [POS]: services — LiblibAI frontend client
 * [PROTOCOL]: update on server generate API changes
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

export async function generateImageWithLiblib(
  prompt: string,
  imageList?: string[],
): Promise<{ newImageBase64: string | null; newImageMimeType: string | null; textResponse: string | null }> {
  const res = await authedFetch('/api/generate/image', {
    method: 'POST',
    body: JSON.stringify({ prompt, imageList }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || `生图失败: ${res.status}`);
  }
  const { generateUuid } = (await res.json()) as { generateUuid: string };

  const statusRes = await authedFetch(`/api/generate/status/${generateUuid}`);
  if (!statusRes.ok) {
    const data = await statusRes.json().catch(() => ({}));
    throw new Error((data as any).error || '查询生图结果失败');
  }
  const result = (await statusRes.json()) as { status: string; images: string[]; error?: string };
  if (result.status !== 'success' || !result.images?.length) {
    throw new Error(result.error || '生图未返回结果');
  }

  const imgRes = await fetch(result.images[0]);
  if (!imgRes.ok) throw new Error('下载生成图片失败');
  const blob = await imgRes.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const commaIdx = dataUrl.indexOf(',');
  const mimeMatch = dataUrl.match(/^data:([^;]+)/);
  return {
    newImageBase64: dataUrl.slice(commaIdx + 1),
    newImageMimeType: mimeMatch?.[1] || 'image/png',
    textResponse: null,
  };
}
