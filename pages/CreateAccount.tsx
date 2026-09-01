import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';

interface CreateAccountProps {
    onBack: () => void;
    onLogin: () => void;
}

const MIN_PASSWORD = 8;
const inputBox = "block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-12 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400";

const CreateAccount: React.FC<CreateAccountProps> = ({ onBack, onLogin }) => {
    const { t } = useUser();
    const { signUpWithPassword, verifySignupOtp, resendConfirmation } = useAuth();
    const [step, setStep] = useState<'form' | 'code'>('form');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [resent, setResent] = useState(false);

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        if (!name.trim() || !email.trim()) return;
        if (password.length < MIN_PASSWORD) { setError(t('createAccount.passwordTooShort', { n: MIN_PASSWORD })); return; }
        if (password !== confirm) { setError(t('createAccount.passwordsDoNotMatch')); return; }
        setBusy(true);
        setError('');
        try {
            await signUpWithPassword(email, password, name);
            try { sessionStorage.setItem('nurPendingDisplayName', name.trim()); } catch { /* ignore */ }
            setStep('code');
        } catch (err: any) {
            const msg: string = err?.message || '';
            if (/already registered|already been registered|user already/i.test(msg)) {
                setError(t('createAccount.emailInUse'));
            } else {
                setError(msg || t('createAccount.signUpError'));
            }
        } finally {
            setBusy(false);
        }
    };

    const submitCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length < 6 || busy) return;
        setBusy(true);
        setError('');
        try {
            await verifySignupOtp(email, code);
            // App.tsx routes to the app once the session is established.
        } catch (err: any) {
            setError(err?.message || t('emailAuth.otpVerifyError'));
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        if (busy) return;
        setBusy(true);
        try { await resendConfirmation(email); setResent(true); } catch { /* ignore */ }
        finally { setBusy(false); }
    };

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden font-display text-gray-900 dark:text-white transition-colors duration-200">
            <div className="flex items-center p-6 pb-2 justify-between">
                <button
                    onClick={() => (step === 'code' ? setStep('form') : onBack())}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-[#0c8e56] flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-background-dark text-xl font-bold">mosque</span>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
                        {step === 'form' ? t('createAccount.title') : t('createAccount.checkEmailTitle')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm">
                        {step === 'form' ? t('createAccount.subtitle') : t('createAccount.codeSentTo', { email })}
                    </p>
                </div>

                {step === 'form' ? (
                    <form onSubmit={submitForm} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.fullNameLabel')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">person</span>
                                </div>
                                <input value={name} onChange={(e) => setName(e.target.value)} className={inputBox}
                                    placeholder={t('createAccount.fullNamePlaceholder')} required type="text" autoFocus />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.emailLabel')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">mail</span>
                                </div>
                                <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputBox}
                                    placeholder={t('createAccount.emailPlaceholder')} required type="email" inputMode="email" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.passwordLabel')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock</span>
                                </div>
                                <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputBox}
                                    placeholder="••••••••" required type={showPassword ? 'text' : 'password'} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility' : 'visibility_off'}</span>
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">{t('createAccount.passwordHint', { n: MIN_PASSWORD })}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.confirmPasswordLabel')}</label>
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
                                    : <><span>{t('createAccount.signUp')}</span><span className="material-symbols-outlined text-xl">arrow_forward</span></>}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={submitCode} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('emailAuth.codeLabel')}</label>
                            <input
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 px-4 text-center text-xl tracking-[0.3em] font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm"
                                placeholder={t('emailAuth.codePlaceholder')} required autoFocus inputMode="numeric" type="text"
                            />
                        </div>

                        {resent && (
                            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm">{t('createAccount.linkResent')}</div>
                        )}
                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>
                        )}

                        <button type="submit" disabled={busy || code.length < 6}
                            className="w-full rounded-xl bg-primary hover:bg-[#10d482] disabled:opacity-50 text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-[0_4px_20px_rgba(19,236,146,0.3)]">
                            {busy
                                ? <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></span>
                                : <><span>{t('emailAuth.verifyAndContinue')}</span><span className="material-symbols-outlined text-xl">arrow_forward</span></>}
                        </button>
                        <button type="button" onClick={resend} disabled={busy}
                            className="text-sm font-medium text-primary hover:text-[#10d482] transition-colors disabled:opacity-50">
                            {t('createAccount.resendCode')}
                        </button>
                    </form>
                )}

                <div className="flex-1"></div>

                {step === 'form' && (
                    <div className="text-center pt-8 pb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('createAccount.alreadyHaveAccount')}
                            <button onClick={onLogin} className="font-semibold text-primary hover:text-[#10d482] transition-colors ml-1">{t('createAccount.logIn')}</button>
                        </p>
                    </div>
                )}
            </div>
            <div className="h-5 bg-background-light dark:bg-background-dark"></div>
        </div>
    );
};

export default CreateAccount;
