import type {
  ComicStatus,
  ComicStyle,
  SubscriptionPlan,
  UserRole,
} from '@storyme/shared-types';

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  handle: string | null;
  avatarKey: string | null;
  bio: string | null;
  role: UserRole;
  plan: SubscriptionPlan;
  entitlements: { monthlyComics: number; maxPanels: number; watermark: boolean; priority: boolean };
  credits: number;
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  kind: string;
  createdAt: string;
}

export interface Panel {
  id: string;
  index: number;
  scene: string | null;
  dialogue: Array<{ speaker?: string; text: string }>;
  imageKey: string | null;
  status: string;
}

export interface Comic {
  id: string;
  userId: string;
  characterId: string | null;
  title: string | null;
  prompt: string;
  style: ComicStyle;
  format: 'book' | 'reel';
  status: ComicStatus;
  panelCount: number;
  coverKey: string | null;
  videoKey: string | null;
  isPublic: boolean;
  shareSlug: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ComicWithPanels extends Comic {
  panels: Panel[];
  stats: { likeCount: number; commentCount: number; repostCount: number; viewCount: number } | null;
}

export interface ComicStatusResult {
  id: string;
  status: ComicStatus;
  progress: number;
  jobStatus: string | null;
}

export interface FeedItem {
  id: string;
  userId: string;
  title: string | null;
  style: ComicStyle;
  format: 'book' | 'reel';
  coverKey: string | null;
  videoKey: string | null;
  shareSlug: string | null;
  publishedAt: string | null;
  likeCount: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  userId: string;
  body: string;
  parentId: string | null;
  createdAt: string;
}

export interface CreateUploadResult {
  uploadId: string;
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface AdminUser {
  id: string;
  email: string;
  handle: string | null;
  role: UserRole;
  createdAt: string;
  deletedAt: string | null;
}

export interface Report {
  id: string;
  reporterId: string;
  comicId: string | null;
  commentId: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

export interface AdminMetrics {
  users: number;
  comics: number;
  openReports: number;
}
