
import React from 'react';
import { useUser } from '../contexts/UserContext';

interface AuthProps {
  onBack: () => void;
  onLogin: (name: string) => void;
  onGenerateID: () => void;
  onEmailLogin: () => void;
  onGoogleLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ onBack, onLogin, onGenerateID, onEmailLogin, onGoogleLogin }) => {
  const { t } = useUser();
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden overscroll-none font-display text-gray-900 dark:text-white transition-colors duration-200">
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
            {t('auth.welcomeTitle')}
          </h1>
        </div>

        <div className="pb-8">
          <p className="text-gray-500 dark:text-gray-400 text-base font-normal leading-normal text-center max-w-xs mx-auto">
            {t('auth.chooseHowToContinue')}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#152a21] p-1 border border-gray-100 dark:border-white/5 shadow-sm transition-all">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  <span className="material-symbols-outlined">fingerprint</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{t('auth.guestAccountTitle')}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {t('auth.guestAccountDescription')}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onGenerateID}
              className="w-full rounded-xl bg-primary hover:bg-[#10d482] text-background-dark font-bold text-base py-3.5 flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-[0_0_15px_rgba(19,236,146,0.3)]"
            >
              <span>{t('auth.generatePrivateId')}</span>
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onEmailLogin}
              className="w-full rounded-2xl border border-gray-300 dark:border-white/20 bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-900 dark:text-white font-medium text-sm py-3.5 flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              <span>{t('auth.continueWithEmail')}</span>
            </button>
            <button
              onClick={onGoogleLogin}
              className="w-full rounded-2xl border border-gray-300 dark:border-white/20 bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-900 dark:text-white font-medium text-sm py-3.5 flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              <span>{t('auth.continueWithGoogle')}</span>
            </button>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="text-center mt-6">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 px-6 leading-relaxed mb-10">
            {t('auth.legalPrefix')} <button className="underline hover:text-primary transition-colors">{t('auth.termsOfService')}</button> {t('auth.legalAnd')} <button className="underline hover:text-primary transition-colors">{t('auth.privacyPolicy')}</button>.
          </p>
        </div>
      </div>
      <div className="h-5 bg-background-light dark:bg-background-dark"></div>
    </div>
  );
};

export default Auth;
