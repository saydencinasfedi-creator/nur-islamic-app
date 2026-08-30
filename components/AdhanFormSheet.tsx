import React, { useState, useEffect, useRef } from 'react';
import { AdhanSound } from '../types';
import { pushBackHandler } from '../services/backHandlerStack';
import { useUser } from '../contexts/UserContext';

interface AdhanFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { label: string; file: File | null }) => void;
    onDelete?: () => void;
    editingSound?: AdhanSound | null;
    saving?: boolean;
}

const AdhanFormSheet: React.FC<AdhanFormSheetProps> = ({ isOpen, onClose, onSave, onDelete, editingSound, saving }) => {
    const { t } = useUser();
    const [label, setLabel] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setLabel(editingSound?.label ?? '');
        setFile(null);
    }, [isOpen, editingSound]);

    useEffect(() => {
        if (!isOpen) return;
        return pushBackHandler(() => {
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const canSave = label.trim().length > 0 && (editingSound || file);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingSound ? t('adhanFormSheet.editTitle') : t('adhanFormSheet.addTitle')}</h2>
                    <button onClick={onClose} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                </div>

                <div className="overflow-y-auto no-scrollbar space-y-5 pb-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('adhanFormSheet.labelField')}</label>
                        <input
                            type="text"
                            placeholder={t('adhanFormSheet.labelPlaceholder')}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('adhanFormSheet.audioFileLabel')}</label>
                        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">upload_file</span>
                            {file ? file.name : editingSound ? t('adhanFormSheet.replaceAudioFile') : t('adhanFormSheet.chooseAudioFile')}
                        </button>
                    </div>

                    <button
                        onClick={() => onSave({ label: label.trim(), file })}
                        disabled={!canSave || saving}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${canSave && !saving ? 'bg-primary text-background-dark hover:bg-primary-dark shadow-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
                    >
                        {saving ? t('adhanFormSheet.saving') : editingSound ? t('adhanFormSheet.saveChanges') : t('adhanFormSheet.addTitle')}
                    </button>

                    {editingSound && onDelete && (
                        <button
                            onClick={onDelete}
                            className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 font-bold text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            {t('adhanFormSheet.delete')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdhanFormSheet;
