
import React from 'react';
import { useUser } from '../contexts/UserContext';
import { Language } from '../services/i18n';

interface LanguageSettingsProps {
  onBack: () => void;
}

export const LANGUAGES: { code: Language; name: string; sub: string; font?: string }[] = [
  { code: 'en', name: 'English', sub: 'Default' },
  { code: 'es', name: 'Español', sub: 'Spanish' },
  { code: 'ar', name: 'العربية', sub: 'Arabic', font: 'font-arabic' },
  { code: 'id', name: 'Bahasa Indonesia', sub: 'Indonesian' },
  { code: 'tr', name: 'Türkçe', sub: 'Turkish' },
  { code: 'ur', name: 'اردو', sub: 'Urdu', font: 'font-urdu' },
  { code: 'fr', name: 'Français', sub: 'French' },
  { code: 'ms', name: 'Melayu', sub: 'Malay' },
];

const LanguageSettings: React.FC<LanguageSettingsProps> = ({ onBack }) => {
  const { language, setLanguage, t } = useUser();

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark font-display antialiased text-slate-900 dark:text-white transition-colors duration-200">
      <div
        className="flex items-center bg-background-light dark:bg-background-dark px-4 pb-2 justify-between backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 border-b border-gray-200 dark:border-[#1a2e25]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <button onClick={onBack} className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-start cursor-pointer transition-opacity hover:opacity-70">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('languageSettings.title')}</h2>
        <button onClick={onBack} className="flex w-12 items-center justify-end cursor-pointer transition-opacity hover:opacity-70">
          <p className="text-primary text-base font-bold leading-normal tracking-[0.015em] shrink-0">{t('languageSettings.done')}</p>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10 pt-6 px-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 px-2 font-medium">{t('languageSettings.selectPreferred')}</p>
        <div className="flex flex-col overflow-hidden rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          {LANGUAGES.map(lang => (
            <div
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className="flex items-center justify-between p-5 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-700/30 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#254134] transition-colors group"
            >
              <div className="flex flex-col">
                <span className={`text-slate-900 dark:text-white text-base font-semibold ${lang.font || ''}`}>{lang.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{lang.sub}</span>
              </div>
              {language === lang.code && <span className="material-symbols-outlined text-primary text-[24px]">check</span>}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center mt-8 px-8 text-center">
          <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 mb-2 text-3xl">translate</span>
          <p className="text-gray-400 dark:text-gray-500 text-xs leading-relaxed">
            {t('languageSettings.missingLanguageHint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LanguageSettings;
