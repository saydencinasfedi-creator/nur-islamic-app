export interface DhikrText {
    name: string;
    translation: string;
    transliteration: string;
}

export const dhikrContentEn: Record<string, DhikrText> = {
    subhanAllah: { name: 'SubhanAllah', translation: 'Glory be to Allah', transliteration: 'SubhanAllah' },
    alhamdulillah: { name: 'Alhamdulillah', translation: 'Praise be to Allah', transliteration: 'Alhamdulillah' },
    allahuAkbar: { name: 'Allahu Akbar', translation: 'Allah is the Greatest', transliteration: 'Allahu Akbar' },
    astaghfirullah: { name: 'Astaghfirullah', translation: 'I seek forgiveness from Allah', transliteration: 'Astaghfirullah' },
    laIlahaIllallah: { name: 'La ilaha illallah', translation: 'There is no god but Allah', transliteration: 'La ilaha illallah' },
    salawat: { name: 'Allahumma salli ala Muhammad', translation: 'O Allah, send blessings upon Muhammad', transliteration: 'Allahumma salli ala Muhammad' },
};
