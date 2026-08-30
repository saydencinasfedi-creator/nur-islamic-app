import React, { useEffect, useRef, useState } from 'react';
import { pushBackHandler } from '../services/backHandlerStack';
import { useUser } from '../contexts/UserContext';

interface IconPickerSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (icon: string) => void;
    onSelectImage: (dataUrl: string) => void;
    selected?: string;
}

// Large curated set of Material Symbols Outlined names, grouped by theme (no section
// labels shown — order alone groups them). The app already loads the full font
// (index.html), but bundling the entire ~2500-icon catalog isn't practical/reliable
// without official metadata to verify names against, so this list is a big but finite
// browsable set; the free-text search above still covers anything beyond it.
// `favorite_border` was intentionally left out: in the outlined font it renders
// identically to unfilled `favorite`, a true duplicate rather than just a similar icon.
// Each group also carries a few topic keywords, so searching e.g. "quran" or "fitness"
// surfaces the whole related group even when it isn't a literal icon-name substring.
interface IconGroup {
    keywords: string[];
    icons: string[];
}

const ICON_GROUPS: IconGroup[] = [
    {
        keywords: ['reading', 'read', 'quran', 'book', 'study', 'knowledge', 'education', 'learn'],
        icons: ['menu_book', 'auto_stories', 'import_contacts', 'book_5', 'school', 'translate',
            'library_books', 'local_library', 'history_edu', 'article', 'description',
            'bookmark', 'bookmarks', 'edit_note', 'draw'],
    },
    {
        keywords: ['prayer', 'pray', 'salah', 'worship', 'reflection', 'mindfulness', 'meditate', 'meditation', 'dhikr'],
        icons: ['mosque', 'self_improvement', 'psychology', 'spa', 'pan_tool', 'favorite',
            'church', 'temple_buddhist', 'synagogue', 'diversity_1', 'diversity_2'],
    },
    {
        keywords: ['charity', 'donate', 'donation', 'giving', 'sadaqah', 'community', 'help', 'volunteer'],
        icons: ['volunteer_activism', 'savings', 'redeem', 'diversity_3', 'groups', 'home',
            'handshake', 'family_restroom', 'child_care', 'elderly', 'accessible'],
    },
    {
        keywords: ['food', 'eat', 'eating', 'fasting', 'fast', 'diet', 'nutrition', 'water', 'drink'],
        icons: ['water_drop', 'restaurant', 'nutrition', 'eco', 'local_dining', 'lunch_dining',
            'dinner_dining', 'bakery_dining', 'local_cafe', 'icecream', 'cake', 'egg',
            'set_meal', 'ramen_dining'],
    },
    {
        keywords: ['time', 'schedule', 'night', 'day', 'sun', 'moon', 'calendar', 'clock'],
        icons: ['nights_stay', 'bedtime', 'nightlight', 'wb_twilight', 'wb_sunny', 'dark_mode',
            'light_mode', 'schedule', 'alarm', 'timer', 'event', 'calendar_month',
            'hourglass_top', 'hourglass_bottom', 'update', 'history', 'watch_later',
            'today', 'date_range'],
    },
    {
        keywords: ['goal', 'habit', 'achievement', 'streak', 'task', 'progress'],
        icons: ['check_circle', 'task_alt', 'flag', 'emoji_events', 'military_tech', 'star',
            'star_half', 'workspace_premium', 'verified', 'grade', 'checklist'],
    },
    {
        keywords: ['fitness', 'exercise', 'health', 'sport', 'workout', 'gym', 'medical'],
        icons: ['fitness_center', 'directions_walk', 'directions_run', 'sports_gymnastics',
            'sports_soccer', 'sports_basketball', 'sports_tennis', 'hiking', 'pool',
            'sports_martial_arts', 'monitor_weight', 'bloodtype', 'medication', 'healing',
            'medical_services', 'vaccines'],
    },
    {
        keywords: ['nature', 'weather', 'outdoor', 'environment', 'rain', 'sky'],
        icons: ['park', 'forest', 'grass', 'nature', 'nature_people', 'water', 'waves',
            'terrain', 'landscape', 'air', 'cloud', 'thunderstorm', 'ac_unit', 'wb_cloudy',
            'filter_drama', 'sunny', 'rainy'],
    },
    {
        keywords: ['animal', 'pet'],
        icons: ['pets', 'cruelty_free'],
    },
    {
        keywords: ['tech', 'technology', 'phone', 'device', 'screen', 'screentime'],
        icons: ['smartphone', 'laptop', 'tablet_mac', 'computer', 'headphones', 'mic', 'camera',
            'videocam', 'tv', 'speaker', 'watch', 'keyboard', 'print', 'wifi', 'bluetooth'],
    },
    {
        keywords: ['home', 'house'],
        icons: ['cottage', 'apartment', 'cabin', 'garage', 'yard', 'deck', 'chair', 'bed',
            'kitchen', 'bathtub', 'door_front', 'window', 'roofing'],
    },
    {
        keywords: ['travel', 'transport', 'car', 'trip', 'commute'],
        icons: ['directions_car', 'directions_bus', 'directions_bike', 'directions_boat',
            'flight', 'train', 'subway', 'local_taxi', 'electric_car', 'sailing',
            'rocket_launch', 'airport_shuttle', 'luggage', 'backpack', 'map', 'explore',
            'public', 'language', 'flight_takeoff', 'hotel', 'beach_access'],
    },
    {
        keywords: ['emotion', 'mood', 'feeling', 'people', 'person'],
        icons: ['sentiment_satisfied', 'sentiment_very_satisfied', 'sentiment_dissatisfied',
            'mood', 'mood_bad', 'face', 'person', 'group'],
    },
    {
        keywords: ['shape'],
        icons: ['circle', 'square', 'hexagon', 'pentagon', 'bolt', 'whatshot',
            'local_fire_department'],
    },
    {
        keywords: ['tool', 'fix', 'repair', 'build'],
        icons: ['build', 'construction', 'handyman', 'plumbing', 'carpenter', 'hardware',
            'settings', 'tune', 'straighten'],
    },
    {
        keywords: ['money', 'finance', 'budget', 'saving', 'savings'],
        icons: ['payments', 'account_balance', 'wallet', 'credit_card', 'attach_money', 'paid',
            'currency_exchange', 'receipt'],
    },
    {
        keywords: ['communication', 'talk', 'call', 'message', 'chat'],
        icons: ['chat', 'mail', 'forum', 'campaign', 'record_voice_over', 'headset_mic',
            'contact_phone', 'sms', 'notifications'],
    },
    {
        keywords: ['security', 'privacy', 'safety'],
        icons: ['shield', 'lock', 'verified_user', 'security', 'key', 'fingerprint', 'gpp_good'],
    },
    {
        keywords: ['misc'],
        icons: ['lightbulb', 'local_florist', 'thumb_up', 'volume_up'],
    },
];

