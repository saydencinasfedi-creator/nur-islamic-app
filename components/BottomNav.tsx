
import React, { useState } from 'react';
import { PageId } from '../types';
import { useUser } from '../contexts/UserContext';
import { TranslationKey } from '../services/i18n';
import { pushBackHandler } from '../services/backHandlerStack';

interface BottomNavProps {
  currentPage: PageId;
  navigate: (page: PageId) => void;
}

// Every shortcut a user can pick for the "+" quick-menu — icons match the ones already
// established for each page elsewhere in the app (e.g. Dashboard's "Quick Access" grid).
// `labelKey` translated lazily inside the component (needs `t`, not available at module scope).
const SHORTCUT_CATALOG: { labelKey: TranslationKey; icon: string; page: PageId }[] = [
  { labelKey: 'bottomNav.shortcutAddDailyGoal', icon: 'add_task', page: 'daily-goals' },
  { labelKey: 'bottomNav.shortcutTasbih', icon: 'touch_app', page: 'tasbih' },
  { labelKey: 'bottomNav.shortcutQibla', icon: 'explore', page: 'qibla' },
  { labelKey: 'bottomNav.shortcutQuran', icon: 'auto_stories', page: 'quran' },
  { labelKey: 'bottomNav.shortcutFullSurahs', icon: 'headphones', page: 'quran-full-surahs' },
  { labelKey: 'bottomNav.shortcutDua', icon: 'pan_tool', page: 'dua' },
  { labelKey: 'bottomNav.shortcutReflections', icon: 'edit_note', page: 'reflections' },
  { labelKey: 'bottomNav.shortcutAiCompanion', icon: 'chat_bubble', page: 'chat' },
  { labelKey: 'bottomNav.shortcutCommunity', icon: 'groups', page: 'community' },
  { labelKey: 'bottomNav.shortcutNotifications', icon: 'notifications', page: 'notifications' },
  { labelKey: 'bottomNav.shortcutProfile', icon: 'person', page: 'profile' },
];

