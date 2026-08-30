// Shared Hijri (Islamic/Umm al-Qura) calendar formatting — uses the browser/JS Intl API's
// built-in islamic-umalqura calendar for the actual date math, no separate conversion
// library needed.
//
// Month *names* are hardcoded and mapped from a numeric month instead of asking Intl for
// `month: 'long'` directly — some Android WebView builds ship incomplete ICU locale data
// for non-Gregorian calendars, and were observed silently falling back to Gregorian month
// names (e.g. "March") while the day/year numbers were still correctly Hijri. Numeric
// month values are calendar arithmetic, not locale name-table lookups, so they aren't
// affected by that gap.
const HIJRI_MONTHS = [
    'Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani",
    'Jumada al-awwal', 'Jumada al-thani', 'Rajab', "Sha'ban",
    'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

const getHijriParts = (date: Date): { day: string; month: number; year: string } => {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return { day: get('day'), month: parseInt(get('month'), 10) || 1, year: get('year') };
};

export const formatHijriDate = (date: Date): string => {
    const { day, month, year } = getHijriParts(date);
    return `${day} ${HIJRI_MONTHS[month - 1]} ${year}`;
};

export const formatHijriDateWithWeekday = (date: Date): string => {
    // Day-of-week naming isn't calendar-specific, so a plain Gregorian-locale formatter
    // for just the weekday avoids depending on the same possibly-incomplete ICU data.
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    const { day, month, year } = getHijriParts(date);
    return `${weekday}, ${day} ${HIJRI_MONTHS[month - 1]} ${year}`;
};
