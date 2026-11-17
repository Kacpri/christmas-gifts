export const CHAT_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export const CHAT_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const chatPhotoUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-photos/${path}`;