const MAX_QUICK_ACTIONS = 5;

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, navigate }) => {
  const { quickActionPages, setQuickActionPages, t } = useUser();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);

  const quickActions = quickActionPages
    .map(page => SHORTCUT_CATALOG.find(s => s.page === page))
    .filter((s): s is (typeof SHORTCUT_CATALOG)[number] => !!s);

  const handleQuickAction = (page: PageId) => {
    setShowQuickMenu(false);
    navigate(page);
  };

  const toggleShortcut = (page: PageId) => {
    setQuickActionPages(
      quickActionPages.includes(page)
        ? quickActionPages.filter(p => p !== page)
        : quickActionPages.length >= MAX_QUICK_ACTIONS
          ? quickActionPages
          : [...quickActionPages, page]
    );
  };

  React.useEffect(() => {
    if (!showEditSheet) return;
    return pushBackHandler(() => {
      setShowEditSheet(false);
      return true;
    });
  }, [showEditSheet]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[400px] z-50">
      <nav className="bg-white/95 dark:bg-[#1A2E25]/95 backdrop-blur-md rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-gray-200 dark:border-white/10 p-2 flex justify-between items-center px-6 transition-all">
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${currentPage === 'dashboard' ? 'text-primary' : 'text-gray-400 hover:text-primary/70'}`}
        >
          <span className={`material-symbols-outlined ${currentPage === 'dashboard' ? 'filled' : ''}`}>home</span>
        </button>
        <button
          onClick={() => navigate('chat')}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${currentPage === 'chat' ? 'text-primary' : 'text-gray-400 hover:text-primary/70'}`}
        >
          <span className={`material-symbols-outlined ${currentPage === 'chat' ? 'filled' : ''}`}>chat_bubble</span>
        </button>

        <div className="relative">
          {showQuickMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowQuickMenu(false)}></div>
              {/* bottom-[4.75rem] instead of bottom-full -translate-y-3: the FAB below is
                  raised -top-6 (24px) out of flow, and the old -translate-y-3 (12px) gap
                  wasn't enough to clear it, so the menu's bottom edge visually cut across
                  the button's top. */}
              <div className="absolute bottom-[4.75rem] left-1/2 -translate-x-1/2 w-56 bg-white dark:bg-[#1a2e25] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {quickActions.length === 0 ? (
                  <p className="px-3 py-2.5 text-xs text-gray-400 dark:text-white/50">{t('bottomNav.noShortcutsYet')}</p>
                ) : (
                  quickActions.map(action => (
                    <button
                      key={action.page}
                      onClick={() => handleQuickAction(action.page)}
                      className="w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2.5"
                    >
                      <span className="material-symbols-outlined text-lg text-primary">{action.icon}</span>
                      {t(action.labelKey)}
                    </button>
                  ))
                )}
                <div className="h-px bg-gray-100 dark:bg-white/10 my-1"></div>
                <button
                  onClick={() => { setShowQuickMenu(false); setShowEditSheet(true); }}
                  className="w-full text-left px-3 py-2.5 text-sm font-semibold text-gray-500 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2.5"
                >
                  <span className="material-symbols-outlined text-lg">tune</span>
                  {t('bottomNav.editShortcuts')}
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setShowQuickMenu(v => !v)}
            className="relative -top-6 bg-primary text-white rounded-full size-14 shadow-glow flex items-center justify-center border-4 border-background-light dark:border-background-dark transform transition-transform hover:scale-105 active:scale-95"
          >
            <span
              className={`material-symbols-outlined transition-transform duration-200 ${showQuickMenu ? 'rotate-45' : ''}`}
              style={{ fontSize: '28px' }}
            >add</span>
          </button>
        </div>

        <button
          onClick={() => navigate('community')}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${currentPage === 'community' ? 'text-primary' : 'text-gray-400 hover:text-primary/70'}`}
        >
          <span className={`material-symbols-outlined ${currentPage === 'community' ? 'filled' : ''}`}>groups</span>
        </button>
        <button
          onClick={() => navigate('profile')}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-colors ${currentPage === 'profile' ? 'text-primary' : 'text-gray-400 hover:text-primary/70'}`}
        >
          <span className={`material-symbols-outlined ${currentPage === 'profile' ? 'filled' : ''}`}>person</span>
        </button>
      </nav>

      {showEditSheet && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center">
          <div className="absolute inset-0 bg-[#0d121b]/60 backdrop-blur-sm transition-opacity" onClick={() => setShowEditSheet(false)}></div>
          <div className="relative w-full sm:w-[420px] max-h-[80vh] bg-white dark:bg-[#1A2230] rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 sm:pb-8 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>

            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t('bottomNav.editShortcuts')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('bottomNav.pickUpTo', { max: MAX_QUICK_ACTIONS })}</p>
              </div>
              <button
                onClick={() => setShowEditSheet(false)}
                className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-primary transition-all shrink-0"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
              {SHORTCUT_CATALOG.map(item => {
                const selected = quickActionPages.includes(item.page);
                const disabled = !selected && quickActionPages.length >= MAX_QUICK_ACTIONS;
                return (
                  <button
                    key={item.page}
                    onClick={() => toggleShortcut(item.page)}
                    disabled={disabled}
                    className={`w-full flex items-center p-3 rounded-2xl border transition-colors ${selected ? 'bg-background-light dark:bg-gray-800/60 border-primary' : disabled ? 'bg-transparent border-gray-100 dark:border-gray-800 opacity-40' : 'bg-transparent border-gray-100 dark:border-gray-700/50 hover:border-primary/50'}`}
                  >
                    <div className="size-10 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-primary mr-4 shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
                    </div>
                    <h3 className={`flex-1 text-left font-bold ${selected ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{t(item.labelKey)}</h3>
                    {selected && (
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary text-white shadow-sm shadow-primary/30">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottomNav;
