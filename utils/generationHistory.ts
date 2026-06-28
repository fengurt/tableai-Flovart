import type { GenerationHistoryItem } from '../types';
import { historyApi, type ServerHistoryItem } from '../services/creditsApi';

const MAX_HISTORY_ITEMS = 50;
const THUMBNAIL_MAX_DIM = 256;

const toLocal = (item: ServerHistoryItem): GenerationHistoryItem => ({
  id: item.id,
  name: item.name || undefined,
  dataUrl: item.imageUrl,
  mimeType: item.mimeType,
  width: item.width || 0,
  height: item.height || 0,
  prompt: item.prompt || '',
  createdAt: new Date(item.createdAt).getTime(),
  mediaType: (item.mediaType as 'image' | 'video') || 'image',
});

export const loadGenerationHistory = (): GenerationHistoryItem[] => [];

export const saveGenerationHistory = (_items: GenerationHistoryItem[]) => {};

export const loadGenerationHistoryAsync = async (): Promise<GenerationHistoryItem[]> => {
  try {
    const items = await historyApi.list();
    return items.map(toLocal);
  } catch {
    return [];
  }
};

export const saveGenerationHistoryAsync = async (_items: GenerationHistoryItem[]) => {};

export const saveHistoryItemToServer = async (item: GenerationHistoryItem): Promise<void> => {
  try {
    await historyApi.add({
      id: item.id,
      name: item.name,
      imageUrl: item.dataUrl,
      mimeType: item.mimeType,
      width: item.width,
      height: item.height,
      prompt: item.prompt,
      mediaType: item.mediaType,
    });
  } catch (err) {
    console.error('[History] Failed to save to server', err);
  }
};

export const createThumbnailDataUrl = (
  dataUrl: string,
  maxDim: number = THUMBNAIL_MAX_DIM,
): Promise<string> => {
  return new Promise((resolve) => {
    if (dataUrl.length < 8000 || dataUrl.startsWith('http')) { resolve(dataUrl); return; }
    const img = new Image();
    img.onload = () => {
      const { width: ow, height: oh } = img;
      if (ow <= maxDim && oh <= maxDim) { resolve(dataUrl); return; }
      const scale = Math.min(maxDim / ow, maxDim / oh);
      const nw = Math.round(ow * scale);
      const nh = Math.round(oh * scale);
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, nw, nh);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const addGenerationHistoryItem = (
  items: GenerationHistoryItem[],
  item: GenerationHistoryItem,
): GenerationHistoryItem[] => {
  return [item, ...items.filter(existing => existing.id !== item.id)].slice(0, MAX_HISTORY_ITEMS);
};
