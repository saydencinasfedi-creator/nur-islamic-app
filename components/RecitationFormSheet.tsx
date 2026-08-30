import React, { useState, useEffect, useRef } from 'react';
import { Surah, CustomRecitation } from '../types';
import { pushBackHandler } from '../services/backHandlerStack';
import { useUser } from '../contexts/UserContext';

interface RecitationFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    surahs: Surah[];
    defaultSurahNumber?: number;
    editing?: CustomRecitation | null;
    onSave: (data: { surahNumber: number; surahName: string; reciterName: string; file: File | null }) => void;
    saving?: boolean;
}

const RecitationFormSheet: React.FC<RecitationFormSheetProps> = ({ isOpen, onClose, surahs, defaultSurahNumber, editing, onSave, saving }) => {
    const { t } = useUser();
    const [surahNumber, setSurahNumber] = useState(defaultSurahNumber ?? 1);
    const [reciterName, setReciterName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setSurahNumber(editing?.surahNumber ?? defaultSurahNumber ?? 1);
        setReciterName(editing?.reciterName ?? '');
        setFile(null);
    }, [isOpen, defaultSurahNumber, editing]);

    useEffect(() => {
        if (!isOpen) return;
        return pushBackHandler(() => {
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const canSave = reciterName.trim().length > 0 && (!!file || !!editing);

    const handleSave = () => {
        if (!canSave) return;
        const surah = surahs.find(s => s.number === surahNumber);
        onSave({
            surahNumber,
            surahName: surah?.englishName ?? `Surah ${surahNumber}`,
            reciterName: reciterName.trim(),
            file,
        });
    };

    return (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1A2230] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editing ? t('recitationFormSheet.editTitle') : t('recitationFormSheet.addTitle')}</h2>
                    <button onClick={onClose} className="size-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                </div>

                <div className="overflow-y-auto no-scrollbar space-y-5 pb-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{t('recitationFormSheet.surahLabel')}</label>
                        <select
                            value={surahNumber}
                            onChange={(e) => setSurahNumber(parseInt(e.target.value, 10))}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white p-3 focus:ring-1 focus:ring-primary focus:border-primary"
                        >
                            {surahs.map(s => (
                                <option key={s.number} value={s.number}>{s.number}. {s.englishName}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{t('recitationFormSheet.reciterNameLabel')}</label>
                        <input
                            type="text"
                            placeholder={t('recitationFormSheet.reciterNamePlaceholder')}
                            value={reciterName}
                            onChange={(e) => setReciterName(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 p-3 focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{t('recitationFormSheet.audioFileLabel')}</label>
                        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">upload_file</span>
                            {file ? file.name : (editing ? t('recitationFormSheet.replaceAudioFile') : t('recitationFormSheet.chooseAudioFile'))}
                        </button>
                        <p className="text-[10px] text-gray-400 mt-2">{t('recitationFormSheet.audioFileHint')}</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${canSave && !saving ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}
                    >
                        {saving ? t('recitationFormSheet.saving') : (editing ? t('recitationFormSheet.saveChanges') : t('recitationFormSheet.addTitle'))}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecitationFormSheet;
