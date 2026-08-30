
import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

interface PrivateIDConfirmationProps {
  onBack: () => void;
  onStart: () => void;
}

const PrivateIDConfirmation: React.FC<PrivateIDConfirmationProps> = ({ onBack, onStart }) => {
  const { t } = useUser();
  const privateId = "8821 4902 1193";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(privateId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <div className="p-4 flex flex-col items-center">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-2">{t('privateIdConfirmation.yourPrivateId')}</p>
            <div className="w-full bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/5 py-2.5 px-2 mb-3">
              <p className="font-mono text-xl sm:text-2xl text-center text-gray-800 dark:text-primary tracking-widest font-medium select-all">
                {privateId}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all w-full justify-center group ${copied ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 scale-[1.02]' : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}
            >
              <span className="material-symbols-outlined text-lg transition-colors">{copied ? 'check' : 'content_copy'}</span>
              <span>{copied ? t('privateIdConfirmation.copied') : t('privateIdConfirmation.copyToClipboard')}</span>
            </button>
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
          <button
            onClick={onStart}
            className="w-full rounded-xl bg-primary hover:bg-[#10d482] text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-[0_0_20px_rgba(19,236,146,0.25)]"
          >
            <span>{t('privateIdConfirmation.beginSpiritualPractice')}</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          {/* <p className="text-[11px] text-center text-gray-400 mt-4 mb-4">
            I have saved my Private ID securely
          </p> */}
        </div>
      </div>
      <div className="h-5 bg-background-light dark:bg-background-dark"></div>
    </div>
  );
};

export default PrivateIDConfirmation;
