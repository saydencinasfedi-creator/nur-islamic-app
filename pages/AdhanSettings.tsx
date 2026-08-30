
import React, { useState, useRef, useEffect } from 'react';
import { AdhanSound, PRAYER_NAMES } from '../types';
import { useUser } from '../contexts/UserContext';
import AdhanFormSheet from '../components/AdhanFormSheet';
import { saveAudioFile, getPlayableUrl } from '../services/fileStorage';
import { pushBackHandler } from '../services/backHandlerStack';
import { boostMediaVolume, restoreMediaVolume } from '../services/adhanAlarm';

interface AdhanSettingsProps {
    onBack: () => void;
}

// Opened as a full-screen overlay directly from Dashboard's 3-dot menu (not a routed page —
// see App.tsx history), so the hardware back button needs to be claimed here instead of
// relying on App.tsx's PARENT_PAGE map.
const AdhanSettings: React.FC<AdhanSettingsProps> = ({ onBack }) => {
    const {
        adhanSounds, activeAdhanId, addAdhanSound, renameAdhanSound, deleteAdhanSound, setActiveAdhanId,
        adhanVolumePercent, setAdhanVolumePercent, adhanPrayerEnabled, updateAdhanPrayerEnabled,
        flipToStopAdhan, setFlipToStopAdhan, t,
    } = useUser();

    useEffect(() => {
        return pushBackHandler(() => {
            onBack();
            return true;
        });
    }, [onBack]);

    const [showForm, setShowForm] = useState(false);
    const [editingSound, setEditingSound] = useState<AdhanSound | null>(null);
    const [saving, setSaving] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Keep an in-progress preview in sync if the user drags the volume slider while it's
    // playing — both the element's own gain AND the underlying Media stream ceiling, since
    // raising the former can't exceed whatever the latter was last boosted to.
    useEffect(() => {
        if (!playingId) return;
        if (audioRef.current) audioRef.current.volume = adhanVolumePercent / 100;
        boostMediaVolume(adhanVolumePercent);
    }, [adhanVolumePercent, playingId]);

    // Restore the Media volume if this screen closes mid-preview instead of leaving it boosted.
    useEffect(() => {
        return () => { restoreMediaVolume(); };
    }, []);

    const openAdd = () => { setEditingSound(null); setShowForm(true); };
    const openEdit = (s: AdhanSound) => { setEditingSound(s); setShowForm(true); };

    const handleSave = async (data: { label: string; file: File | null }) => {
        setSaving(true);
        try {
            if (editingSound) {
                if (data.file) {
                    const filePath = await saveAudioFile(data.file, 'adhans');
                    deleteAdhanSound(editingSound.id);
                    addAdhanSound({ label: data.label, filePath, mimeType: data.file.type });
                } else {
                    renameAdhanSound(editingSound.id, data.label);
                }
            } else if (data.file) {
                const filePath = await saveAudioFile(data.file, 'adhans');
                addAdhanSound({ label: data.label, filePath, mimeType: data.file.type });
            }
            setShowForm(false);
            setEditingSound(null);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (editingSound) {
            if (playingId === editingSound.id) {
                audioRef.current?.pause();
                setPlayingId(null);
                restoreMediaVolume();
            }
            deleteAdhanSound(editingSound.id);
        }
        setShowForm(false);
        setEditingSound(null);
    };

    const togglePreview = async (sound: AdhanSound) => {
        if (playingId === sound.id) {
            audioRef.current?.pause();
            setPlayingId(null);
            restoreMediaVolume();
            return;
        }
        const url = await getPlayableUrl(sound.filePath);
        if (audioRef.current) {
            // A web <audio> element always plays on the Media stream, which caps out at
            // whatever the system's current Media volume is — same as the real adhan alarm,
            // this briefly raises that stream to the chosen % so the preview actually matches
            // Adhan Volume instead of silently deferring to Media volume.
            await boostMediaVolume(adhanVolumePercent);
            audioRef.current.src = url;
            audioRef.current.volume = adhanVolumePercent / 100;
            audioRef.current.play().catch(() => { });
            setPlayingId(sound.id);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            <header className="flex items-center gap-4 p-6 pb-4 bg-background-light dark:bg-background-dark z-10">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <h1 className="text-2xl font-bold tracking-tight flex-1">{t('adhanSettings.title')}</h1>
                <button
                    onClick={openAdd}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">add</span>
                </button>
            </header>

            <audio ref={audioRef} onEnded={() => { setPlayingId(null); restoreMediaVolume(); }} className="hidden" />

            <div className="p-6 pt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {t('adhanSettings.uploadExplanation')}
                </p>

                <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">{t('adhanSettings.volume')}</h3>
                        <span className="text-sm font-semibold text-primary">{adhanVolumePercent}%</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={adhanVolumePercent}
                        onChange={(e) => setAdhanVolumePercent(parseInt(e.target.value, 10))}
                        className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {t('adhanSettings.volumeExplanation')}
                    </p>
                </div>

                <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-gray-900 dark:text-white">{t('adhanSettings.flipToStop')}</h3>
                        <button
                            onClick={() => setFlipToStopAdhan(!flipToStopAdhan)}
                            className={`w-12 h-7 rounded-full p-1 transition-colors relative shrink-0 ${flipToStopAdhan ? 'bg-primary' : 'bg-gray-300 dark:bg-white/10'}`}
                        >
                            <div className={`size-5 bg-white rounded-full shadow-sm transition-transform ${flipToStopAdhan ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {t('adhanSettings.flipToStopExplanation')}
                    </p>
                </div>

                <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('adhanSettings.playAdhanFor')}</h3>
                    <div className="space-y-3">
                        {PRAYER_NAMES.map(prayer => (
                            <div key={prayer} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700 dark:text-gray-200">{prayer}</span>
                                <button
                                    onClick={() => updateAdhanPrayerEnabled(prayer, !adhanPrayerEnabled[prayer])}
                                    className={`w-12 h-7 rounded-full p-1 transition-colors relative shrink-0 ${adhanPrayerEnabled[prayer] ? 'bg-primary' : 'bg-gray-300 dark:bg-white/10'}`}
                                >
                                    <div className={`size-5 bg-white rounded-full shadow-sm transition-transform ${adhanPrayerEnabled[prayer] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {adhanSounds.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                        <span className="material-symbols-outlined text-5xl mb-3 opacity-50">volume_up</span>
                        <p className="font-medium">{t('adhanSettings.noSoundsYet')}</p>
                        <p className="text-sm mt-1">{t('adhanSettings.tapToUpload')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {adhanSounds.map(sound => {
                            const isActive = activeAdhanId === sound.id;
                            const isPlaying = playingId === sound.id;
                            return (
                                <div key={sound.id} className={`p-4 rounded-2xl border flex items-center gap-3 ${isActive ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5'}`}>
                                    <button
                                        onClick={() => togglePreview(sound)}
                                        className="size-10 rounded-full bg-gray-900/80 dark:bg-white/10 flex items-center justify-center text-white shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                                    </button>
                                    <button onClick={() => setActiveAdhanId(isActive ? null : sound.id)} className="flex-1 text-left">
                                        <h3 className={`font-bold ${isActive ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{sound.label}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{isActive ? t('adhanSettings.active') : t('adhanSettings.tapToSetActive')}</p>
                                    </button>
                                    <button
                                        onClick={() => openEdit(sound)}
                                        className="size-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <AdhanFormSheet
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditingSound(null); }}
                onSave={handleSave}
                onDelete={editingSound ? handleDelete : undefined}
                editingSound={editingSound}
                saving={saving}
            />
        </div>
    );
};

export default AdhanSettings;
