
import { Surah, Ayah } from '../types';
import { Language } from './i18n';
import { SURAH_NAME_TRANSLATIONS_ES } from '../data/surahNames';

const BASE_URL = 'https://api.alquran.cloud/v1';

// alquran.cloud translation editions per app language. Languages without their own entry
// fall back to English (en.sahih), same fallback philosophy as the UI-chrome t() engine —
// swapped in as more are verified available/well-regarded. 'es.garcia' (Isa García) is the
// Spanish translation most commonly used/trusted in Muslim Spanish-speaking communities,
// rather than the academic/orientalist 'es.cortes'/'es.asad' editions the API also offers.
const TRANSLATION_EDITIONS: Partial<Record<Language, string>> = {
    en: 'en.sahih',
    es: 'es.garcia',
};
const DEFAULT_TRANSLATION_EDITION = TRANSLATION_EDITIONS.en!;

// `surah.englishNameTranslation` (the surah's meaning, e.g. "The Opening") always comes back
// in English from the API's `/surah` list endpoint regardless of the translation edition used
// elsewhere — there's no per-language variant of this endpoint, so this looks it up from the
// small static table above instead. `surah.englishName` (the transliterated Arabic title
// itself, e.g. "Al-Fatihah") is a proper noun and is never translated.
export const getSurahNameMeaning = (surah: Surah, language: Language): string => {
    if (language === 'es') return SURAH_NAME_TRANSLATIONS_ES[surah.number] ?? surah.englishNameTranslation;
    return surah.englishNameTranslation;
};

export interface Reciter {
    id: string; // e.g., 'ar.alafasy'
    name: string;
    subtext: string;
}

export const RECITERS: Reciter[] = [
    { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.abdullahbasfar', name: 'Abdullah Basfar', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.shaatree', name: 'Abu Bakr Ash-Shatri', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.ahmedajamy', name: 'Ahmed Al-Ajamy', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.lohaidan', name: 'Mohammed Al-Lohaidan', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.minshawi', name: 'Mohamed Siddiq Al-Minshawi', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.muhammadjibreel', name: 'Muhammad Jibreel', subtext: 'Hafs An Asim • Murattal' },
    { id: 'ar.yasseraldossari', name: 'Yasser Al-Dosari', subtext: 'Hafs An Asim • Murattal' },
].sort((a, b) => a.name.localeCompare(b.name));

// The 114-surah metadata list is canonical and immutable, but was re-fetched on every
// Qur'an screen mount. Cache it (memory + localStorage, 30-day TTL) so the index, the
// Reflections reference picker, and the "open in Qur'an" jump don't each hit the network.
// On a fetch failure any stale cached copy is still returned.
const SURAH_LIST_CACHE_KEY = 'quranSurahListCache_v1';
const SURAH_LIST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let surahListMemoryCache: Surah[] | null = null;

export const getAllSurahs = async (): Promise<Surah[]> => {
    if (surahListMemoryCache) return surahListMemoryCache;

    let stale: Surah[] | null = null;
    try {
        const raw = localStorage.getItem(SURAH_LIST_CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as { savedAt: number; data: Surah[] };
            if (Array.isArray(parsed.data) && parsed.data.length > 0) {
                stale = parsed.data;
                if (Date.now() - parsed.savedAt < SURAH_LIST_TTL_MS) {
                    surahListMemoryCache = parsed.data;
                    return parsed.data;
                }
            }
        }
    } catch { /* ignore corrupt cache */ }

    try {
        const response = await fetch(`${BASE_URL}/surah`);
        const data = await response.json();
        if (data.code === 200 && Array.isArray(data.data)) {
            surahListMemoryCache = data.data;
            try {
                localStorage.setItem(SURAH_LIST_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: data.data }));
            } catch { /* quota — non-fatal */ }
            return data.data;
        }
        return stale ?? [];
    } catch (error) {
        console.error("Error fetching surahs:", error);
        return stale ?? [];
    }
};

// Helper function to pad numbers with leading zeros
const pad = (num: number, size: number): string => {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
};

