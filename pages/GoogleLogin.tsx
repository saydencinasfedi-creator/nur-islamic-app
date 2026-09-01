import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';

interface GoogleLoginProps {
    onBack: () => void;
}

const GoogleLogin: React.FC<GoogleLoginProps> = ({ onBack }) => {
    const { t } = useUser();
    const { signInWithGoogle } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const onLogin = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err?.message || t('googleLogin.error'));
            setBusy(false);
        }
    };

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden font-display text-gray-900 dark:text-white transition-colors duration-200">
            <div className="flex items-center p-6 pb-2 justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-[#0c8e56] flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-background-dark text-xl font-bold">mosque</span>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 flex flex-col px-5 pb-8">
                <div className="relative w-full aspect-[16/9] mt-4 mb-2 rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
                    <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/20 to-transparent z-10 opacity-60"></div>
                    <div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA2QL2WYfgAkPPmD0vmkrslOmLkTk6dwGsmiYrDYfVQguUgNqusr5pvps17HZ4yBMEEkuwsU2Uw-P1kP9Zeq1ocwFhYWSHO6NvYP127cVpepaMLf8-BC0UE3m8YBorTEOSlHVCEVUJ7ID203ZBFELUkg3VPkhryQ-9Kpo3mylboo6lP5NmEFo9J969HPY8QaD5-cwUcFdTVC_Aq1eXpF8X0uZ5Osp7ieUzg8xshMoKHnRTI-NSG7exeFhh4mX-IJMA0uUfwqqs9lqc')" }}
                    >
                    </div>
                </div>

                <div className="pt-6 pb-2">
                    <h1 className="text-gray-900 dark:text-white tracking-tight text-[32px] font-bold leading-[1.1] text-center">
                        <span className="text-primary">{t('googleLogin.title')}</span>
                    </h1>
                </div>

                <div className="pb-6">
                    <p className="text-gray-500 dark:text-gray-400 text-base font-normal leading-normal text-center max-w-xs mx-auto">
                        {t('googleLogin.subtitle')}
                    </p>
                </div>

                <div className="flex flex-col gap-3 mt-8">
                    <button
                        onClick={onLogin}
                        disabled={busy}
                        className="w-full rounded-xl bg-white text-gray-800 border border-gray-200 dark:border-transparent font-bold text-base py-3.5 flex items-center justify-center gap-3 transition-transform active:scale-[0.99] shadow-lg shadow-black/5 hover:bg-gray-50 disabled:opacity-60"
                    >
                        {busy
                            ? <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                            : <><span className="material-symbols-outlined">account_circle</span><span>{t('googleLogin.continueWithGoogle')}</span></>}
                    </button>
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
                    )}
                    <button
                        onClick={onBack}
                        className="w-full rounded-xl bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 font-medium text-sm py-3.5 flex items-center justify-center gap-2 transition-colors"
                    >
                        <span>{t('common.cancel')}</span>
                    </button>
                </div>
            </div>
            <div className="h-5 bg-background-light dark:bg-background-dark"></div>
        </div>
    );
};

export default GoogleLogin;
