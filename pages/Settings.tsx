import React, { useState } from 'react';
import { PageId } from '../types';
import { useUser } from '../contexts/UserContext';
import Avatar from '../components/Avatar';
import AdhanSettings from './AdhanSettings';
import { LANGUAGES } from './LanguageSettings';

interface SettingsProps {
  navigate: (page: PageId) => void;
  onBack: () => void;
  darkMode: boolean;
  useSystemTheme: boolean;
}

const Settings: React.FC<SettingsProps> = ({ navigate, onBack, darkMode, useSystemTheme }) => {
  const { user, notifSettings, updateNotifSettings, language, t } = useUser();
  const [isAdhanSheetOpen, setIsAdhanSheetOpen] = useState(false);
  const appearanceSub = useSystemTheme ? t('settings.system') : darkMode ? t('settings.darkMode') : t('settings.lightMode');
  const languageSub = LANGUAGES.find(l => l.code === language)?.name ?? 'English';

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark font-display antialiased text-slate-900 dark:text-white transition-colors duration-200">
      <div
        className="flex items-center bg-background-light dark:bg-background-dark px-4 pb-2 justify-between backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 border-b border-gray-200 dark:border-[#1a2e25]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={onBack} className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-start cursor-pointer transition-opacity hover:opacity-70">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('settings.title')}</h2>
        <div className="w-12"></div>
      </div>

      <div className="flex-1 overflow-y-hidden no-scrollbar pb-10">
        <div className="flex p-4">
          <div className="flex w-full flex-col gap-4 bg-white dark:bg-surface-dark rounded-xl p-4 shadow-sm">
            <div className="flex gap-4 items-center">
              <Avatar src={user?.avatar} className="aspect-square rounded-full h-16 w-16 border-2 border-primary" iconClassName="text-3xl" />
              <div className="flex flex-col justify-center flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-slate-900 dark:text-white text-[20px] font-bold leading-tight tracking-[-0.015em]">{user?.name || t('settings.guest')}</p>
                  {(user?.isPremium) && <span className="material-symbols-outlined text-primary text-[20px] filled" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>}
                </div>
                <p className="text-gray-500 dark:text-[#92c9b2] text-sm font-normal leading-normal">{t('settings.activeSince', { year: user?.memberSince || '2023' })}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="flex flex-col">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-6 pb-2 pt-4">{t('settings.general')}</h3>
          {[
            { label: t('settings.language'), sub: languageSub, icon: 'language', id: 'language' as PageId },
            { label: t('settings.appearance'), sub: appearanceSub, icon: 'dark_mode', id: 'appearance' as PageId },
            { label: t('settings.adhanSettings'), sub: '', icon: 'volume_up', id: 'adhan-settings' as PageId }
          ].map(item => (
            <div
              key={item.label}
              onClick={() => item.id === 'adhan-settings' ? setIsAdhanSheetOpen(true) : navigate(item.id)}
              className="flex items-center gap-4 bg-white dark:bg-background-dark px-6 min-h-[60px] justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="text-white flex items-center justify-center rounded-full bg-slate-900 dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shrink-0 size-10 group-hover:border-primary transition-colors">
                  <span className="material-symbols-outlined text-white/90 dark:text-primary" style={{ fontSize: '20px' }}>{item.icon}</span>
                </div>
                <p className="text-slate-900 dark:text-white text-base font-medium leading-normal flex-1 truncate">{item.label}</p>
              </div>
              <div className="flex items-center gap-2">
                {item.sub && <p className="text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal">{item.sub}</p>}
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>chevron_right</span>
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col mt-2">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-6 pb-2 pt-4">
            {t('settings.privacyTrust')}
          </h3>
          <div onClick={() => navigate('data-privacy')} className="flex items-center gap-4 bg-white dark:bg-background-dark px-6 min-h-[60px] justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors group">
            <div className="flex items-center gap-4">
              <div className="text-white flex items-center justify-center rounded-full bg-slate-900 dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shrink-0 size-10 group-hover:border-primary transition-colors">
                <span className="material-symbols-outlined text-white/90 dark:text-primary" style={{ fontSize: '20px' }}>security</span>
              </div>
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal flex-1 truncate">{t('settings.dataPrivacy')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>chevron_right</span>
            </div>
          </div>
          <div onClick={() => navigate('content-ai')} className="flex items-center gap-4 bg-white dark:bg-background-dark px-6 min-h-[60px] justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors group">
            <div className="flex items-center gap-4">
              <div className="text-white flex items-center justify-center rounded-full bg-slate-900 dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shrink-0 size-10 group-hover:border-primary transition-colors">
                <span className="material-symbols-outlined text-white/90 dark:text-primary" style={{ fontSize: '20px' }}>smart_toy</span>
              </div>
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal flex-1 truncate">{t('settings.contentSourcesAi')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>chevron_right</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col mt-2">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-6 pb-2 pt-4">{t('settings.notifications')}</h3>
          <div className="flex items-center gap-4 bg-white dark:bg-background-dark px-6 min-h-[60px] justify-between group">
            <div className="flex items-center gap-4">
              <div className="text-white flex items-center justify-center rounded-full bg-slate-900 dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shrink-0 size-10 group-hover:border-primary transition-colors">
                <span className="material-symbols-outlined text-white/90 dark:text-primary" style={{ fontSize: '20px' }}>schedule</span>
              </div>
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal flex-1 truncate">{t('settings.prayerTimes')}</p>
            </div>
            <button
              onClick={() => updateNotifSettings({ prayerTimes: !notifSettings.prayerTimes })}
              className={`w-12 h-7 rounded-full p-1 transition-colors relative shrink-0 ${notifSettings.prayerTimes ? 'bg-primary' : 'bg-gray-300 dark:bg-white/10'}`}
            >
              <div className={`size-5 bg-white rounded-full shadow-sm transition-transform ${notifSettings.prayerTimes ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </section>
      </div>

      {isAdhanSheetOpen && <AdhanSettings onBack={() => setIsAdhanSheetOpen(false)} />}
    </div>
  );
};

export default Settings;
