import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';

interface ResetPasswordProps {
    onDone: () => void;
}

const MIN_PASSWORD = 8;
const inputBox = "block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-12 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400";

const ResetPassword: React.FC<ResetPasswordProps> = ({ onDone }) => {
    const { t } = useUser();
    const { updatePassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (password.length < MIN_PASSWORD) { setError(t('resetPassword.tooShort', { n: MIN_PASSWORD })); return; }
        if (password !== confirm) { setError(t('resetPassword.mismatch')); return; }
        setBusy(true);
        setError('');
        try {
            await updatePassword(password);
            onDone();
        } catch (err: any) {
            setError(err?.message || t('resetPassword.error'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden font-display text-gray-900 dark:text-white transition-colors duration-200">
            <div className="flex items-center p-6 pb-2 justify-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-[#0c8e56] flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-background-dark text-xl font-bold">mosque</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">{t('resetPassword.title')}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm">{t('resetPassword.subtitle')}</p>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('resetPassword.newPasswordLabel')}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock</span>
                            </div>
                            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputBox}
                                placeholder="••••••••" required autoFocus type={showPassword ? 'text' : 'password'} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility' : 'visibility_off'}</span>
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">{t('resetPassword.hint', { n: MIN_PASSWORD })}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('resetPassword.confirmLabel')}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock_reset</span>
                            </div>
                            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputBox}
                                placeholder="••••••••" required type={showPassword ? 'text' : 'password'} />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>
                    )}

                    <div className="mt-4">
                        <button type="submit" disabled={busy}
                            className="w-full rounded-xl bg-primary hover:bg-[#10d482] disabled:opacity-50 text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-[0_4px_20px_rgba(19,236,146,0.3)]">
                            {busy
                                ? <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></span>
                                : <><span>{t('resetPassword.save')}</span><span className="material-symbols-outlined text-xl">arrow_forward</span></>}
                        </button>
                    </div>
                </form>
            </div>
            <div className="h-5 bg-background-light dark:bg-background-dark"></div>
        </div>
    );
};

export default ResetPassword;
