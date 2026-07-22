import type { FileUIPart } from 'ai';

export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

export type AttachedImage = FileUIPart;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Nie udało się wczytać pliku.'));
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Akceptuję tylko PNG, JPG, GIF i WEBP.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Max 4MB. Zrób screenshot fragmentu.';
  }
  return null;
}

export async function fileToAttachedImage(file: File): Promise<AttachedImage> {
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const url = await readFileAsDataUrl(file);
  return {
    type: 'file',
    filename: file.name || 'screenshot.png',
    mediaType: file.type,
    url,
  };
}

export async function clipboardItemToAttachedImage(
  item: DataTransferItem,
): Promise<AttachedImage | null> {
  if (!item.type.startsWith('image/')) return null;

  const file = item.getAsFile();
  if (!file) return null;

  return fileToAttachedImage(file);
}

type ImagePart = {
  type: string;
  url?: string;
  mediaType?: string;
  filename?: string;
};

export function getImageParts(parts: ImagePart[]) {
  return parts.filter(
    (part) =>
      part.type === 'file' && part.mediaType?.startsWith('image/'),
  );
}

export function getImageUrlsFromParts(parts: ImagePart[]): string[] {
  return getImageParts(parts)
    .map((part) => part.url)
    .filter((url): url is string => Boolean(url));
}

export function getPrecedingUserImageUrls(
  messages: { role: string; parts: ImagePart[]; metadata?: unknown }[],
  assistantIndex: number,
): string[] {
  for (let i = assistantIndex - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'assistant') break;

    if (message.role === 'user') {
      const fromParts = getImageUrlsFromParts(message.parts);
      if (fromParts.length > 0) return fromParts;

      const metadata = message.metadata as { attachedImageUrl?: string } | undefined;
      if (metadata?.attachedImageUrl) return [metadata.attachedImageUrl];
      return [];
    }
  }

  return [];
}

export function userRequestedUploadedImageInPost(text: string): boolean {
  return /upload|załącz|dołącz|zdjęci|obraz|z tym|używając|przesłan|w poście|w post/i.test(
    text,
  );
}
