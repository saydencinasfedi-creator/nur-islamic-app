
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { PageId } from './types';
import { consumeBackPress } from './services/backHandlerStack';

// The fixed "Up" destination for each screen — where the system back button/gesture should
// go, regardless of the actual path the user took to get here. Screens without an entry
// here (onboarding, dashboard) are tree roots: back on those exits the app.
// Pre-login screens shouldn't reserve space for the camera-cutout safe area —
// unlike the rest of the app, they have no fixed header/content that would sit
// under the cutout, so the safe-area strip just reads as unwanted empty space.
const NO_SAFE_AREA_PAGES: Partial<Record<PageId, true>> = {
  onboarding: true,
  auth: true,
  'email-login': true,
  'create-account': true,
  'google-login': true,
  'private-id': true,
  settings: true,
  language: true,
  appearance: true,
  'data-privacy': true,
};

// Pages that show the bottom nav bar. Hoisted here (instead of each page rendering its own
// <BottomNav>) so it survives navigation instead of being unmounted/remounted — and re-playing
// its entrance animation — every time `currentPage` changes the key={currentPage} wrapper below.
const SHOW_BOTTOM_NAV: Partial<Record<PageId, true>> = {
  dashboard: true,
  chat: true,
  profile: true,
  tasbih: true,
  community: true,
  quran: true,
};

const PARENT_PAGE: Partial<Record<PageId, PageId>> = {
  auth: 'onboarding',
  'email-login': 'auth',
  'create-account': 'email-login',
  'google-login': 'auth',
  'private-id': 'auth',
  salat: 'dashboard',
  tasbih: 'dashboard',
  qibla: 'dashboard',
  quran: 'dashboard',
  dua: 'dashboard',
  chat: 'dashboard',
  community: 'dashboard',
  profile: 'dashboard',
  settings: 'profile',
  appearance: 'settings',
  language: 'settings',
  'data-privacy': 'settings',
  'content-ai': 'settings',
  notifications: 'dashboard',
  'daily-goals': 'dashboard',
  'help-center': 'settings',
  'quran-full-surahs': 'quran',
  reflections: 'dashboard',
};
import Dashboard from './pages/Dashboard';
import Tasbih from './pages/Tasbih';
import Salat from './pages/Salat';
import Qibla from './pages/Qibla';
import Quran from './pages/Quran';
import Supplications from './pages/Supplications';
import AICompanion from './pages/AICompanion';
import Community from './pages/Community';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AppearanceSettings from './pages/AppearanceSettings';
import LanguageSettings from './pages/LanguageSettings';
import DataPrivacy from './pages/DataPrivacy';
import ContentAI from './pages/ContentAI';
import HelpCenter from './pages/HelpCenter';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import PrivateIDConfirmation from './pages/PrivateIDConfirmation';
import EmailAuth from './pages/EmailAuth';
import GoogleLogin from './pages/GoogleLogin';
import CreateAccount from './pages/CreateAccount';
import Notifications from './pages/Notifications';
import DailyGoals from './pages/DailyGoals';
import QuranFullSurahs from './pages/QuranFullSurahs';
import Reflections from './pages/Reflections';
import BottomNav from './components/BottomNav';
import { UserProvider, useUser } from './contexts/UserContext';
import { useNotificationEngine } from './hooks/useNotificationEngine';

// Screens that make up the "Settings" section — used to detect entering/leaving the whole
// flow so unsaved theme/notification changes can be discarded on any exit that isn't the
// Settings screen's own "Done" button (back arrow, hardware back, etc.).
const SETTINGS_SECTION_PAGES: Partial<Record<PageId, true>> = {
  settings: true,
  appearance: true,
  language: true,
  'data-privacy': true,
  'content-ai': true,
  'help-center': true,
};

