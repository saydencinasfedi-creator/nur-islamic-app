
import React from 'react';
import { useUser } from '../contexts/UserContext';

interface AppearanceSettingsProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  useSystemTheme: boolean;
  toggleUseSystemTheme: () => void;
  onBack: () => void;
  onDone: () => void;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({ darkMode, setDarkMode, useSystemTheme, toggleUseSystemTheme, onBack, onDone }) => {
  const { t } = useUser();
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark font-display antialiased text-slate-900 dark:text-white transition-colors duration-200">
      <div
        className="flex items-center bg-background-light dark:bg-background-dark px-4 pb-2 justify-between backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 border-b border-gray-200 dark:border-[#1a2e25]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={onBack} className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-start cursor-pointer transition-opacity hover:opacity-70">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('appearanceSettings.title')}</h2>
        <button onClick={onDone} className="flex w-12 items-center justify-end cursor-pointer transition-opacity hover:opacity-70">
          <p className="text-primary text-base font-bold leading-normal tracking-[0.015em] shrink-0">{t('appearanceSettings.done')}</p>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="px-6 py-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            {t('appearanceSettings.description')}
          </p>
        </div>

        <div className="px-6 mb-8">
          <div className="grid grid-cols-2 gap-6">
            {/* Light Mode */}
            <div onClick={() => setDarkMode(false)} className="flex flex-col gap-3 group cursor-pointer relative">
              <div className={`w-full aspect-[9/16] rounded-2xl border-4 ${!darkMode ? 'border-primary' : 'border-gray-200 dark:border-gray-700'} overflow-hidden relative shadow-sm hover:border-primary/50 transition-all duration-200`}>
                <div className="absolute inset-0 bg-[#f6f8f7] flex flex-col">
                  <div className="h-10 bg-white w-full border-b border-gray-100"></div>
                  <div className="p-3"><div className="w-full aspect-video bg-white rounded-lg shadow-sm"></div></div>
                  <div className="p-3 space-y-2"><div className="w-full h-8 bg-white rounded-lg shadow-sm"></div><div className="w-full h-8 bg-white rounded-lg shadow-sm"></div></div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{t('appearanceSettings.light')}</span>
                {!darkMode && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
              </div>
            </div>

            {/* Dark Mode */}
            <div onClick={() => setDarkMode(true)} className="flex flex-col gap-3 group cursor-pointer relative">
              <div className={`w-full aspect-[9/16] rounded-2xl border-4 ${darkMode ? 'border-primary' : 'border-gray-200 dark:border-gray-700'} overflow-hidden relative shadow-lg transition-all duration-200`}>
                <div className="absolute inset-0 bg-[#10221a] flex flex-col">
                  <div className="h-10 bg-[#1a2e25] w-full border-b border-[#233b30]"></div>
                  <div className="p-3"><div className="w-full aspect-video bg-[#1a2e25] rounded-lg border border-[#233b30]"></div></div>
                  <div className="p-3 space-y-2"><div className="w-full h-8 bg-[#1a2e25] rounded-lg border border-[#233b30]"></div><div className="w-full h-8 bg-[#1a2e25] rounded-lg border border-[#233b30]"></div></div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{t('appearanceSettings.dark')}</span>
                {darkMode && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-2 pb-2">{t('appearanceSettings.automatic')}</h3>
          <div className="flex items-center gap-4 bg-white dark:bg-surface-dark px-4 py-3 rounded-xl justify-between shadow-sm">
            <div className="flex flex-col">
              <p className="text-slate-900 dark:text-white text-base font-medium leading-normal">{t('appearanceSettings.useSystemSettings')}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-normal mt-0.5">{t('appearanceSettings.useSystemSettingsDesc')}</p>
            </div>
            <button
              onClick={toggleUseSystemTheme}
              className={`h-6 w-11 rounded-full relative p-1 transition-colors shrink-0 ${useSystemTheme ? 'bg-primary' : 'bg-gray-300 dark:bg-white/10'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full absolute top-1 shadow-sm transition-transform ${useSystemTheme ? 'translate-x-5' : 'translate-x-0'} left-1`}></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
