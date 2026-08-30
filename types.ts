
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
  | 'reflections';

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

export type NotificationType = 'prayer' | 'goal' | 'streak';

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
