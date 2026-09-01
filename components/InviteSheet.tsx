import React, { useEffect, useState } from 'react';
import { Share } from '@capacitor/share';
import { useUser } from '../contexts/UserContext';
import CommunitySheet, { sheetField, sheetLabel, sheetPrimaryBtn } from './CommunitySheet';
import * as community from '../services/communityService';
import { buildInviteLink } from '../services/authService';
import type { GroupInvite } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groupId?: string | null;   // set when managing a specific circle's invites
  isAdmin?: boolean;
  initialCode?: string;      // pre-fill the redeem field, e.g. from a tapped invite link
  onRedeemed?: (groupId: string) => void;
}

const InviteSheet: React.FC<Props> = ({ isOpen, onClose, groupId, isAdmin, initialCode, onRedeemed }) => {
  const { t } = useUser();
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(''); setCode(initialCode ?? '');
    if (groupId && isAdmin) {
      community.listInvites(groupId).then(setInvites).catch(() => setInvites([]));
    } else {
      setInvites([]);
    }
  }, [isOpen, groupId, isAdmin, initialCode]);

  const generate = async () => {
    if (!groupId || busy) return;
    setBusy(true);
    try {
      await community.generateInvite(groupId);
      setInvites(await community.listInvites(groupId));
    } catch (e: any) {
      setError(e?.message || t('community.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await community.revokeInvite(id);
      if (groupId) setInvites(await community.listInvites(groupId));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (c: string) => {
    try { await navigator.clipboard.writeText(c); setCopied(c); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  // Matches Dashboard/Supplications' Share.share(...).catch(() => {}) pattern — a
  // dismissed share sheet also rejects the promise, so errors are silently ignored.
  const share = (c: string) => {
    const link = buildInviteLink(c);
    Share.share({ title: t('community.inviteTitle'), text: t('community.inviteShareMessage', { link }) }).catch(() => {});
  };

  const redeem = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const gid = await community.redeemInvite(code.trim());
      onRedeemed?.(gid);
      onClose();
    } catch (e: any) {
      setError(/invalid|expired|exhausted/i.test(e?.message || '') ? t('community.inviteInvalid') : (e?.message || t('community.errorGeneric')));
    } finally {
      setBusy(false);
    }
  };

  const activeInvites = invites.filter(i => !i.revokedAt);

  return (
    <CommunitySheet isOpen={isOpen} onClose={onClose} title={t('community.inviteTitle')}>
      {groupId && isAdmin && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('community.inviteCodeSub')}</p>
          {activeInvites.map(inv => (
            <div key={inv.id} className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3">
              <code className="flex-1 font-mono text-sm text-slate-900 dark:text-white tracking-wider">{inv.code}</code>
              <button onClick={() => share(inv.code)} className="text-gray-500 dark:text-gray-400 hover:text-primary" title={t('community.shareLink')}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
              </button>
              <button onClick={() => copy(inv.code)} className="text-xs font-bold text-primary">{copied === inv.code ? t('community.codeCopied') : t('community.copyCode')}</button>
              <button onClick={() => revoke(inv.id)} className="text-xs font-bold text-red-500 dark:text-red-400">{t('community.revokeCode')}</button>
            </div>
          ))}
          <button onClick={generate} disabled={busy} className="w-full py-2.5 rounded-xl text-sm font-bold border border-dashed border-gray-300 dark:border-white/15 text-slate-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            + {t('community.generateCode')}
          </button>
        </div>
      )}

      {onRedeemed && (
        <div>
          <label className={sheetLabel}>{t('community.enterCodeLabel')}</label>
          <input value={code} onChange={e => setCode(e.target.value.trim())} placeholder={t('community.enterCodePlaceholder')} className={sheetField} />
          <button onClick={redeem} disabled={busy || !code.trim()} className={`${sheetPrimaryBtn(!busy && !!code.trim())} mt-3`}>
            {busy ? '…' : t('community.redeemCode')}
          </button>
        </div>
      )}

      {error && <div className="text-sm text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</div>}
    </CommunitySheet>
  );
};

export default InviteSheet;
