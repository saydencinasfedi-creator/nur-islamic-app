
import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';

interface PrivateIDConfirmationProps {
  onBack: () => void;
}

const PrivateIDConfirmation: React.FC<PrivateIDConfirmationProps> = ({ onBack }) => {
  const { t } = useUser();
  const { signInAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onStart = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await signInAsGuest();
      // Session change is handled centrally in App.tsx.
    } catch (err: any) {
      setError(err?.message || t('privateIdConfirmation.error'));
      setBusy(false);
    }
  };

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
        <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-2xl text-gray-400">help</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col px-5 pb-8">
        <div className="relative w-full aspect-[2/1] mt-4 mb-6 rounded-2xl overflow-hidden shadow-2xl shadow-black/20">
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/40 to-transparent z-10 opacity-80"></div>
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="w-16 h-16 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/40 flex items-center justify-center shadow-[0_0_30px_rgba(19,236,146,0.3)] animate-pulse">
              <span className="material-symbols-outlined text-primary text-3xl font-bold">check</span>
            </div>
          </div>
          <div
            className="w-full h-full bg-cover bg-center opacity-60"
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA2QL2WYfgAkPPmD0vmkrslOmLkTk6dwGsmiYrDYfVQguUgNqusr5pvps17HZ4yBMEEkuwsU2Uw-P1kP9Zeq1ocwFhYWSHO6NvYP127cVpepaMLf8-BC0UE3m8YBorTEOSlHVCEVUJ7ID203ZBFELUkg3VPkhryQ-9Kpo3mylboo6lP5NmEFo9J969HPY8QaD5-cwUcFdTVC_Aq1eXpF8X0uZ5Osp7ieUzg8xshMoKHnRTI-NSG7exeFhh4mX-IJMA0uUfwqqs9lqc')" }}
          ></div>
        </div>

        <div className="pb-6 text-center">
          <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
            {t('privateIdConfirmation.title')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-normal mt-2 max-w-xs mx-auto">
            {t('privateIdConfirmation.subtitle')}
          </p>
        </div>

        <div className="w-full relative overflow-hidden rounded-2xl bg-white dark:bg-[#152a21] border border-gray-200 dark:border-primary/20 shadow-lg mb-6">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              <span className="material-symbols-outlined text-lg">info</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('privateIdConfirmation.guestNote')}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-sm">visibility_off</span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('privateIdConfirmation.noPersonalDataTracking')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-sm">cloud_off</span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('privateIdConfirmation.dataStoredLocally')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-sm">block</span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('privateIdConfirmation.zeroAds')}</span>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="mt-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm text-center mb-3">{error}</div>
          )}
          <button
            onClick={onStart}
            disabled={busy}
            className="w-full rounded-xl bg-primary hover:bg-[#10d482] disabled:opacity-60 text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-[0_0_20px_rgba(19,236,146,0.25)]"
          >
            {busy
              ? <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></span>
              : <><span>{t('privateIdConfirmation.beginSpiritualPractice')}</span><span className="material-symbols-outlined">arrow_forward</span></>}
          </button>
        </div>
      </div>
      <div className="h-5 bg-background-light dark:bg-background-dark"></div>
    </div>
  );
};

export default PrivateIDConfirmation;
