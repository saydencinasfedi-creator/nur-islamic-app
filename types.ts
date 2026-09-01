
export type PageId =
  | 'onboarding'
  | 'auth'
  | 'private-id'
  | 'dashboard'
  | 'salat'
  | 'tasbih'
  | 'qibla'
  | 'quran'
  | 'dua'
  | 'chat'
  | 'community'
  | 'profile'
  | 'settings'
  | 'appearance'
  | 'language'
  | 'data-privacy'
  | 'content-ai'
  | 'help-center'
  | 'email-login'
  | 'google-login'
  | 'create-account'
  | 'notifications'
  | 'daily-goals'
  | 'adhan-settings'
  | 'quran-full-surahs'
  | 'reflections'
  | 'profile-setup'
  | 'reset-password';

export interface Location {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string;
}

export interface User {
  name: string;
  memberSince: string;
  isPremium: boolean;
  privateId?: string;
  location?: Location;
  avatar?: string;
  // Supabase auth user id — the stable identity used by everything in Community.
  // Absent only on a build without Supabase configured.
  id?: string;
}

export interface Dhikr {
  name: string;
  arabic: string;
  transliteration: string;
  translation: string;
  recommended: number;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
export interface TasbihHistoryItem {
  id: string;
  dhikrName: string;
  count: number;
  timestamp: string;
}

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = typeof PRAYER_NAMES[number];

export type PrayerCompletionDay = { date: string } & Record<PrayerName, boolean>;

export interface PrayerHistoryEntry {
  date: string;
  allCompleted: boolean;
}

export type GoalType = 'boolean' | 'amount';

export interface Goal {
  id: string;
  label: string;
  icon: string;
  iconImage?: string; // data URL of a user-uploaded photo, takes precedence over `icon` when set
  type: GoalType;
  note?: string;
  target?: number; // amount-type only
  current: number; // 0/1 for boolean, 0..target for amount
  done: boolean;
}

export interface GoalsAggregate {
  days: number;
  sumPercent: number;
}

export interface AdhanSound {
  id: string;
  label: string;
  filePath: string; // relative path under Directory.Data, e.g. 'adhans/<uuid>.m4a'
  mimeType: string;
  uploadedAt: number;
}

export interface CustomRecitation {
  id: string;
  surahNumber: number;
  surahName: string;
  reciterName: string;
  filePath: string; // relative path under Directory.Data/recitations
  addedDate: number;
  pinned: boolean; // shown on the Full Surahs main screen when true; otherwise only in "See all"
}

export type NotificationType = 'prayer' | 'goal' | 'streak' | 'community';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

export interface NotifSettings {
  prayerTimes: boolean;
  dailyGoalReminder: boolean;
  streakAchievements: boolean;
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string; // Arabic
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean;
  translation?: string; // English translation
  audio?: string; // Audio URL
}

// --- Reflections (personal Qur'an/topic journal) ---

// A pointer to a single ayah, embedded (structured, not a string) inside a Reflection.
// surahName is a snapshot of Surah.englishName so cards/detail never need a network call.
export interface QuranReference {
  surahNumber: number; // 1..114
  surahName: string; // e.g. "Al-Baqarah"
  ayahNumber: number; // numberInSurah, 1-based
  ayahText?: string; // translation snapshot, so it can be shown without a network call
}

export interface Reflection {
  id: string;
  title: string;
  content: string; // Markdown source
  quranRefs: QuranReference[];
  tagIds: string[]; // reference Tag.id in the global tags list
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

// Global, reused across reflections. Dedupe key is name.trim().toLowerCase().
export interface Tag {
  id: string;
  name: string;
}

// --- Community (groups) --- server-backed, mirrors the Supabase schema ---------

export type GroupCategory =
  | 'quran' | 'salah' | 'hadith' | 'ramadan' | 'self_dev' | 'brotherhood'
  | 'sisters' | 'memorization' | 'arabic' | 'general' | 'other';

export type GroupPrivacy = 'public' | 'private' | 'invite_only';
export type GroupGender = 'mixed' | 'brothers' | 'sisters';
export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member';
export type GroupMemberStatus = 'active' | 'pending' | 'banned' | 'muted';
export type AgeRange = 'teens' | '18-24' | '25-34' | '35+';
export type GroupAgeFocus = AgeRange | 'all';

export interface CommunityProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  ageRange?: AgeRange | null;
  languages: string[];
  interests: string[];
  isAnonymous: boolean;
}

export interface Group {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  category: GroupCategory;
  tags: string[];
  privacy: GroupPrivacy;
  groupGender: GroupGender;
  ageFocus?: GroupAgeFocus | null;
  primaryLanguage?: string | null;
  ownerId: string;
  memberCount: number;
  createdAt: string; // ISO
  archivedAt?: string | null;
  // Optional, admin-set: pinned at the top of this circle's chat.
  verseOfDay?: QuranReference | null;
  // Populated for the current viewer where known.
  myRole?: GroupRole | null;
  myStatus?: GroupMemberStatus | null;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joinedAt: string;
  mutedUntil?: string | null;
  profile?: CommunityProfile;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  authorId: string | null;
  body: string;
  replyTo?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author?: CommunityProfile;
}

// --- Direct messages (1:1) --------------------------------------------------
// Same shape as GroupMessage, scoped to a thread instead of a circle. No
// moderator concept — only the two participants can ever act on a thread.

export interface DMMessage {
  id: string;
  threadId: string;
  authorId: string | null;
  body: string;
  replyTo?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author?: CommunityProfile;
}

export interface DMThread {
  id: string;
  otherUserId: string;
  otherProfile?: CommunityProfile;
  lastMessageAt: string;
  lastMessagePreview?: string | null;
  lastMessageAuthorId?: string | null;
  isUnread: boolean;
}

export interface GroupReflection {
  id: string;
  groupId: string;
  authorId: string | null;
  title?: string | null;
  content: string;
  quranRefs: QuranReference[];
  tags: string[];
  sourceLocalId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  author?: CommunityProfile;
}

export interface GroupReflectionComment {
  id: string;
  reflectionId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  deletedAt?: string | null;
  author?: CommunityProfile;
}

export type ReactionEmoji = 'heart' | 'dua' | 'like';
export type ReactionEntityType = 'message' | 'reflection' | 'comment';

export interface CommunityReaction {
  entityType: ReactionEntityType;
  entityId: string;
  userId: string;
  emoji: ReactionEmoji;
}

export type ChallengeType = 'quran' | 'salah' | 'memorization' | 'dhikr' | 'custom';
export type ChallengeStatus = 'pending' | 'active' | 'rejected' | 'archived';
export type ChallengeNotifyFrequency = 'none' | 'daily' | 'fridays';

export interface GroupChallenge {
  id: string;
  groupId: string | null; // null => a global (community-wide) challenge
  creatorId: string | null;
  title: string;
  description?: string | null;
  type: ChallengeType;
  icon?: string | null; // Material Symbols name
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
  durationDays?: number | null;
  status: ChallengeStatus;
  notifyFrequency: ChallengeNotifyFrequency;
  notifyAt?: string | null; // 'HH:MM' local wall-clock
  goalTotal?: number | null;
  dailyGoal?: number | null;
  archivedAt?: string | null;
  // Populated for the current viewer where known.
  groupName?: string | null;
  myParticipation?: { joined: boolean; completedToday: boolean; shareDetail: boolean; progressCount?: number | null } | null;
}

// From the challenge_participants_public view — detail fields are null unless the
// participant opted to share or it is the viewer's own row (spec §13).
export interface ChallengeParticipant {
  challengeId: string;
  userId: string;
  joinedAt: string;
  shareDetail: boolean;
  completedToday: boolean;
  progressCount?: number | null;
  lastProgressOn?: string | null;
  profile?: CommunityProfile;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  code: string;
  createdBy?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  maxUses?: number | null;
  useCount: number;
  revokedAt?: string | null;
}

export type ReportEntityType = 'message' | 'reflection' | 'comment' | 'group' | 'user' | 'dua_request' | 'challenge';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'hate' | 'misinfo' | 'other';

export interface CommunityReport {
  id: string;
  reporterId: string;
  entityType: ReportEntityType;
  entityId: string;
  groupId?: string | null;
  reason: ReportReason;
  detail?: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
}

export type CommunityNotificationType =
  | 'invite' | 'join_request' | 'join_approved' | 'message' | 'mention'
  | 'challenge_starting' | 'challenge_reminder' | 'reflection_reaction';

export interface CommunityNotification {
  id: string;
  userId: string;
  type: CommunityNotificationType;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface GroupDiscoveryFilters {
  query?: string;
  category?: GroupCategory | null;
  gender?: GroupGender | null;
  language?: string | null;
  ageFocus?: GroupAgeFocus | null;
  sort?: 'active' | 'new' | 'members';
}

export interface GlobalSalawat {
  totalCount: number;
  todayCount: number;
  todayDate: string; // YYYY-MM-DD
}

export interface DuaRequest {
  id: string;
  authorId: string | null;
  body: string;
  isAnonymous: boolean;
  ameenCount: number;
  createdAt: string;
  // Populated for the current viewer.
  iSaidAmeen?: boolean;
  author?: CommunityProfile;
}
