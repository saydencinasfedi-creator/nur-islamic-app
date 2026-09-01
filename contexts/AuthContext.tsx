import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import {
  signUpWithPassword, signInWithPassword, verifySignupOtp, resendConfirmation,
  sendPasswordReset, verifyRecoveryOtp, updatePassword,
  sendEmailOtp, verifyEmailOtp, signInWithGoogle, signInAsGuest,
  linkEmailToGuest, signOut as authSignOut, bindOAuthDeepLink,
  fetchMyProfile, upsertMyProfile, type ProfileDraft,
} from '../services/authService';
import type { CommunityProfile } from '../types';

interface AuthContextValue {
  /** True when the build has no Supabase credentials — the app falls back to the
   *  legacy local-only gate and Community is unavailable. */
  bypassed: boolean;
  authLoading: boolean;
  session: Session | null;
  authUserId: string | null;
  isGuest: boolean;
  profile: CommunityProfile | null;
  /** A real session exists but the profile still has no display name. */
  needsProfileSetup: boolean;
  /** The current session came from a password-recovery link — force the reset screen. */
  recoveryMode: boolean;

  signUpWithPassword: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  linkEmailToGuest: (email: string) => Promise<void>;
  saveProfile: (draft: ProfileDraft) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessionResolved, setSessionResolved] = useState(!isSupabaseConfigured);
  const [profileResolved, setProfileResolved] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const loadedProfileFor = useRef<string | null>(null);

  const authUserId = session?.user?.id ?? null;
  const isGuest = !!session?.user?.is_anonymous;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    bindOAuthDeepLink(() => setRecoveryMode(true));

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setSessionResolved(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next ?? null);
      setSessionResolved(true);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (!next) {
        setProfile(null);
        setProfileResolved(true);
        loadedProfileFor.current = null;
        setRecoveryMode(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the profile once per signed-in user.
  useEffect(() => {
    if (!authUserId) return;
    if (loadedProfileFor.current === authUserId) return;
    loadedProfileFor.current = authUserId;
    setProfileResolved(false);
    fetchMyProfile(authUserId)
      .then((p) => setProfile(p))
      .catch((e) => console.warn('[Nur] profile load failed:', e))
      .finally(() => setProfileResolved(true));
  }, [authUserId]);

  const refreshProfile = async () => {
    if (!authUserId) return;
    setProfile(await fetchMyProfile(authUserId));
  };

  const changePassword = async (newPassword: string) => {
    await updatePassword(newPassword);
    setRecoveryMode(false);
  };

  const saveProfile = async (draft: ProfileDraft) => {
    if (!authUserId) throw new Error('not_authenticated');
    setProfile(await upsertMyProfile(authUserId, draft));
  };

  // Wait for the session AND (when signed in) the first profile fetch, so the app
  // never flashes the profile-setup screen while the profile is still loading.
  const authLoading = isSupabaseConfigured && (!sessionResolved || (!!session && !profileResolved));

  const needsProfileSetup =
    !!session && !isGuest && profileResolved && (!profile || !profile.displayName.trim());

  const value = useMemo<AuthContextValue>(() => ({
    bypassed: !isSupabaseConfigured,
    authLoading,
    session,
    authUserId,
    isGuest,
    profile,
    needsProfileSetup,
    recoveryMode,
    signUpWithPassword,
    signInWithPassword,
    verifySignupOtp,
    resendConfirmation,
    sendPasswordReset,
    verifyRecoveryOtp,
    updatePassword: changePassword,
    sendEmailOtp,
    verifyEmailOtp,
    signInWithGoogle,
    signInAsGuest,
    linkEmailToGuest,
    saveProfile,
    refreshProfile,
    signOut: authSignOut,
  }), [authLoading, session, authUserId, isGuest, profile, needsProfileSetup, recoveryMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