const RECITER_PATHS: Record<string, string> = {
    'ar.abdulbasitmurattal': 'Abdul_Basit_Murattal_192kbps',
    'ar.abdullahbasfar': 'Abdullah_Basfar_192kbps',
    'ar.shaatree': 'Abu_Bakr_Ash-Shaatree_128kbps',
    'ar.ahmedajamy': 'Ahmed_ibn_Ali_al-Ajamy_128kbps',
    'ar.hudhaify': 'Ali_Al-Hudhaify_128kbps',
    'ar.mahermuaiqly': 'MaherAlMuaiqly128kbps',
    'ar.husary': 'Husary_128kbps',
    'ar.alafasy': 'Alafasy_128kbps',
    'ar.minshawi': 'Minshawy_Murattal_128kbps',
    'ar.muhammadjibreel': 'Muhammad_Jibreel_128kbps',
    'ar.yasseraldossari': 'Yasser_Ad-Dussary_128kbps',
    'ar.sudais': 'Abdurrahmaan_As-Sudais_192kbps'
};

export const getSurahDetails = async (surahNumber: number, reciterId: string = 'ar.alafasy', language: Language = 'en'): Promise<{ arabic: Ayah[], translation: Ayah[], transliteration: Ayah[], audio: Ayah[] } | null> => {
    try {
        const audioPath = RECITER_PATHS[reciterId];
        const translationEdition = TRANSLATION_EDITIONS[language] ?? DEFAULT_TRANSLATION_EDITION;

        const fetchPromises = [
            fetch(`${BASE_URL}/surah/${surahNumber}/quran-uthmani`),
            fetch(`${BASE_URL}/surah/${surahNumber}/${translationEdition}`),
            // Transliteration is a Latin-script phonetic guide, not language-specific text —
            // there's no dedicated Spanish/French/etc. edition on this API, and a single
            // universal English-alphabet transliteration reads fine across Latin-alphabet
            // languages, so this stays fixed regardless of app language.
            fetch(`${BASE_URL}/surah/${surahNumber}/en.transliteration`),
        ];

        const responses = await Promise.all(fetchPromises);
        const arabicResponse = responses[0];
        const translationResponse = responses[1];
        const transliterationResponse = responses[2];

        const arabicData = await arabicResponse.json();
        const translationData = await translationResponse.json();
        const transliterationData = await transliterationResponse.json();

        if (arabicData.code === 200 && translationData.code === 200) {
            let audioAyahs: Ayah[] = [];

            if (audioPath) {
                // Construct EveryAyah URLs
                audioAyahs = arabicData.data.ayahs.map((ayah: Ayah) => ({
                    ...ayah,
                    audio: `https://everyayah.com/data/${audioPath}/${pad(surahNumber, 3)}${pad(ayah.numberInSurah, 3)}.mp3`
                }));
            } else {
                // Fallback or empty if unknown reciter
                audioAyahs = new Array(arabicData.data.ayahs.length).fill({ audio: '' });
            }

            return {
                arabic: arabicData.data.ayahs,
                translation: translationData.data.ayahs,
                transliteration: transliterationData.code === 200 ? transliterationData.data.ayahs : [],
                audio: audioAyahs
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching surah details:", error);
        return null;
    }
};

// Just the translated text of every ayah in a surah — one lightweight request, no Arabic
// / transliteration / audio. Used by the Reflections reference picker (so you can read
// what each ayah says while choosing) and to hydrate a saved reference for display.
// Memory-cached per surah+edition for the session (ayah text is immutable).
const ayahTranslationCache = new Map<string, { numberInSurah: number; text: string }[]>();

export const getAyahTranslations = async (
    surahNumber: number,
    language: Language = 'en'
): Promise<{ numberInSurah: number; text: string }[]> => {
    const edition = TRANSLATION_EDITIONS[language] ?? DEFAULT_TRANSLATION_EDITION;
    const key = `${surahNumber}:${edition}`;
    const cached = ayahTranslationCache.get(key);
    if (cached) return cached;
    try {
        const res = await fetch(`${BASE_URL}/surah/${surahNumber}/${edition}`);
        const data = await res.json();
        if (data.code === 200 && Array.isArray(data.data?.ayahs)) {
            const list = data.data.ayahs.map((a: any) => ({ numberInSurah: a.numberInSurah, text: a.text }));
            ayahTranslationCache.set(key, list);
            return list;
        }
        return [];
    } catch (error) {
        console.error("Error fetching ayah translations:", error);
        return [];
    }
};

export const getAyahText = async (surahNumber: number, ayahNumber: number, language: Language = 'en'): Promise<string | undefined> => {
    const list = await getAyahTranslations(surahNumber, language);
    return list.find(a => a.numberInSurah === ayahNumber)?.text;
};

// mp3quran.net hosts one continuous audio file per surah per reciter (as opposed to
// everyayah.com above, which only has per-ayah files) — used for "listen to the full
// surah as a single track" instead of a gapless-but-still-separate ayah queue.
interface Mp3QuranMoshaf {
    id: number;
    name: string;
    rewaya_id: number;
    server: string;
    surah_total: number;
    surah_list: string;
}
interface Mp3QuranReciter {
    id: number;
    name: string;
    moshaf: Mp3QuranMoshaf[];
}

// Maps our existing alquran.cloud reciter ids to their mp3quran.net numeric reciter id.
// Matching by id (rather than fuzzy name substrings) matters here: mp3quran.net spells
// several of these names differently than we'd guess (e.g. "Alafasi" not "Alafasy",
// "Alhuthaifi" not "Hudhaify", "Basfer" not "Basfar"), and some names collide with a
// *different* reciter who happens to share a substring (e.g. "Yasser Al-Dosari" vs.
// "Ibrahim Aldosari" vs. "Sami Al-Dosari" — a naive substring match can silently lock
// onto the wrong person's audio). Every id below was verified directly against the
// live API response.
const MP3QURAN_RECITER_IDS: Record<string, number> = {
    'ar.abdulbasitmurattal': 51,
    'ar.abdullahbasfar': 60,
    'ar.shaatree': 4,
    'ar.ahmedajamy': 5,
    'ar.hudhaify': 74,
    'ar.lohaidan': 107,
    'ar.mahermuaiqly': 102,
    'ar.husary': 118,
    'ar.alafasy': 123,
    'ar.minshawi': 112,
    'ar.muhammadjibreel': 111,
    'ar.yasseraldossari': 92,
};

let mp3QuranRecitersCache: Mp3QuranReciter[] | null = null;
const MP3QURAN_CACHE_KEY = 'mp3QuranRecitersCache_v1';
const MP3QURAN_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const fetchMp3QuranReciters = async (): Promise<Mp3QuranReciter[]> => {
    if (mp3QuranRecitersCache) return mp3QuranRecitersCache;
    try {
        const cached = localStorage.getItem(MP3QURAN_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.data && Date.now() - parsed.savedAt < MP3QURAN_CACHE_TTL) {
                mp3QuranRecitersCache = parsed.data;
                return parsed.data;
            }
        }
    } catch { }

    const response = await fetch('https://mp3quran.net/api/v3/reciters?language=eng&rewaya=1');
    const data = await response.json();
    const reciters: Mp3QuranReciter[] = data.reciters ?? [];
    mp3QuranRecitersCache = reciters;
    try {
        localStorage.setItem(MP3QURAN_CACHE_KEY, JSON.stringify({ data: reciters, savedAt: Date.now() }));
    } catch { }
    return reciters;
};

// Returns a single playable URL for the whole surah (start to finish, one file) for the
// given reciter, or null if that reciter isn't available on mp3quran.net or doesn't have
// this particular surah recorded.
export const getFullSurahAudioUrl = async (surahNumber: number, reciterId: string): Promise<string | null> => {
    const mp3QuranId = MP3QURAN_RECITER_IDS[reciterId];
    if (mp3QuranId === undefined) return null;
    try {
        const reciters = await fetchMp3QuranReciters();
        const match = reciters.find(r => r.id === mp3QuranId);
        if (!match) return null;

        // A reciter can have more than one moshaf tagged as Hafs Murattal (e.g. a
        // historical partial recording alongside the full one) — prefer whichever
        // actually covers the most surahs.
        const rewayaMoshafs = match.moshaf.filter(m => m.rewaya_id === 1);
        const moshaf = rewayaMoshafs.sort((a, b) => b.surah_total - a.surah_total)[0] ?? match.moshaf[0];
        if (!moshaf) return null;

        const surahList = moshaf.surah_list.split(',').map(s => s.trim());
        if (!surahList.includes(String(surahNumber))) return null;

        return `${moshaf.server}${pad(surahNumber, 3)}.mp3`;
    } catch (error) {
        console.error("Error fetching full surah audio url:", error);
        return null;
    }
};

export const getSurahTafsir = async (surahNumber: number, edition: string = 'en.yusufali'): Promise<Ayah[] | null> => {
    try {
        const response = await fetch(`${BASE_URL}/surah/${surahNumber}/${edition}`);
        const data = await response.json();
        if (data.code === 200) {
            return data.data.ayahs;
        }
        return null;
    } catch (error) {
        console.error("Error fetching tafsir:", error);
        return null;
    }
};
