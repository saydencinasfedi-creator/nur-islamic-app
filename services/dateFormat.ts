import { Language } from './i18n';

// "27 August 2026" / "27 de agosto de 2026". Nur only ships en + es today; other
// languages fall back to en-GB (matches services/i18n.ts's wholesale-English fallback).
const DATE_LOCALE: Partial<Record<Language, string>> = {
    en: 'en-GB',
    es: 'es-ES',
};

export const formatGregorianDate = (date: Date, language: Language): string =>
    date.toLocaleDateString(DATE_LOCALE[language] ?? 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
