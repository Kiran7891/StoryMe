import type {
  CreateCharacterInput,
  CreateComicInput,
  CreateCommentInput,
  CreateUploadInput,
  RegisterDeviceInput,
  RepostInput,
  ShareComicInput,
  UpdateProfileInput,
} from '@storyme/validation';
import { type ApiClientOptions, HttpCore } from './http.js';
import type {
  AdminMetrics,
  AdminUser,
  Character,
  Comic,
  Comment,
  ComicStatusResult,
  ComicWithPanels,
  CreateUploadResult,
  FeedItem,
  Me,
  Report,
} from './types.js';

const V = '/v1';

/**
 * Typed StoryMe API SDK shared by web, mobile, and admin. Wraps every endpoint in a
 * strongly-typed method; request bodies reuse the shared Zod-inferred input types.
 */
export class StoryMeClient {
  private readonly http: HttpCore;

  constructor(opts: ApiClientOptions) {
    this.http = new HttpCore(opts);
  }

  // --- Account ---
  getMe = () => this.http.request<Me>(`${V}/me`);
  updateMe = (body: UpdateProfileInput) => this.http.request<Me>(`${V}/me`, { method: 'PATCH', body });
  deleteAccount = () => this.http.request<{ status: string }>(`${V}/me`, { method: 'DELETE' });
  exportData = () => this.http.request<{ status: string }>(`${V}/me/export`);
  registerDevice = (body: RegisterDeviceInput) =>
    this.http.request<{ status: string }>(`${V}/me/devices`, { method: 'POST', body });

  // --- Uploads ---
  createUpload = (body: CreateUploadInput) =>
    this.http.request<CreateUploadResult>(`${V}/uploads`, { method: 'POST', body });
  completeUpload = (id: string) =>
    this.http.request<{ status: string; uploadId: string }>(`${V}/uploads/${id}/complete`, { method: 'POST' });

  // --- Characters ---
  listCharacters = () => this.http.request<Character[]>(`${V}/characters`);
  getCharacter = (id: string) => this.http.request<Character>(`${V}/characters/${id}`);
  createCharacter = (body: CreateCharacterInput) =>
    this.http.request<Character>(`${V}/characters`, { method: 'POST', body });
  deleteCharacter = (id: string) =>
    this.http.request<{ status: string }>(`${V}/characters/${id}`, { method: 'DELETE' });

  // --- Comics ---
  listComics = (query?: { limit?: number; cursor?: string }) =>
    this.http.request<Comic[]>(`${V}/comics`, { query });
  createComic = (body: CreateComicInput, idempotencyKey?: string) =>
    this.http.request<Comic>(`${V}/comics`, { method: 'POST', body, idempotencyKey });
  getComic = (id: string) => this.http.request<ComicWithPanels>(`${V}/comics/${id}`);
  getComicStatus = (id: string) => this.http.request<ComicStatusResult>(`${V}/comics/${id}/status`);
  shareComic = (id: string, body: ShareComicInput) =>
    this.http.request<{ id: string; isPublic: boolean; shareSlug: string | null }>(
      `${V}/comics/${id}/share`,
      { method: 'POST', body },
    );

  // --- Social ---
  feed = (query?: { limit?: number; cursor?: string }) => this.http.request<FeedItem[]>(`${V}/feed`, { query });
  discover = (query?: { limit?: number; cursor?: string }) =>
    this.http.request<FeedItem[]>(`${V}/discover`, { query });
  reels = (query?: { limit?: number; cursor?: string }) => this.http.request<FeedItem[]>(`${V}/reels`, { query });
  like = (comicId: string) => this.http.request<{ status: string }>(`${V}/comics/${comicId}/like`, { method: 'POST' });
  unlike = (comicId: string) =>
    this.http.request<{ status: string }>(`${V}/comics/${comicId}/like`, { method: 'DELETE' });
  listComments = (comicId: string, query?: { limit?: number }) =>
    this.http.request<Comment[]>(`${V}/comics/${comicId}/comments`, { query });
  addComment = (comicId: string, body: CreateCommentInput) =>
    this.http.request<Comment>(`${V}/comics/${comicId}/comments`, { method: 'POST', body });
  deleteComment = (id: string) =>
    this.http.request<{ status: string }>(`${V}/comments/${id}`, { method: 'DELETE' });
  repost = (comicId: string, body: RepostInput) =>
    this.http.request<{ status: string }>(`${V}/comics/${comicId}/repost`, { method: 'POST', body });
  recordView = (comicId: string) =>
    this.http.request<{ status: string }>(`${V}/comics/${comicId}/view`, { method: 'POST' });
  follow = (userId: string) => this.http.request<{ status: string }>(`${V}/users/${userId}/follow`, { method: 'POST' });
  unfollow = (userId: string) =>
    this.http.request<{ status: string }>(`${V}/users/${userId}/follow`, { method: 'DELETE' });

  // --- Public ---
  getPublicComic = (slug: string) => this.http.request<ComicWithPanels>(`${V}/public/comics/${slug}`);

  // --- Admin (requires admin role) ---
  admin = {
    listUsers: (query?: { limit?: number }) =>
      this.http.request<AdminUser[]>(`${V}/admin/users`, { query }),
    moderationQueue: (query?: { limit?: number }) =>
      this.http.request<Report[]>(`${V}/admin/comics`, { query }),
    moderateComic: (id: string, decision: 'approved' | 'rejected') =>
      this.http.request<{ id: string; moderation: string }>(`${V}/admin/comics/${id}/moderate`, {
        method: 'POST',
        body: { decision },
      }),
    grantCredits: (userId: string, amount: number, reason: string) =>
      this.http.request<{ status: string; amount: number }>(`${V}/admin/users/${userId}/credits`, {
        method: 'POST',
        body: { amount, reason },
      }),
    metrics: () => this.http.request<AdminMetrics>(`${V}/admin/metrics`),
  };
}

export type { ApiClientOptions };
