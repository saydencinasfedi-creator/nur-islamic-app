// Barrel: merges every per-page/component Spanish translation fragment. Must have exactly
// the same keys as locales/en/index.ts — TypeScript enforces this via TranslationKey.

import { adhanFormSheet } from './adhanFormSheet';
import { adhanSettings } from './adhanSettings';
import { aiCompanion } from './aiCompanion';
import { appearanceSettings } from './appearanceSettings';
import { auth } from './auth';
import { bottomNav } from './bottomNav';
import { common } from './common';
import { community } from './community';
import { contentAI } from './contentAI';
import { createAccount } from './createAccount';
import { dailyGoals } from './dailyGoals';
import { dashboard } from './dashboard';
import { dataPrivacy } from './dataPrivacy';
import { emailAuth } from './emailAuth';
import { goalFormSheet } from './goalFormSheet';
import { googleLogin } from './googleLogin';
import { helpCenter } from './helpCenter';
import { iconPickerSheet } from './iconPickerSheet';
import { languageSettings } from './languageSettings';
import { notifications } from './notifications';
import { onboarding } from './onboarding';
import { privateIdConfirmation } from './privateIdConfirmation';
import { profile } from './profile';
import { qibla } from './qibla';
import { quran } from './quran';
import { quranFullSurahs } from './quranFullSurahs';
import { recitationFormSheet } from './recitationFormSheet';
import { reflections } from './reflections';
import { salat } from './salat';
import { settings } from './settings';
import { supplications } from './supplications';
import { tasbih } from './tasbih';

export const es = {
    'common.appName': 'Nur',
    ...adhanFormSheet,
    ...adhanSettings,
    ...aiCompanion,
    ...appearanceSettings,
    ...auth,
    ...bottomNav,
    ...common,
    ...community,
    ...contentAI,
    ...createAccount,
    ...dailyGoals,
    ...dashboard,
    ...dataPrivacy,
    ...emailAuth,
    ...goalFormSheet,
    ...googleLogin,
    ...helpCenter,
    ...iconPickerSheet,
    ...languageSettings,
    ...notifications,
    ...onboarding,
    ...privateIdConfirmation,
    ...profile,
    ...qibla,
    ...quran,
    ...quranFullSurahs,
    ...recitationFormSheet,
    ...reflections,
    ...salat,
    ...settings,
    ...supplications,
    ...tasbih,
} as const;
