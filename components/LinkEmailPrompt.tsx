import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import CommunitySheet, { sheetField, sheetLabel, sheetPrimaryBtn } from './CommunitySheet';

// Shown when a guest (anonymous session) tries a write action. Links an email to
// the anonymous account via updateUser — the guest's data is kept.
const LinkEmailPrompt: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { t } = useUser();
  const { linkEmailToGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await linkEmailToGuest(email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e?.message || t('community.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommunitySheet isOpen={isOpen} onClose={onClose} title={t('community.guestGateTitle')}>
      {sent ? (
        <p className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-xl p-3">
          {t('community.guestEmailSent', { email: email.trim() })}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t('community.guestGateBody')}</p>
          <div>
            <label className={sheetLabel}>{t('community.guestEmailLabel')}</label>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('community.guestEmailPlaceholder')}
              className={sheetField}
              autoFocus
            />
          </div>
          {error && (
            <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>
          )}
          <button disabled={busy || !email.trim()} onClick={submit} className={sheetPrimaryBtn(!busy && !!email.trim())}>
            {busy ? '…' : t('community.linkEmail')}
          </button>
        </>
      )}
    </CommunitySheet>
  );
};

export default LinkEmailPrompt;
