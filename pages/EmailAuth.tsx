import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';

interface EmailAuthProps {
    onBack: () => void;
    onCreateAccount: () => void;
}

const HERO = "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA2QL2WYfgAkPPmD0vmkrslOmLkTk6dwGsmiYrDYfVQguUgNqusr5pvps17HZ4yBMEEkuwsU2Uw-P1kP9Zeq1ocwFhYWSHO6NvYP127cVpepaMLf8-BC0UE3m8YBorTEOSlHVCEVUJ7ID203ZBFELUkg3VPkhryQ-9Kpo3mylboo6lP5NmEFo9J969HPY8QaD5-cwUcFdTVC_Aq1eXpF8X0uZ5Osp7ieUzg8xshMoKHnRTI-NSG7exeFhh4mX-IJMA0uUfwqqs9lqc')";
const inputBox = "block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-12 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400";
const codeBox = "block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 px-4 text-center text-xl tracking-[0.3em] font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm";

type Step = 'login' | 'code' | 'reset-code';

const EmailAuth: React.FC<EmailAuthProps> = ({ onBack, onCreateAccount }) => {
    const { t } = useUser();
    const { signInWithPassword, verifySignupOtp, resendConfirmation, sendPasswordReset, verifyRecoveryOtp } = useAuth();
    const [step, setStep] = useState<Step>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [resent, setResent] = useState(false);

    const goStep = (next: Step) => {
        setStep(next);
        setCode('');
        setError('');
        setResent(false);
    };

    const handleForgot = async () => {
        if (busy) return;
        if (!email.trim()) { setError(t('emailAuth.enterEmailFirst')); return; }
        setBusy(true);
        setError('');
        try {
            await sendPasswordReset(email);
            goStep('reset-code');
        } catch (err: any) {
            setError(err?.message || t('emailAuth.otpSendError'));
        } finally {
            setBusy(false);
        }
    };

    const submitLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password || busy) return;
        setBusy(true);
        setError('');
        try {
            await signInWithPassword(email, password);
        } catch (err: any) {
            const msg: string = err?.message || '';
            if (/not confirmed/i.test(msg)) {
                try { await resendConfirmation(email); setResent(true); } catch { /* ignore */ }
                goStep('code');
            } else if (/invalid login credentials/i.test(msg)) {
                setError(t('emailAuth.signInError'));
            } else {
                setError(msg || t('emailAuth.signInError'));
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
            if (step === 'reset-code') {
                await verifyRecoveryOtp(email, code);
                // supabase emits PASSWORD_RECOVERY -> App routes to the reset-password screen.
            } else {
                await verifySignupOtp(email, code);
            }
        } catch (err: any) {
            setError(err?.message || t('emailAuth.otpVerifyError'));
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        if (busy) return;
        setBusy(true);
        try {
            if (step === 'reset-code') await sendPasswordReset(email);
            else await resendConfirmation(email);
            setResent(true);
        } catch { /* ignore */ }
        finally { setBusy(false); }
    };

    const isCodeStep = step === 'code' || step === 'reset-code';

    const title = step === 'login'
        ? t('emailAuth.welcomeBack')
        : step === 'reset-code'
            ? t('emailAuth.resetCodeTitle')
            : t('createAccount.checkEmailTitle');
    const subtitle = step === 'login'
        ? t('emailAuth.subtitle')
        : step === 'reset-code'
            ? t('emailAuth.resetCodeSubtitle', { email })
            : t('emailAuth.confirmFirst');

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden font-display text-gray-900 dark:text-white transition-colors duration-200">
            <div className="flex items-center p-6 pb-2 justify-between">
                <button onClick={() => (isCodeStep ? goStep('login') : onBack())}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-[#0c8e56] flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-background-dark text-xl font-bold">mosque</span>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
                <div className="relative w-full aspect-[16/9] mb-6 rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/20 to-transparent z-10 opacity-60"></div>
                    <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: HERO }}></div>
                </div>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">{title}</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm">{subtitle}</p>
                </div>

                {step === 'login' ? (
                    <form onSubmit={submitLogin} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('emailAuth.emailLabel')}</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">mail</span>
                                </div>
                                <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputBox}
                                    placeholder={t('emailAuth.emailPlaceholder')} required autoFocus inputMode="email" type="email" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('emailAuth.passwordLabel')}</label>
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
                            <button type="button" onClick={handleForgot} disabled={busy}
                                className="ml-1 mt-1 text-sm font-medium text-primary hover:text-[#10d482] transition-colors disabled:opacity-50">
                                {t('emailAuth.forgotPassword')}
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>
                        )}

                        <div className="mt-4">
                            <button type="submit" disabled={busy || !email.trim() || !password}
                                className="w-full rounded-xl bg-primary hover:bg-[#10d482] disabled:opacity-50 disabled:cursor-not-allowed text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-[0_4px_20px_rgba(19,236,146,0.3)]">
                                {busy
                                    ? <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></span>
                                    : <><span>{t('emailAuth.logIn')}</span><span className="material-symbols-outlined text-xl">arrow_forward</span></>}
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
                                className={codeBox}
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

                {step === 'login' && (
                    <div className="text-center pt-8 pb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('emailAuth.newHere')}
                            <button onClick={onCreateAccount} className="font-semibold text-primary hover:text-[#10d482] transition-colors ml-1">{t('emailAuth.createAnAccount')}</button>
                        </p>
                    </div>
                )}
            </div>
            <div className="h-5 bg-background-light dark:bg-background-dark"></div>
        </div>
    );
};

export default EmailAuth;