const ICONS: string[] = ICON_GROUPS.flatMap(g => g.icons);

const IconPickerSheet: React.FC<IconPickerSheetProps> = ({ isOpen, onClose, onSelect, onSelectImage, selected }) => {
    const { t } = useUser();
    const [query, setQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        return pushBackHandler(() => {
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    if (!isOpen) return null;

    const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, '_');
    const topicQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
        ? (() => {
            const literalMatches = ICONS.filter(i => i.includes(normalizedQuery));
            const topicMatches = ICON_GROUPS
                .filter(g => g.keywords.some(kw => kw.includes(topicQuery) || topicQuery.includes(kw)))
                .flatMap(g => g.icons);
            return Array.from(new Set([...literalMatches, ...topicMatches]));
        })()
        : ICONS;
    const exactMatch = ICONS.includes(normalizedQuery);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            onSelectImage(reader.result as string);
            onClose();
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('iconPickerSheet.title')}</h2>
                    <button onClick={onClose} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                </div>

                <div className="flex items-center gap-2 mb-4 shrink-0">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-lg">search</span>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('iconPickerSheet.searchPlaceholder')}
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary py-2.5 pl-10 pr-3 text-sm"
                        />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title={t('iconPickerSheet.uploadOwnPhoto')}
                        className="size-11 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">add_a_photo</span>
                    </button>
                </div>

                <div className="overflow-y-auto no-scrollbar space-y-3 pb-2">
                    {normalizedQuery && !exactMatch && (
                        <button
                            onClick={() => { onSelect(normalizedQuery); onClose(); }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-left hover:bg-primary/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl text-primary">{normalizedQuery}</span>
                            <span className="text-sm text-slate-900 dark:text-white">
                                {t('iconPickerSheet.useIconPrefix')} "<span className="font-mono">{normalizedQuery}</span>"
                                <span className="block text-[10px] text-gray-500 dark:text-gray-400">{t('iconPickerSheet.invalidIconHint')}</span>
                            </span>
                        </button>
                    )}
                    <div className="grid grid-cols-5 gap-3">
                        {filtered.map(icon => (
                            <button
                                key={icon}
                                onClick={() => { onSelect(icon); onClose(); }}
                                className={`size-14 rounded-2xl flex items-center justify-center border transition-colors ${selected === icon ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                            >
                                <span className="material-symbols-outlined text-2xl">{icon}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IconPickerSheet;
