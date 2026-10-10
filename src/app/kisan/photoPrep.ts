// Getting a phone photo ready to send (K7). Village data is slow, so a big photo is shrunk to 1600 px
// (what the agent keeps anyway) before upload. Photos already under 2 MB go as they are, which keeps
// their GPS for the agent to read; the agent strips it before storing.
export const SEND_AS_IS_BYTES = 2 * 1024 * 1024;
export const MAX_SIDE = 1600;
const THUMB_SIDE = 160;

/** Width and height that fit inside maxSide, keeping the shape. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function draw(file: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  return canvas;
}

/** The photo to upload. If the browser can't read it (some HEIC files), it goes as it is and the agent decides. */
export async function shrinkPhoto(file: File): Promise<{ blob: Blob; filename: string }> {
  if (file.size <= SEND_AS_IS_BYTES) return { blob: file, filename: file.name || 'photo.jpg' };
  try {
    const canvas = await draw(file, MAX_SIDE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) return { blob, filename: 'photo.jpg' };
  } catch {
    // fall through
  }
  return { blob: file, filename: file.name || 'photo.jpg' };
}

/** A small preview for the machine list. It stays on the phone; undefined if the browser can't draw it. */
export async function thumbnail(file: Blob): Promise<string | undefined> {
  try {
    return (await draw(file, THUMB_SIDE)).toDataURL('image/jpeg', 0.7);
  } catch {
    return undefined;
  }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
