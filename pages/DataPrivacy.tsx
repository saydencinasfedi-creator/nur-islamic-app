
import React from 'react';
import { useUser } from '../contexts/UserContext';

interface DataPrivacyProps {
  onBack: () => void;
}

const DataPrivacy: React.FC<DataPrivacyProps> = ({ onBack }) => {
  const { t } = useUser();
  const items = [
    { icon: 'cloud_off', label: t('dataPrivacy.localStorage'), desc: t('dataPrivacy.localStorageDesc'), color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: 'login', label: t('dataPrivacy.googleEmailSignIn'), desc: t('dataPrivacy.googleEmailSignInDesc'), color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: 'explore', label: t('dataPrivacy.prayerTimesQibla'), desc: t('dataPrivacy.prayerTimesQiblaDesc'), color: 'text-teal-500', bg: 'bg-teal-500/10' },
    { icon: 'block', label: t('dataPrivacy.noAds'), desc: t('dataPrivacy.noAdsDesc'), color: 'text-orange-500', bg: 'bg-orange-500/10' }
  ];
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark font-display antialiased text-slate-900 dark:text-white transition-colors duration-200">
      <div
        className="flex items-center bg-background-light dark:bg-background-dark px-4 pb-2 justify-between backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 border-b border-gray-200 dark:border-[#1a2e25]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={onBack} className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-start cursor-pointer transition-opacity hover:opacity-70">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('dataPrivacy.title')}</h2>
        <div className="w-12"></div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 px-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-primary/10 p-6 rounded-full mb-6">
            <span className="material-symbols-outlined text-primary text-[48px]">shield_lock</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('dataPrivacy.localByDefault')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-[280px]">
            {t('dataPrivacy.subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-2xl p-6 mb-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-primary text-[28px] mt-1">handshake</span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dataPrivacy.amanahTitle')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-300 leading-relaxed">
                {t('dataPrivacy.amanahDesc')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-gray-900 dark:text-white text-sm font-semibold uppercase tracking-wider mb-3">{t('dataPrivacy.whatActuallyHappens')}</h3>
          {items.map(item => (
            <div key={item.label} className="bg-white dark:bg-card-dark p-4 rounded-xl flex gap-4 items-center">
              <div className={`${item.bg} p-2 rounded-lg shrink-0`}><span className={`material-symbols-outlined ${item.color}`}>{item.icon}</span></div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900 dark:text-white">{item.label}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DataPrivacy;
