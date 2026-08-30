// Language-independent shape of the built-in dhikrs shown in the Tasbih counter — Arabic
// text and recommended count never change per language; only the transliterated `name` and
// the English-meaning `translation` do (see locales/content-dhikr-{lang}.ts).
export interface DhikrContentItem {
    id: string;
    arabic: string;
    recommended: number;
}

export const DEFAULT_DHIKR_CONTENT: DhikrContentItem[] = [
    { id: 'subhanAllah', arabic: 'سُبْحَانَ ٱللَّٰهِ', recommended: 33 },
    { id: 'alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّٰهِ', recommended: 33 },
    { id: 'allahuAkbar', arabic: 'ٱللَّٰهُ أَكْبَرُ', recommended: 34 },
    { id: 'astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', recommended: 100 },
    { id: 'laIlahaIllallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', recommended: 100 },
    { id: 'salawat', arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', recommended: 100 },
];

// The migration in Tasbih.tsx (adding Salawat to phones that already had customDhikrs saved
// before it existed) matches on this id.
export const SALAWAT_DHIKR_ID = 'salawat';
