import { en } from '../locales/en';
import { es } from '../locales/es';

// Source of truth for every valid translation key — every other locale is typed against
// this, so a missing key in any locale file is a compile error, not a silent blank/English
// leak discovered at runtime.
export type TranslationKey = keyof typeof en;

export type Language = 'en' | 'es' | 'fr' | 'tr' | 'id' | 'ms' | 'ar' | 'ur';

export const RTL_LANGUAGES: ReadonlySet<Language> = new Set(['ar', 'ur']);

// Languages not yet translated (see the phased rollout in the translation plan) fall back to
// English wholesale — swapped for a real locale file as each one lands, no other code changes.
const LOCALES: Record<Language, Partial<Record<TranslationKey, string>>> = {
    en,
    es,
    fr: en,
    tr: en,
    id: en,
    ms: en,
    ar: en,
    ur: en,
};

// Fallback chain: requested language -> English -> the raw key itself (so a genuinely missing
// translation is visibly wrong in the UI — "supplications.title" instead of blank — rather than
// silently empty, which would be much harder to notice while translating new languages).
export const translate = (
    key: TranslationKey,
    language: Language,
    params?: Record<string, string | number>
): string => {
    let str = LOCALES[language]?.[key] ?? LOCALES.en[key] ?? key;
    if (params) {
        for (const [paramKey, value] of Object.entries(params)) {
            str = str.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(value));
        }
    }
    return str;
};
