import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import type { TranslationKey } from '../services/i18n';
import type { AgeRange } from '../types';

// Shown once, right after the first real sign-in, to give the account a public
// display name (the only required field). Avatar upload lands with the Community
// storage work; age range is optional and only ever surfaced as a range.
const AGE_RANGES: { value: AgeRange; labelKey: TranslationKey }[] = [
  { value: 'teens', labelKey: 'profileSetup.ageTeens' },
  { value: '18-24', labelKey: 'profileSetup.age1824' },
  { value: '25-34', labelKey: 'profileSetup.age2534' },
  { value: '35+', labelKey: 'profileSetup.age35' },
];

const ProfileSetup: React.FC = () => {
  const { t, user } = useUser();
  const { saveProfile, profile } = useAuth();

  const initialName = (() => {
    try { return sessionStorage.getItem('nurPendingDisplayName') || ''; } catch { return ''; }
  })();

  const [displayName, setDisplayName] = useState(profile?.displayName || initialName);
  const [bio, setBio] = useState(profile?.bio || '');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(profile?.ageRange ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2 || busy) return;
    setBusy(true);
    setError('');
    try {
      await saveProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        ageRange: ageRange ?? undefined,
        // Carries over a photo already set locally (the "local" and Community
        // profiles are separate records) so it doesn't take a second upload.
        avatarUrl: user?.avatar ?? undefined,
      });
      try { sessionStorage.removeItem('nurPendingDisplayName'); } catch { /* ignore */ }
      // App.tsx routes to the dashboard once needsProfileSetup clears.
    } catch (err: any) {
      setError(err?.message || t('profileSetup.saveError'));
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white transition-colors duration-200">
      <div className="flex items-center justify-center p-6 pt-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/80 to-[#0c8e56] flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-background-dark text-xl">diversity_3</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pb-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">{t('profileSetup.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
            {t('profileSetup.subtitle')}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1 block">
              {t('profileSetup.displayNameLabel')}
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3"
              placeholder={t('profileSetup.displayNamePlaceholder')}
              required
              autoFocus
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">{t('profileSetup.displayNameHint')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1 block">
              {t('profileSetup.bioLabel')}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              rows={3}
              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3 resize-none"
              placeholder={t('profileSetup.bioPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1 block">
              {t('profileSetup.ageRangeLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_RANGES.map((a) => {
                const selected = ageRange === a.value;
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAgeRange(selected ? null : a.value)}
                    className={`h-10 px-4 rounded-full text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-primary text-background-dark border-primary shadow-glow'
                        : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {t(a.labelKey)}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">{t('profileSetup.ageRangeHint')}</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy || displayName.trim().length < 2}
            className="w-full rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-glow"
          >
            {busy
              ? <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin"></span>
              : <><span>{t('profileSetup.continue')}</span><span className="material-symbols-outlined text-xl">arrow_forward</span></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetup;
