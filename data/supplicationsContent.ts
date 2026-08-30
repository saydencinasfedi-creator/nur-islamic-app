// Language-independent shape for Supplications: ids, Arabic text, transliteration, icon/color.
// The actual meaning (translation), topic titles, and citations live in
// locales/content-supplications-{lang}.ts, keyed by these same ids — see that file and
// pages/Supplications.tsx for how they're merged back together per the active language.

export type SupplicationCategoryKey =
    | 'morningEvening' | 'routine' | 'emotion' | 'sleep' | 'travel' | 'knowledge' | 'family' | 'worship';

export interface DuaShape {
    id: string;
    arabic: string;
    transliteration?: string;
}

export interface SupplicationTopicShape {
    id: string;
    categoryKey: SupplicationCategoryKey;
    icon: string;
    color: string; // Tailwind class, e.g. 'bg-blue-400'
    shadowColor: string; // e.g. 'shadow-[0_0_8px_rgba(...)]'
    duas: DuaShape[];
}

export const SUPPLICATIONS_SHAPE: SupplicationTopicShape[] = [
    {
        id: 'morning-adhkar', categoryKey: 'morningEvening', icon: 'wb_twilight', color: 'bg-orange-400',
        shadowColor: 'shadow-[0_0_8px_rgba(251,146,60,0.5)]',
        duas: [
            { id: 'morning-1', arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ' },
            { id: 'morning-2', arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ' },
        ],
    },
    {
        id: 'evening-adhkar', categoryKey: 'morningEvening', icon: 'nights_stay', color: 'bg-violet-400',
        shadowColor: 'shadow-[0_0_8px_rgba(167,139,250,0.5)]',
        duas: [
            { id: 'evening-1', arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ' },
        ],
    },
    {
        id: 'waking-up', categoryKey: 'routine', icon: 'wb_sunny', color: 'bg-amber-400',
        shadowColor: 'shadow-[0_0_8px_rgba(251,191,36,0.5)]',
        duas: [
            { id: 'wake-1', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ' },
            { id: 'wake-2', arabic: 'لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ' },
        ].map(({ id, arabic }) => ({ id, arabic })),
    },
    {
        id: 'restroom', categoryKey: 'routine', icon: 'water_drop', color: 'bg-cyan-400',
        shadowColor: 'shadow-[0_0_8px_rgba(34,211,238,0.5)]',
        duas: [
            { id: 'enter-toilet', arabic: 'بِسْمِ اللَّهِ اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ' },
            { id: 'leave-toilet', arabic: 'غُفْرَانَكَ' },
        ],
    },
    {
        id: 'clothes', categoryKey: 'routine', icon: 'checkroom', color: 'bg-pink-400',
        shadowColor: 'shadow-[0_0_8px_rgba(244,114,182,0.5)]',
        duas: [{ id: 'wearing', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي كَسَانِي هَذَا (الثَّوْبَ) وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ' }],
    },
    {
        id: 'before-eating', categoryKey: 'routine', icon: 'restaurant', color: 'bg-lime-400',
        shadowColor: 'shadow-[0_0_8px_rgba(163,230,53,0.5)]',
        duas: [{ id: 'before-eating-1', arabic: 'بِسْمِ اللَّهِ' }],
    },
    {
        id: 'after-eating', categoryKey: 'routine', icon: 'ramen_dining', color: 'bg-yellow-400',
        shadowColor: 'shadow-[0_0_8px_rgba(250,204,21,0.5)]',
        duas: [{ id: 'after-eating-1', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ' }],
    },
    {
        id: 'entering-home', categoryKey: 'routine', icon: 'home', color: 'bg-teal-400',
        shadowColor: 'shadow-[0_0_8px_rgba(45,212,191,0.5)]',
        duas: [{ id: 'entering-home-1', arabic: 'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَى اللَّهِ رَبِّنَا تَوَكَّلْنَا' }],
    },
    {
        id: 'entering-mosque', categoryKey: 'routine', icon: 'mosque', color: 'bg-emerald-500',
        shadowColor: 'shadow-[0_0_8px_rgba(16,185,129,0.5)]',
        duas: [
            { id: 'entering-mosque-1', arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ' },
            { id: 'leaving-mosque-1', arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ' },
        ],
    },
    {
        id: 'wudu', categoryKey: 'routine', icon: 'clean_hands', color: 'bg-sky-400',
        shadowColor: 'shadow-[0_0_8px_rgba(56,189,248,0.5)]',
        duas: [{ id: 'wudu-1', arabic: 'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ' }],
    },
    {
        id: 'rain', categoryKey: 'routine', icon: 'rainy', color: 'bg-blue-300',
        shadowColor: 'shadow-[0_0_8px_rgba(147,197,253,0.5)]',
        duas: [{ id: 'rain-1', arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا' }],
    },
    {
        id: 'after-adhan', categoryKey: 'routine', icon: 'campaign', color: 'bg-fuchsia-400',
        shadowColor: 'shadow-[0_0_8px_rgba(232,121,249,0.5)]',
        duas: [{ id: 'after-adhan-1', arabic: 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ' }],
    },
    {
        id: 'breaking-fast', categoryKey: 'routine', icon: 'restaurant_menu', color: 'bg-rose-400',
        shadowColor: 'shadow-[0_0_8px_rgba(251,113,133,0.5)]',
        duas: [{ id: 'breaking-fast-1', arabic: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ' }],
    },
    {
        id: 'sleeping', categoryKey: 'sleep', icon: 'bedtime', color: 'bg-indigo-400',
        shadowColor: 'shadow-[0_0_8px_rgba(129,140,248,0.5)]',
        duas: [
            { id: 'sleep-1', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا' },
            { id: 'sleep-2', arabic: 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ' },
            { id: 'sleep-3', arabic: 'سُبْحَانَ اللَّهِ (33) وَالْحَمْدُ لِلَّهِ (33) وَاللَّهُ أَكْبَرُ (34)' },
        ],
    },
    {
        id: 'anxiety', categoryKey: 'emotion', icon: 'sentiment_worried', color: 'bg-purple-400',
        shadowColor: 'shadow-[0_0_8px_rgba(192,132,252,0.5)]',
        duas: [{ id: 'anxiety-1', arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ' }],
    },
    {
        id: 'seeing-good', categoryKey: 'emotion', icon: 'sentiment_satisfied', color: 'bg-green-400',
        shadowColor: 'shadow-[0_0_8px_rgba(74,222,128,0.5)]',
        duas: [{ id: 'seeing-good-1', arabic: 'مَا شَاءَ اللَّهُ لَا قُوَّةَ إِلَّا بِاللَّهِ' }],
    },
    {
        id: 'anger', categoryKey: 'emotion', icon: 'mood_bad', color: 'bg-red-400',
        shadowColor: 'shadow-[0_0_8px_rgba(248,113,113,0.5)]',
        duas: [{ id: 'anger-1', arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ' }],
    },
    {
        id: 'visiting-sick', categoryKey: 'emotion', icon: 'volunteer_activism', color: 'bg-teal-300',
        shadowColor: 'shadow-[0_0_8px_rgba(94,234,212,0.5)]',
        duas: [{ id: 'visiting-sick-1', arabic: 'لَا بَأْسَ طَهُورٌ إِنْ شَاءَ اللَّهُ' }],
    },
    {
        id: 'protection', categoryKey: 'emotion', icon: 'shield', color: 'bg-slate-400',
        shadowColor: 'shadow-[0_0_8px_rgba(148,163,184,0.5)]',
        duas: [{ id: 'protection-1', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ' }],
    },
    {
        id: 'debt-relief', categoryKey: 'emotion', icon: 'payments', color: 'bg-amber-300',
        shadowColor: 'shadow-[0_0_8px_rgba(252,211,77,0.5)]',
        duas: [{ id: 'debt-relief-1', arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ' }],
    },
    {
        id: 'travel', categoryKey: 'travel', icon: 'flight', color: 'bg-emerald-400',
        shadowColor: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]',
        duas: [
            { id: 'travel-1', arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ' },
            { id: 'leave-home', arabic: 'بِسْمِ اللّٰهِ، تَوَكَّلْتُ عَلَى اللّٰهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ' },
        ],
    },
    {
        id: 'knowledge', categoryKey: 'knowledge', icon: 'school', color: 'bg-blue-400',
        shadowColor: 'shadow-[0_0_8px_rgba(96,165,250,0.5)]',
        duas: [
            { id: 'knowledge-1', arabic: 'رَّبِّ زِدْنِي عِلْمًا' },
            { id: 'knowledge-2', arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ' },
        ],
    },
    {
        id: 'parents', categoryKey: 'family', icon: 'family_restroom', color: 'bg-rose-300',
        shadowColor: 'shadow-[0_0_8px_rgba(253,164,175,0.5)]',
        duas: [{ id: 'parents-1', arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا' }],
    },
    {
        id: 'newlyweds', categoryKey: 'family', icon: 'favorite', color: 'bg-pink-300',
        shadowColor: 'shadow-[0_0_8px_rgba(249,168,212,0.5)]',
        duas: [{ id: 'newlyweds-1', arabic: 'بَارَكَ اللَّهُ لَكَ، وَبَارَكَ عَلَيْكَ، وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ' }],
    },
    {
        id: 'protecting-children', categoryKey: 'family', icon: 'child_care', color: 'bg-cyan-300',
        shadowColor: 'shadow-[0_0_8px_rgba(103,232,249,0.5)]',
        duas: [{ id: 'protecting-children-1', arabic: 'أُعِيذُكُمَا بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ' }],
    },
    {
        id: 'bad-dream', categoryKey: 'sleep', icon: 'dark_mode', color: 'bg-indigo-300',
        shadowColor: 'shadow-[0_0_8px_rgba(165,180,252,0.5)]',
        duas: [{ id: 'bad-dream-1', arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ، وَشَرِّ عِبَادِهِ، وَمِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَنْ يَحْضُرُونِ' }],
    },
    {
        id: 'ease-in-hardship', categoryKey: 'emotion', icon: 'spa', color: 'bg-emerald-300',
        shadowColor: 'shadow-[0_0_8px_rgba(110,231,183,0.5)]',
        duas: [{ id: 'ease-in-hardship-1', arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا' }],
    },
    {
        id: 'deceased', categoryKey: 'emotion', icon: 'local_florist', color: 'bg-stone-400',
        shadowColor: 'shadow-[0_0_8px_rgba(168,162,158,0.5)]',
        duas: [{ id: 'deceased-1', arabic: 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ وَعَافِهِ وَاعْفُ عَنْهُ' }],
    },
    {
        id: 'marketplace', categoryKey: 'routine', icon: 'storefront', color: 'bg-orange-300',
        shadowColor: 'shadow-[0_0_8px_rgba(253,186,116,0.5)]',
        duas: [{ id: 'marketplace-1', arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيتُ وَهُوَ حَيٌّ لَا يَمُوتُ بِيَدِهِ الْخَيْرُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ' }],
    },
    {
        id: 'istikhara', categoryKey: 'worship', icon: 'auto_awesome', color: 'bg-violet-300',
        shadowColor: 'shadow-[0_0_8px_rgba(196,181,253,0.5)]',
        duas: [{ id: 'istikhara-1', arabic: 'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ، فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ، وَتَعْلَمُ وَلَا أَعْلَمُ، وَأَنْتَ عَلَّامُ الْغُيُوبِ، اللَّهُمَّ إِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ خَيْرٌ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاقْدُرْهُ لِي وَيَسِّرْهُ لِي ثُمَّ بَارِكْ لِي فِيهِ، وَإِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ شَرٌّ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاصْرِفْهُ عَنِّي وَاصْرِفْنِي عَنْهُ، وَاقْدُرْ لِيَ الْخَيْرَ حَيْثُ كَانَ ثُمَّ أَرْضِنِي بِهِ' }],
    },
    {
        id: 'after-prayer', categoryKey: 'worship', icon: 'self_improvement', color: 'bg-teal-400',
        shadowColor: 'shadow-[0_0_8px_rgba(45,212,191,0.5)]',
        duas: [{ id: 'after-prayer-1', arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ' }],
    },
    {
        id: 'steadfastness', categoryKey: 'worship', icon: 'anchor', color: 'bg-blue-300',
        shadowColor: 'shadow-[0_0_8px_rgba(147,197,253,0.5)]',
        duas: [{ id: 'steadfastness-1', arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ' }],
    },
];

export const DUA_OF_THE_DAY_SHAPE: DuaShape = {
    id: 'dua-of-the-day',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
};