const AppContent: React.FC = () => {
  const { user, updateUser, signOut, updateLocation, markGoalDone } = useUser();
  useNotificationEngine();
  // Skip onboarding/auth entirely if a session was already persisted locally.
  const [currentPage, setCurrentPage] = useState<PageId>(user?.name ? 'dashboard' : 'onboarding');
  const currentPageRef = useRef(currentPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  // Theme: persisted across launches (previously reset to dark every time), with an
  // optional "follow the OS" mode. Picking Light/Dark manually (setDarkMode below) always
  // turns useSystemTheme back off — an explicit choice overrides following the system.
  const [useSystemTheme, setUseSystemThemeState] = useState<boolean>(() => {
    return localStorage.getItem('nurUseSystemTheme') === 'true';
  });
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    if (localStorage.getItem('nurUseSystemTheme') === 'true') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    const saved = localStorage.getItem('nurDarkMode');
    return saved !== null ? saved === 'true' : true;
  });
  const setDarkMode = useCallback((val: boolean) => {
    setUseSystemThemeState(false);
    localStorage.setItem('nurUseSystemTheme', 'false');
    setDarkModeState(val);
    localStorage.setItem('nurDarkMode', String(val));
  }, []);
  const toggleUseSystemTheme = useCallback(() => {
    setUseSystemThemeState(prev => {
      const next = !prev;
      localStorage.setItem('nurUseSystemTheme', String(next));
      if (next) setDarkModeState(window.matchMedia('(prefers-color-scheme: dark)').matches);
      return next;
    });
  }, []);
  useEffect(() => {
    if (!useSystemTheme) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDarkModeState(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [useSystemTheme]);
  // Snapshot of theme state taken the moment the Settings section is entered, so a Light/Dark/
  // System change made in Appearance can be reverted if the user leaves without tapping
  // Appearance's own "Done" — an explicit "changed my mind".
  const settingsSnapshotRef = useRef<{ darkMode: boolean; useSystemTheme: boolean } | null>(null);
  const restoreSettingsDraft = useCallback((snapshot: { darkMode: boolean; useSystemTheme: boolean }) => {
    setUseSystemThemeState(snapshot.useSystemTheme);
    localStorage.setItem('nurUseSystemTheme', String(snapshot.useSystemTheme));
    const resolvedDark = snapshot.useSystemTheme ? window.matchMedia('(prefers-color-scheme: dark)').matches : snapshot.darkMode;
    setDarkModeState(resolvedDark);
    localStorage.setItem('nurDarkMode', String(snapshot.darkMode));
  }, []);

  const [showExitToast, setShowExitToast] = useState(false);
  // Lets a page (currently only the Quran reader) hide the hoisted bottom nav for its own
  // immersive sub-view without App.tsx needing to know about that page's internal state.
  const [navHiddenOverride, setNavHiddenOverride] = useState(false);
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Try to get location on mount
  useEffect(() => {
    updateLocation();
  }, []);

  const navigate = useCallback((page: PageId) => {
    const wasInSettingsSection = !!SETTINGS_SECTION_PAGES[currentPageRef.current];
    const willBeInSettingsSection = !!SETTINGS_SECTION_PAGES[page];
    if (!wasInSettingsSection && willBeInSettingsSection) {
      settingsSnapshotRef.current = { darkMode, useSystemTheme };
    } else if (wasInSettingsSection && !willBeInSettingsSection && settingsSnapshotRef.current) {
      restoreSettingsDraft(settingsSnapshotRef.current);
      settingsSnapshotRef.current = null;
    }
    setCurrentPage(page);
    setNavHiddenOverride(false);
    window.scrollTo(0, 0);
  }, [darkMode, useSystemTheme, restoreSettingsDraft]);

  // Appearance's "Done" button: the only way out of the section that keeps whatever
  // theme was changed, instead of reverting to the snapshot taken on entry. Returns to
  // Settings (its parent), not all the way out to Profile.
  const commitSettingsAndExit = useCallback(() => {
    settingsSnapshotRef.current = null;
    navigate('settings');
  }, [navigate]);

  // Hardware back button / edge swipe: let any open sub-view (e.g. the Quran reader)
  // claim it first; otherwise walk up to this screen's fixed parent, or exit at the root.
  // At the Dashboard specifically, the first press just arms a "press again to exit"
  // toast instead of closing immediately, matching the double-back pattern most apps use.
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (consumeBackPress()) return;

      const parent = PARENT_PAGE[currentPageRef.current];
      if (parent) {
        navigate(parent);
        return;
      }

      if (currentPageRef.current === 'dashboard') {
        if (exitArmedRef.current) {
          CapacitorApp.exitApp();
          return;
        }
        exitArmedRef.current = true;
        setShowExitToast(true);
        if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = window.setTimeout(() => {
          exitArmedRef.current = false;
          setShowExitToast(false);
        }, 2000);
        return;
      }

      CapacitorApp.exitApp();
    });
    return () => {
      listenerPromise.then(handle => handle.remove());
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, [navigate]);

  const handleLogin = (name: string) => {
    updateUser({
      name,
      memberSince: 'Oct 2023',
      isPremium: true,
      privateId: '8821 4902 1193'
    });
    navigate('dashboard');
  };

  const handleSignOut = () => {
    signOut();
    navigate('onboarding');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'onboarding': return <Onboarding onStart={() => navigate('auth')} />;
      case 'auth': return <Auth onBack={() => navigate('onboarding')} onLogin={handleLogin} onGenerateID={() => navigate('private-id')} onEmailLogin={() => navigate('email-login')} onGoogleLogin={() => navigate('google-login')} />;
      case 'email-login': return <EmailAuth onBack={() => navigate('auth')} onLogin={(email) => handleLogin(email)} onCreateAccount={() => navigate('create-account')} />;
      case 'create-account': return <CreateAccount onBack={() => navigate('email-login')} onSignUp={(name) => handleLogin(name)} onLogin={() => navigate('email-login')} />;
      case 'google-login': return <GoogleLogin onBack={() => navigate('auth')} onLogin={() => handleLogin('Google User')} />;
      case 'private-id': return <PrivateIDConfirmation onBack={() => navigate('auth')} onStart={() => handleLogin('Guest User')} />;
      case 'dashboard': return <Dashboard navigate={navigate} user={user} />;
      case 'salat': return <Salat navigate={navigate} onBack={() => navigate('dashboard')} onComplete={() => markGoalDone('Salat')} />;
      case 'tasbih': return <Tasbih navigate={navigate} onBack={() => navigate('dashboard')} onComplete={() => markGoalDone('Dhikr')} />;
      case 'qibla': return <Qibla onBack={() => navigate('dashboard')} />;
      case 'quran': return <Quran navigate={navigate} onBack={() => navigate('dashboard')} onRead={() => markGoalDone('Quran')} setNavHidden={setNavHiddenOverride} />;
      case 'quran-full-surahs': return <QuranFullSurahs navigate={navigate} onBack={() => navigate('quran')} onRead={() => markGoalDone('Quran')} />;
      case 'reflections': return <Reflections navigate={navigate} onBack={() => navigate('dashboard')} />;
      case 'dua': return <Supplications navigate={navigate} onBack={() => navigate('dashboard')} />;
      case 'chat': return <AICompanion navigate={navigate} user={user} />;
      case 'community': return <Community navigate={navigate} />;
      case 'profile': return <Profile navigate={navigate} user={user} onSignOut={handleSignOut} />;
      case 'settings': return <Settings navigate={navigate} onBack={() => navigate('profile')} darkMode={darkMode} useSystemTheme={useSystemTheme} />;
      case 'appearance': return <AppearanceSettings darkMode={darkMode} setDarkMode={setDarkMode} useSystemTheme={useSystemTheme} toggleUseSystemTheme={toggleUseSystemTheme} onBack={() => navigate('settings')} onDone={commitSettingsAndExit} />;
      case 'language': return <LanguageSettings onBack={() => navigate('settings')} />;
      case 'data-privacy': return <DataPrivacy onBack={() => navigate('settings')} />;
      case 'content-ai': return <ContentAI onBack={() => navigate('settings')} />;
      case 'notifications': return <Notifications onBack={() => navigate('dashboard')} />;
      case 'daily-goals': return <DailyGoals onBack={() => navigate('dashboard')} />;
      case 'help-center': return <HelpCenter onBack={() => navigate('settings')} />;
      default: return <Dashboard navigate={navigate} user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display transition-colors duration-200">
      <div
        className="max-w-md mx-auto relative min-h-screen shadow-2xl bg-white dark:bg-background-dark"
        style={{ paddingTop: NO_SAFE_AREA_PAGES[currentPage] ? '0px' : 'env(safe-area-inset-top, 0px)' }}
      >
        <div key={currentPage} className="page-transition">
          {renderPage()}
        </div>

        {SHOW_BOTTOM_NAV[currentPage] && !navHiddenOverride && (
          <BottomNav currentPage={currentPage} navigate={navigate} />
        )}

        {showExitToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-black/85 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-xl pointer-events-none">
            Pulsa de nuevo para salir
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
};

export default App;
