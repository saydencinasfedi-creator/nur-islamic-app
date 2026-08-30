import React, { useState, useEffect } from 'react';
import { Goal, GoalType } from '../types';
import { pushBackHandler } from '../services/backHandlerStack';
import IconPickerSheet from './IconPickerSheet';
import GoalIcon from './GoalIcon';
import { useUser } from '../contexts/UserContext';

interface GoalFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { label: string; icon: string; iconImage?: string; type: GoalType; target?: number }) => void;
    onDelete?: () => void;
    editingGoal?: Goal | null;
}

const GoalFormSheet: React.FC<GoalFormSheetProps> = ({ isOpen, onClose, onSave, onDelete, editingGoal }) => {
    const { t } = useUser();
    const [label, setLabel] = useState('');
    const [icon, setIcon] = useState('flag');
    const [iconImage, setIconImage] = useState<string | undefined>(undefined);
    const [type, setType] = useState<GoalType>('boolean');
    const [targetInput, setTargetInput] = useState('10');
    const [showIconPicker, setShowIconPicker] = useState(false);

    const targetError = (raw: string): string | null => {
        const trimmed = raw.trim();
        if (trimmed === '') return t('goalFormSheet.errorEnterTarget');
        if (!/^-?\d+$/.test(trimmed)) return t('goalFormSheet.errorNumbersOnly');
        if (parseInt(trimmed, 10) <= 0) return t('goalFormSheet.errorPositiveNumber');
        return null;
    };
    const targetErrorMessage = type === 'amount' ? targetError(targetInput) : null;

    useEffect(() => {
        if (!isOpen) return;
        if (editingGoal) {
            setLabel(editingGoal.label);
            setIcon(editingGoal.icon);
            setIconImage(editingGoal.iconImage);
            setType(editingGoal.type);
            setTargetInput(String(editingGoal.target ?? 10));
        } else {
            setLabel('');
            setIcon('flag');
            setIconImage(undefined);
            setType('boolean');
            setTargetInput('10');
        }
    }, [isOpen, editingGoal]);

    useEffect(() => {
        if (!isOpen) return;
        return pushBackHandler(() => {
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!label.trim()) return;
        if (type === 'amount' && targetErrorMessage) return;
        onSave({
            label: label.trim(),
            icon,
            iconImage,
            type,
            target: type === 'amount' ? parseInt(targetInput.trim(), 10) : undefined,
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-md max-h-[85vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingGoal ? t('goalFormSheet.editTitle') : t('goalFormSheet.addTitle')}</h2>
                    <button onClick={onClose} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                </div>

                <div className="overflow-y-auto no-scrollbar space-y-5 pb-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowIconPicker(true)}
                            className="size-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors overflow-hidden"
                        >
                            <GoalIcon icon={icon} iconImage={iconImage} className="text-3xl size-full" />
                        </button>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('goalFormSheet.goalNameLabel')}</label>
                            <input
                                type="text"
                                placeholder={t('goalFormSheet.goalNamePlaceholder')}
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('goalFormSheet.typeLabel')}</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setType('boolean')}
                                className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-colors ${type === 'boolean' ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                            >
                                {t('goalFormSheet.typeYesNo')}
                            </button>
                            <button
                                onClick={() => setType('amount')}
                                className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-colors ${type === 'amount' ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                            >
                                {t('goalFormSheet.typeAmount')}
                            </button>
                        </div>
                    </div>

                    {type === 'amount' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('goalFormSheet.targetAmountLabel')}</label>
                            <div className={`flex items-center gap-3 bg-gray-100 dark:bg-white/5 p-3 rounded-xl border ${targetErrorMessage ? 'border-red-500/50' : 'border-gray-200 dark:border-white/5'}`}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={targetInput}
                                    onChange={(e) => setTargetInput(e.target.value)}
                                    className="bg-transparent border-none text-slate-900 dark:text-white font-bold focus:ring-0 w-full p-0"
                                />
                            </div>
                            {targetErrorMessage ? (
                                <p className="text-[11px] text-red-500 dark:text-red-400">{targetErrorMessage}</p>
                            ) : (
                                <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('goalFormSheet.targetAmountHint')}</p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={!label.trim() || !!targetErrorMessage}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${label.trim() && !targetErrorMessage ? 'bg-primary text-background-dark hover:bg-primary-dark shadow-glow' : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
                    >
                        {editingGoal ? t('goalFormSheet.saveChanges') : t('goalFormSheet.addTitle')}
                    </button>

                    {editingGoal && onDelete && (
                        <button
                            onClick={onDelete}
                            className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 font-bold text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            {t('goalFormSheet.deleteGoal')}
                        </button>
                    )}
                </div>
            </div>

            <IconPickerSheet
                isOpen={showIconPicker}
                onClose={() => setShowIconPicker(false)}
                onSelect={(name) => { setIcon(name); setIconImage(undefined); }}
                onSelectImage={(dataUrl) => setIconImage(dataUrl)}
                selected={icon}
            />
        </div>
    );
};

export default GoalFormSheet;
