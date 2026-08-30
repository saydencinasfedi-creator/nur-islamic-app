// Verse-of-the-Day pool for the Dashboard — language-independent shape. `index` (ayah
// reference like "94:6", shown to the user — two verses can legitimately share one, see
// the two 11:114 entries below) and `surah` (the chapter's transliterated name, a proper
// noun kept the same across languages the way "Ramadan" or "Fajr" is) never change; only
// the verse's translated meaning does, looked up per-language from
// locales/content-{lang}/verses.ts by the unique `id`.
export interface VerseRef {
    id: string;
    index: string;
    surah: string;
}

export const VERSES: VerseRef[] = [
    { id: 'v01', index: '94:6', surah: 'Surah Al-Sharh' },
    { id: 'v02', index: '2:153', surah: 'Surah Al-Baqarah' },
    { id: 'v03', index: '40:60', surah: 'Surah Ghafir' },
    { id: 'v04', index: '93:7', surah: 'Surah Ad-Duhaa' },
    { id: 'v05', index: '2:286', surah: 'Surah Al-Baqarah' },
    { id: 'v06', index: '65:3', surah: 'Surah At-Talaq' },
    { id: 'v07', index: '7:156', surah: "Surah Al-A'raf" },
    { id: 'v08', index: '85:14', surah: 'Surah Al-Buruj' },
    { id: 'v09', index: '11:61', surah: 'Surah Hud' },
    { id: 'v10', index: '2:83', surah: 'Surah Al-Baqarah' },
    { id: 'v11', index: '49:13', surah: 'Surah Al-Hujurat' },
    { id: 'v12', index: '7:199', surah: "Surah Al-A'raf" },
    { id: 'v13', index: '39:53', surah: 'Surah Az-Zumar' },
    { id: 'v14', index: '24:35', surah: 'Surah An-Nur' },
    { id: 'v15', index: '21:107', surah: 'Surah Al-Anbya' },
    { id: 'v16', index: '57:4', surah: 'Surah Al-Hadid' },
    { id: 'v17', index: '33:3', surah: 'Surah Al-Ahzab' },
    { id: 'v18', index: '2:152', surah: 'Surah Al-Baqarah' },
    { id: 'v19', index: '14:7', surah: 'Surah Ibrahim' },
    { id: 'v20', index: '11:114', surah: 'Surah Hud' },
    { id: 'v21', index: '11:114', surah: 'Surah Hud' },
    { id: 'v22', index: '13:28', surah: 'Surah Ar-Rad' },
    { id: 'v23', index: '2:45', surah: 'Surah Al-Baqarah' },
    { id: 'v24', index: '3:147', surah: 'Surah Al-Imran' },
    { id: 'v25', index: '2:195', surah: 'Surah Al-Baqarah' },
];
