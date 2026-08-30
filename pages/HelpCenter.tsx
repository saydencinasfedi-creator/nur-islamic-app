
import React from 'react';
import { useUser } from '../contexts/UserContext';

interface HelpCenterProps {
  onBack: () => void;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ onBack }) => {
  const { t } = useUser();
  const categories = [
    { key: 'helpCenter.categoryGuides', icon: 'book', bg: 'bg-blue-50 dark:bg-blue-900/20', color: 'text-blue-600 dark:text-blue-400' },
    { key: 'helpCenter.categoryPrivacy', icon: 'shield_person', bg: 'bg-purple-50 dark:bg-purple-900/20', color: 'text-purple-600 dark:text-purple-400' }
  ] as const;
  const faqs = [
    'helpCenter.faqAdjustPrayerTimes',
    'helpCenter.faqDataPrivate',
    'helpCenter.faqAiContent',
    'helpCenter.faqCancelSubscription',
  ] as const;

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark font-display antialiased text-slate-900 dark:text-white transition-colors duration-200">
      <div className="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky sticky-safe-top z-50 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90 border-b border-gray-200 dark:border-[#1a2e25]">
        <button onClick={onBack} className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-start cursor-pointer transition-opacity hover:opacity-70">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('helpCenter.title')}</h2>
        <div className="w-12"></div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="p-4 pt-6">
          <div className="flex flex-col gap-2 mb-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t('helpCenter.heading')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('helpCenter.subheading')}</p>
          </div>
          <div className="relative mt-4 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">search</span>
            </div>
            <input className="block w-full pl-10 pr-3 py-3 border-none rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" placeholder={t('helpCenter.searchPlaceholder')} type="text"/>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-4 mb-8">
          {categories.map(cat => (
            <div key={cat.key} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-[#233b30] cursor-pointer transition-colors border border-transparent hover:border-primary/20">
              <div className={`p-3 ${cat.bg} rounded-full mb-3 ${cat.color}`}>
                <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
              </div>
              <span className="font-semibold text-sm text-slate-900 dark:text-white">{t(cat.key)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-6 pb-2">{t('helpCenter.commonQuestions')}</h3>
          <div className="flex flex-col bg-white dark:bg-surface-dark mx-4 rounded-xl shadow-sm overflow-hidden">
            {faqs.map((q, i) => (
              <div key={q} className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#233b30] transition-colors ${i !== faqs.length - 1 ? 'border-b border-gray-100 dark:border-[#10221a]' : ''}`}>
                <span className="text-slate-900 dark:text-white font-medium text-sm">{t(q)}</span>
                <span className="material-symbols-outlined text-gray-400">add</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col mt-8 mb-4">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm font-semibold uppercase tracking-wider px-6 pb-2">{t('helpCenter.contactSupport')}</h3>
          <div className="flex flex-col gap-3 px-4">
            <div className="flex items-center gap-4 bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm cursor-pointer hover:ring-2 hover:ring-primary transition-all">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined">chat_bubble</span>
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-slate-900 dark:text-white font-bold text-sm">{t('helpCenter.chatWithUs')}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{t('helpCenter.repliesTime')}</span>
              </div>
              <span className="material-symbols-outlined text-gray-400">chevron_right</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
