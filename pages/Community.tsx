import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageId } from '../types';
import type {
  Group, GroupMember, GroupChallenge, GroupReflection, GroupReflectionComment,
  DuaRequest, GlobalSalawat, ReactionEmoji, QuranReference, DMThread, CommunityProfile,
} from '../types';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { pushBackHandler } from '../services/backHandlerStack';
import { setPendingQuranTarget } from '../services/reflectionsNav';
import { setReturnToCommunity, consumeReturnToCommunity, consumePendingCommunityTarget } from '../services/communityNav';
import * as community from '../services/communityService';
import type { ReactionSummary } from '../services/communityService';
import * as dm from '../services/dmService';
import { subscribeSalawat, subscribeDuaRequests } from '../services/communityRealtime';
import { rearmChallengeNotifications } from '../services/communityNotifications';
import Avatar from '../components/Avatar';
import GoalIcon from '../components/GoalIcon';
import MarkdownContent from '../components/MarkdownContent';
import PrivacyBadge from '../components/PrivacyBadge';
import ReactionBar from '../components/ReactionBar';
import GroupFormSheet from '../components/GroupFormSheet';
import ChallengeFormSheet from '../components/ChallengeFormSheet';
import DuaComposeSheet from '../components/DuaComposeSheet';
import GroupPickerSheet from '../components/GroupPickerSheet';
import InviteSheet from '../components/InviteSheet';
import ReportSheet from '../components/ReportSheet';
import LinkEmailPrompt from '../components/LinkEmailPrompt';
import ChatTab from './community/ChatTab';
import GroupReflectionEditor from './community/GroupReflectionEditor';
import MessagesTab from './community/MessagesTab';
import DMThreadView from './community/DMThreadView';
import type { TranslationKey } from '../services/i18n';

interface CommunityProps {
  navigate: (page: PageId) => void;
  // The bottom nav is hoisted up to App.tsx — this lets any pushed sub-view
  // (circle detail, chat, DM thread, …) hide it, since App.tsx has no
  // visibility into this page's internal `view` state. Same pattern as Quran.
  setNavHidden?: (hidden: boolean) => void;
}

type TopTab = 'home' | 'challenges' | 'circles' | 'duas';
type View = 'top' | 'circle' | 'circle-create' | 'circle-edit' | 'challenge' | 'greflection' | 'greflection-editor' | 'dm-thread';
type CircleTab = 'info' | 'chat' | 'reflections' | 'challenges' | 'members';
type CirclesSubTab = 'circles' | 'messages';

const CAT_KEY: Record<string, TranslationKey> = {
  quran: 'community.catQuran', salah: 'community.catSalah', hadith: 'community.catHadith',
  ramadan: 'community.catRamadan', self_dev: 'community.catSelfDev', brotherhood: 'community.catBrotherhood',
  sisters: 'community.catSisters', memorization: 'community.catMemorization', arabic: 'community.catArabic',
  general: 'community.catGeneral', other: 'community.catOther',
};

const circleIcon = (g: Pick<Group, 'avatarUrl'>) => ({
  icon: g.avatarUrl && !g.avatarUrl.startsWith('data:') ? g.avatarUrl : 'groups',
  iconImage: g.avatarUrl && g.avatarUrl.startsWith('data:') ? g.avatarUrl : undefined,
});
const challengeIcon = (c: Pick<GroupChallenge, 'icon'>) => ({
  icon: c.icon && !c.icon.startsWith('data:') ? c.icon : 'local_fire_department',
  iconImage: c.icon && c.icon.startsWith('data:') ? c.icon : undefined,
});
const fmtDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ===========================================================================

const Community: React.FC<CommunityProps> = ({ navigate, setNavHidden }) => {
  const { t } = useUser();
  const { bypassed, isGuest, authUserId, pendingInviteCode, clearPendingInviteCode } = useAuth();

  const [view, setView] = useState<View>('top');
  const [topTab, setTopTab] = useState<TopTab>('home');
  const [circleTab, setCircleTab] = useState<CircleTab>('chat');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const [activeReflectionId, setActiveReflectionId] = useState<string | null>(null);
  const [editReflection, setEditReflection] = useState<GroupReflection | null>(null);
  const [reflectionPrefillRef, setReflectionPrefillRef] = useState<QuranReference | null>(null);
  const [activeThread, setActiveThread] = useState<DMThread | null>(null);
  const challengeReturn = useRef<'top' | 'circle'>('top');

  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [guestGate, setGuestGate] = useState(false);
  const [inviteCodeToRedeem, setInviteCodeToRedeem] = useState<string | null>(null);

  // top-level data
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [salawat, setSalawat] = useState<GlobalSalawat | null>(null);

  const refs = useRef<Record<string, HTMLElement | null>>({});

  // Guard: block a write action for guests, opening the link-email sheet.
  const guard = useCallback((): boolean => {
    if (isGuest) { setGuestGate(true); return true; }
    return false;
  }, [isGuest]);

  // ---- initial load ----
  useEffect(() => {
    if (bypassed) return;
    community.amIAppAdmin().then(setIsAppAdmin).catch(() => {});
    community.listMyGroups().then(setMyGroups).catch(() => {});
    community.getSalawat().then(setSalawat).catch(() => {});
    // deep-link / Qur'an round-trip restore
    const back = consumeReturnToCommunity();
    if (back) {
      setActiveGroupId(back.groupId);
      if (back.view === 'greflection' && back.reflectionId) {
        setActiveReflectionId(back.reflectionId);
        setCircleTab('reflections');
        setView('greflection');
      } else {
        setCircleTab('reflections');
        setView('circle');
      }
      return;
    }
    const target = consumePendingCommunityTarget();
    if (target) { setActiveGroupId(target.groupId); setCircleTab('chat'); setView('circle'); }
  }, [bypassed]);

  // ---- invite link (com.fedi.nur://invite/<code>) tapped ----
  useEffect(() => {
    if (!pendingInviteCode) return;
    setInviteCodeToRedeem(pendingInviteCode);
    setTopTab('circles');
    setView('top');
    setActiveGroupId(null);
    clearPendingInviteCode();
  }, [pendingInviteCode, clearPendingInviteCode]);

  // ---- realtime: salawat ----
  useEffect(() => {
    if (bypassed) return;
    return subscribeSalawat(setSalawat);
  }, [bypassed]);

  // Hide the floating bottom nav on every pushed sub-view (circle detail, chat,
  // reflection, challenge, DM thread, …) — it only makes sense at the top level.
  useEffect(() => {
    setNavHidden?.(view !== 'top');
    return () => setNavHidden?.(false);
  }, [view, setNavHidden]);

  // ---- hardware back ----
  useEffect(() => {
    return pushBackHandler(() => {
      if (view === 'dm-thread') { setView('top'); setActiveThread(null); return true; }
      if (view === 'greflection-editor') { setReflectionPrefillRef(null); setView(editReflection ? 'greflection' : 'circle'); return true; }
      if (view === 'greflection') { setView('circle'); setActiveReflectionId(null); return true; }
      if (view === 'challenge') { setView(challengeReturn.current === 'circle' ? 'circle' : 'top'); setActiveChallengeId(null); return true; }
      if (view === 'circle-edit') { setView('circle'); return true; }
      if (view === 'circle-create') { setView('top'); return true; }
      if (view === 'circle') { setView('top'); setActiveGroupId(null); return true; }
      navigate('dashboard');
      return true;
    });
  }, [view, editReflection, navigate]);

  const refreshMyGroups = () => community.listMyGroups().then(setMyGroups).catch(() => {});

  const openCircle = (id: string, tab: CircleTab = 'chat') => { setActiveGroupId(id); setCircleTab(tab); setView('circle'); };
  const openChallenge = (id: string, from: 'top' | 'circle') => { challengeReturn.current = from; setActiveChallengeId(id); setView('challenge'); };

  if (bypassed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8 bg-background-light dark:bg-background-dark">
        <span className="material-symbols-outlined text-5xl text-gray-400 mb-3">cloud_off</span>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('community.unavailable')}</p>
      </div>
    );
  }

  // =======================================================================
  // shell
  // =======================================================================
  if (view === 'greflection-editor' && activeGroupId) {
    return (
      <GroupReflectionEditor
        groupId={activeGroupId}
        existing={editReflection}
        prefillRef={reflectionPrefillRef}
        onCancel={() => { setReflectionPrefillRef(null); setView(editReflection ? 'greflection' : 'circle'); }}
        onDone={saved => {
          setEditReflection(null);
          setReflectionPrefillRef(null);
          if (saved) { setActiveReflectionId(saved.id); setView('greflection'); }
          else setView('circle');
        }}
      />
    );
  }

  return (
    // No overflow-hidden here: it establishes a scroll container per the CSS spec, which
    // breaks position:sticky for every header below (they'd stick relative to this div,
    // but this div itself never actually scrolls — the real scroll happens on
    // document.scrollingElement, outside it) — degrading every sticky header to just
    // scrolling away with the page. Matches Quran.tsx's equivalent wrapper, which never
    // had this class and whose sticky header works correctly.
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200 pb-32">
      {view === 'top' && (
        <>
          <TopHeader navigate={navigate} />
          <TopTabs value={topTab} onChange={setTopTab} />
          {topTab === 'home' && (
            <HomeTab
              salawat={salawat}
              myGroups={myGroups}
              onOpenCircle={id => openCircle(id)}
              onSeeChallenges={() => setTopTab('challenges')}
              onSeeCircles={() => setTopTab('circles')}
              onOpenChallenge={id => openChallenge(id, 'top')}
              onSalawat={async () => {
                setSalawat(s => (s ? { ...s, totalCount: s.totalCount + 1, todayCount: s.todayCount + 1 } : s));
                try { setSalawat(await community.addSalawat(1)); } catch { /* ignore */ }
              }}
            />
          )}
          {topTab === 'circles' && (
            <CirclesTab
              myGroups={myGroups}
              onOpenCircle={id => openCircle(id)}
              onCreate={() => (guard() ? null : setView('circle-create'))}
              onRedeemed={id => { refreshMyGroups(); openCircle(id); }}
              onOpenThread={th => { setActiveThread(th); setView('dm-thread'); }}
              guard={guard}
              initialInviteCode={inviteCodeToRedeem}
              onConsumedInviteCode={() => setInviteCodeToRedeem(null)}
            />
          )}
          {topTab === 'challenges' && (
            <ChallengesTab
              myGroups={myGroups}
              isAppAdmin={isAppAdmin}
              onOpen={id => openChallenge(id, 'top')}
              guard={guard}
            />
          )}
          {topTab === 'duas' && <DuasTab guard={guard} meId={authUserId} />}
        </>
      )}

      {view === 'circle' && activeGroupId && (
        <CircleDetail
          groupId={activeGroupId}
          tab={circleTab}
          onTab={setCircleTab}
          onBack={() => { setView('top'); setActiveGroupId(null); }}
          onLeftGroup={() => { refreshMyGroups(); setView('top'); setActiveGroupId(null); }}
          onJoined={refreshMyGroups}
          onOpenReflection={id => { setActiveReflectionId(id); setView('greflection'); }}
          onNewReflection={() => { setEditReflection(null); setView('greflection-editor'); }}
          onOpenChallenge={id => openChallenge(id, 'circle')}
          onReflectOnVerse={ref => { setReflectionPrefillRef(ref); setEditReflection(null); setView('greflection-editor'); }}
          onOpenThread={th => { setActiveThread(th); setView('dm-thread'); }}
          isAppAdmin={isAppAdmin}
          guard={guard}
          meId={authUserId}
        />
      )}

      {view === 'dm-thread' && activeThread && (
        <DMThreadView
          threadId={activeThread.id}
          otherProfile={activeThread.otherProfile}
          onBack={() => { setView('top'); setActiveThread(null); }}
          onGuestAction={guard}
        />
      )}

      {view === 'circle-create' && (
        <SubScreen title={t('community.createCircle')} onBack={() => setView('top')}>
          <GroupFormSheet
            isOpen
            onClose={() => setView('top')}
            onSave={async draft => { const g = await community.createGroup(draft); await refreshMyGroups(); openCircle(g.id); }}
          />
        </SubScreen>
      )}

      {view === 'greflection' && activeGroupId && activeReflectionId && (
        <GroupReflectionDetail
          groupId={activeGroupId}
          reflectionId={activeReflectionId}
          meId={authUserId}
          onBack={() => { setView('circle'); setActiveReflectionId(null); }}
          onEdit={r => { setEditReflection(r); setView('greflection-editor'); }}
          onDeleted={() => { setView('circle'); setActiveReflectionId(null); }}
          onQuranRef={(s, a) => {
            setReturnToCommunity({ groupId: activeGroupId, reflectionId: activeReflectionId, view: 'greflection' });
            setPendingQuranTarget({ surahNumber: s, ayahNumber: a });
            navigate('quran');
          }}
          guard={guard}
        />
      )}

      {view === 'challenge' && activeChallengeId && (
        <ChallengeDetail
          challengeId={activeChallengeId}
          meId={authUserId}
          isAppAdmin={isAppAdmin}
          onBack={() => { setView(challengeReturn.current === 'circle' ? 'circle' : 'top'); setActiveChallengeId(null); }}
          guard={guard}
        />
      )}

      <LinkEmailPrompt isOpen={guestGate} onClose={() => setGuestGate(false)} />
    </div>
  );
};

export default Community;

// ===========================================================================
// Shared small pieces
// ===========================================================================

// Paints the camera-cutout safe-area strip opaque even once a sticky header below it
// has scrolled up against it — same fix as Quran.tsx's reader header, otherwise
// scrolled content shows through that strip. Must be `fixed` (not `absolute`) so it
// stays pinned to the true viewport regardless of this page's own scroll position.
const SafeAreaTopFiller: React.FC = () => (
  <div
    className="fixed top-0 left-0 right-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm"
    style={{ height: 'calc(env(safe-area-inset-top, 0px) + 1px)' }}
  />
);

const TopHeader: React.FC<{ navigate: (p: PageId) => void }> = ({ navigate }) => {
  const { t } = useUser();
  return (
    <>
      <SafeAreaTopFiller />
      <header className="sticky sticky-safe-top z-40 flex items-center justify-between px-6 py-3 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-100 dark:border-white/5">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-primary uppercase tracking-wider mb-1">{t('community.theUmmah')}</span>
          <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">{t('community.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{t('community.tagline')}</p>
        </div>
        <button
          onClick={() => navigate('notifications')}
          className="relative flex items-center justify-center rounded-full size-10 text-slate-900 dark:text-white shadow-sm border bg-gray-100 dark:bg-white/5 border-gray-100 dark:border-white/5"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>
    </>
  );
};

const TopTabs: React.FC<{ value: TopTab; onChange: (t: TopTab) => void }> = ({ value, onChange }) => {
  const { t } = useUser();
  const tabs: { id: TopTab; key: TranslationKey }[] = [
    { id: 'home', key: 'community.tabHome' },
    { id: 'challenges', key: 'community.tabChallenges' },
    { id: 'circles', key: 'community.tabCircles' },
    { id: 'duas', key: 'community.tabDuas' },
  ];
  return (
    <div className="flex gap-3 px-6 pt-4 pb-6 overflow-x-auto no-scrollbar scroll-smooth">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 shadow-sm transition-all ${
            value === tab.id
              ? 'bg-primary text-background-dark shadow-glow font-bold'
              : 'bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 font-medium'
          }`}
        >
          <span className="text-sm whitespace-nowrap">{t(tab.key)}</span>
        </button>
      ))}
    </div>
  );
};

const SubScreen: React.FC<{ title: string; onBack: () => void; children: React.ReactNode; right?: React.ReactNode }> = ({ title, onBack, children, right }) => (
  <div className="flex flex-col min-h-screen">
    <SafeAreaTopFiller />
    <header className="sticky sticky-safe-top z-40 flex items-center gap-3 px-6 py-3 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-100 dark:border-white/5">
      <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
        <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
      </button>
      <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{title}</h1>
      {right}
    </header>
    <div className="flex-1 pt-4">{children}</div>
  </div>
);

const Empty: React.FC<{ icon: string; text: string; sub?: string }> = ({ icon, text, sub }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-8">
    <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">{icon}</span>
    <p className="text-gray-500 dark:text-gray-400 text-sm">{text}</p>
    {sub && <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">{sub}</p>}
  </div>
);

const primaryBtn = 'w-full text-sm font-bold py-3 rounded-xl bg-primary text-background-dark hover:bg-[#10d482] transition-colors shadow-glow flex items-center justify-center gap-2';
const ghostBtn = 'w-full text-sm font-bold py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors';

// ===========================================================================
// Home tab
// ===========================================================================

const HomeTab: React.FC<{
  salawat: GlobalSalawat | null;
  myGroups: Group[];
  onOpenCircle: (id: string) => void;
  onOpenChallenge: (id: string) => void;
  onSeeChallenges: () => void;
  onSeeCircles: () => void;
  onSalawat: () => void;
}> = ({ salawat, myGroups, onOpenCircle, onOpenChallenge, onSeeChallenges, onSeeCircles, onSalawat }) => {
  const { t } = useUser();
  const [challenges, setChallenges] = useState<GroupChallenge[]>([]);
  useEffect(() => { community.listChallenges().then(cs => setChallenges(cs.filter(c => c.status === 'active'))).catch(() => {}); }, []);

  return (
    <>
      <div className="px-6 mb-8">
        <div className="relative w-full rounded-2xl overflow-hidden shadow-soft border border-gray-100 dark:border-white/5 bg-gradient-to-br from-[#1A2E25] to-[#0d1b16] text-white">
          <div className="absolute right-0 top-0 h-full w-1/2 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: '180px', position: 'absolute', right: '-40px', top: '-20px' }}>public</span>
          </div>
          <div className="relative z-10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">{t('community.liveGlobalActivity')}</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white tabular-nums">{(salawat?.todayCount ?? 0).toLocaleString()}</h1>
            <p className="text-gray-300 font-medium text-sm mt-1">{t('community.salawatRecitedToday')}</p>
            <p className="text-gray-400 text-xs mb-6">{t('community.salawatAllTime', { count: (salawat?.totalCount ?? 0).toLocaleString() })}</p>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 rounded-full p-2 text-primary"><span className="material-symbols-outlined text-[20px]">volunteer_activism</span></div>
                <div className="text-sm"><p className="text-white font-medium">{t('community.contribute')}</p><p className="text-xs text-gray-400">{t('community.tapToAdd')}</p></div>
              </div>
              <button onClick={onSalawat} className="size-8 rounded-full bg-primary flex items-center justify-center text-background-dark hover:scale-105 active:scale-95 transition-transform">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mb-8">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t('community.challengesHeading')}</h3>
          <button onClick={onSeeChallenges} className="text-sm font-medium text-primary hover:text-primary/80">{t('community.viewAll')}</button>
        </div>
        {challenges.length === 0 ? (
          <Empty icon="flag" text={t('community.noChallenges')} sub={t('community.noChallengesSub')} />
        ) : (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {challenges.slice(0, 6).map(c => {
              const ic = challengeIcon(c);
              return (
                <button key={c.id} onClick={() => onOpenChallenge(c.id)} className="min-w-[220px] text-left bg-white dark:bg-card-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-primary/30 transition-colors">
                  <div className="bg-primary/10 p-2.5 rounded-xl text-primary border border-gray-100 dark:border-white/5 w-fit mb-3">
                    <GoalIcon icon={ic.icon} iconImage={ic.iconImage} className="material-symbols-outlined w-6 h-6" />
                  </div>
                  <h4 className="text-slate-900 dark:text-white font-bold text-lg leading-tight mb-1">{c.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{c.groupId ? t('community.challengeInCircle', { name: c.groupName || '' }) : t('community.challengeGlobalBadge')}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 mb-8">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t('community.activeCircles')}</h3>
          <button onClick={onSeeCircles} className="text-sm font-medium text-primary hover:text-primary/80">{t('community.viewAll')}</button>
        </div>
        {myGroups.length === 0 ? (
          <Empty icon="groups" text={t('community.noCirclesYet')} />
        ) : (
          <div className="space-y-3">
            {myGroups.slice(0, 3).map(g => {
              const ic = circleIcon(g);
              return (
                <button key={g.id} onClick={() => onOpenCircle(g.id)} className="w-full text-left bg-white dark:bg-card-dark p-4 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-primary shrink-0">
                    <GoalIcon icon={ic.icon} iconImage={ic.iconImage} className="material-symbols-outlined w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-slate-900 dark:text-white font-bold truncate">{g.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('community.membersCount', { count: g.memberCount })}</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

// ===========================================================================
// Circles tab (my + discover + create)
// ===========================================================================

const CirclesTab: React.FC<{
  myGroups: Group[];
  onOpenCircle: (id: string) => void;
  onCreate: () => void;
  onRedeemed: (id: string) => void;
  onOpenThread: (thread: DMThread) => void;
  guard: () => boolean;
  initialInviteCode?: string | null;
  onConsumedInviteCode?: () => void;
}> = ({ myGroups, onOpenCircle, onCreate, onRedeemed, onOpenThread, guard, initialInviteCode, onConsumedInviteCode }) => {
  const { t } = useUser();
  const [subTab, setSubTab] = useState<CirclesSubTab>('circles');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [prefillCode, setPrefillCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!initialInviteCode) return;
    setPrefillCode(initialInviteCode);
    setShowInvite(true);
    onConsumedInviteCode?.();
  }, [initialInviteCode, onConsumedInviteCode]);

  useEffect(() => {
    const h = setTimeout(async () => {
      setSearching(true);
      try { setResults(await community.searchGroups(query)); } catch { setResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(h);
  }, [query]);

  const myIds = new Set(myGroups.map(g => g.id));
  const discover = results.filter(g => !myIds.has(g.id));

  return (
    <div className="px-6 pb-24 space-y-5">
      <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-full">
        {(['circles', 'messages'] as CirclesSubTab[]).map(s => (
          <button
            key={s}
            onClick={() => setSubTab(s)}
            className={`flex-1 h-9 rounded-full text-sm font-bold transition-colors ${subTab === s ? 'bg-primary text-background-dark shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {t(s === 'circles' ? 'community.tabCircles' : 'community.messages')}
          </button>
        ))}
      </div>

      {subTab === 'messages' ? (
        <MessagesTab onOpenThread={onOpenThread} />
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('community.searchCircles')}
                className="w-full pl-10 pr-3 py-3 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <button onClick={() => (guard() ? null : setShowInvite(true))} className="size-12 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-center text-slate-900 dark:text-white shrink-0" title={t('community.enterCodeLabel')}>
              <span className="material-symbols-outlined">key</span>
            </button>
          </div>

          {myGroups.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('community.myCircles')}</p>
              <div className="space-y-2">
                {myGroups.map(g => <CircleRow key={g.id} g={g} onClick={() => onOpenCircle(g.id)} joined />)}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('community.discoverCircles')}</p>
            {searching && !discover.length ? (
              <p className="text-sm text-gray-400 py-4">{t('community.loading')}</p>
            ) : discover.length === 0 ? (
              <Empty icon="travel_explore" text={query ? t('community.noCirclesFound') : t('community.noCirclesYet')} />
            ) : (
              <div className="space-y-2">
                {discover.map(g => <CircleRow key={g.id} g={g} onClick={() => onOpenCircle(g.id)} />)}
              </div>
            )}
          </div>

          <button onClick={onCreate} className="w-full p-4 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-center py-8 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-gray-500 text-3xl mb-2">add_circle</span>
            <h4 className="text-slate-900 dark:text-white font-semibold">{t('community.createCircle')}</h4>
            <p className="text-xs text-gray-500">{t('community.createCircleSub')}</p>
          </button>
        </>
      )}

      <InviteSheet isOpen={showInvite} onClose={() => setShowInvite(false)} initialCode={prefillCode} onRedeemed={id => { setShowInvite(false); onRedeemed(id); }} />
    </div>
  );
};

const CircleRow: React.FC<{ g: Group; onClick: () => void; joined?: boolean }> = ({ g, onClick, joined }) => {
  const { t } = useUser();
  const ic = circleIcon(g);
  return (
    <button onClick={onClick} className={`relative w-full text-left bg-white dark:bg-card-dark p-4 rounded-2xl border overflow-hidden hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3 ${joined ? 'border-primary/25 pl-5' : 'border-gray-100 dark:border-white/5'}`}>
      {joined && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
      <div className="size-11 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-primary shrink-0 overflow-hidden">
        <GoalIcon icon={ic.icon} iconImage={ic.iconImage} className="material-symbols-outlined w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-slate-900 dark:text-white font-bold truncate">{g.name}</h4>
          <PrivacyBadge privacy={g.privacy} />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>groups</span>
          {t('community.membersCount', { count: g.memberCount })}{g.description ? ` · ${g.description}` : ''}
        </p>
      </div>
      {joined
        ? <span className="text-xs font-bold text-primary shrink-0">{t('community.joined')}</span>
        : <span className="material-symbols-outlined text-gray-400 shrink-0">chevron_right</span>}
    </button>
  );
};

// ===========================================================================
// Circle detail
// ===========================================================================

const CircleDetail: React.FC<{
  groupId: string;
  tab: CircleTab;
  onTab: (t: CircleTab) => void;
  onBack: () => void;
  onLeftGroup: () => void;
  onJoined: () => void;
  onOpenReflection: (id: string) => void;
  onNewReflection: () => void;
  onOpenChallenge: (id: string) => void;
  onReflectOnVerse: (ref: QuranReference) => void;
  onOpenThread: (thread: DMThread) => void;
  isAppAdmin: boolean;
  guard: () => boolean;
  meId: string | null;
}> = ({ groupId, tab, onTab, onBack, onLeftGroup, onJoined, onOpenReflection, onNewReflection, onOpenChallenge, onReflectOnVerse, onOpenThread, guard, meId }) => {
  const { t } = useUser();
  const [group, setGroup] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(() => { community.getGroup(groupId).then(setGroup).catch(() => {}); }, [groupId]);
  useEffect(() => { load(); }, [load]);

  if (!group) {
    return <SubScreen title="" onBack={onBack}><p className="text-center text-sm text-gray-400 py-10">{t('community.loading')}</p></SubScreen>;
  }

  const isMember = group.myStatus === 'active' || group.myStatus === 'muted';
  const isPending = group.myStatus === 'pending';
  const isAdmin = group.myRole === 'owner' || group.myRole === 'admin';
  const isModerator = isAdmin || group.myRole === 'moderator';

  const doJoin = async () => {
    if (guard() || busy) return;
    setBusy(true);
    try {
      if (group.privacy === 'public') await community.joinPublicGroup(groupId);
      else if (group.privacy === 'private') await community.requestJoin(groupId);
      load(); onJoined();
    } catch { /* ignore */ } finally { setBusy(false); }
  };
  const doLeave = async () => {
    if (busy) return;
    if (group.myRole === 'owner') { alert(t('community.ownerCannotLeave')); return; }
    if (!confirm(t('community.leaveConfirm'))) return;
    setBusy(true);
    try { await community.leaveGroup(groupId); onLeftGroup(); } finally { setBusy(false); }
  };

  const ic = circleIcon(group);
  const tabs: { id: CircleTab; key: TranslationKey }[] = [
    { id: 'chat', key: 'community.tabChat' },
    { id: 'reflections', key: 'community.tabReflections' },
    { id: 'challenges', key: 'community.tabCircleChallenges' },
    { id: 'members', key: 'community.tabMembers' },
    { id: 'info', key: 'community.tabInfo' },
  ];
  const visibleTabs = isMember ? tabs : tabs.filter(x => x.id === 'info');

  const isChatTab = isMember && tab === 'chat';

  return (
    <div
      className={`flex flex-col ${isChatTab ? 'overflow-hidden' : 'min-h-screen'}`}
      style={isChatTab ? { height: 'calc(100dvh - env(safe-area-inset-top, 0px))' } : undefined}
    >
      {!isChatTab && <SafeAreaTopFiller />}
      <header className={`z-10 flex items-center gap-3 px-6 py-3 shrink-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-100 dark:border-white/5 ${isChatTab ? 'relative' : 'sticky sticky-safe-top'}`}>
        <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
          <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
        </button>
        <div className="size-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-primary shrink-0">
          <GoalIcon icon={ic.icon} iconImage={ic.iconImage} className="material-symbols-outlined w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight flex-1 truncate">{group.name}</h1>
        {isAdmin && (
          <button onClick={() => setShowEdit(true)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0">
            <span className="material-symbols-outlined text-xl">settings</span>
          </button>
        )}
      </header>

      <div className="flex gap-2 px-6 pt-4 pb-4 overflow-x-auto no-scrollbar shrink-0">
        {visibleTabs.map(x => (
          <button key={x.id} onClick={() => onTab(x.id)} className={`h-9 shrink-0 px-4 rounded-full text-sm font-medium transition-colors ${tab === x.id ? 'bg-primary text-background-dark font-bold' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300'}`}>
            {t(x.key)}
          </button>
        ))}
      </div>

      {(tab === 'info' || !isMember) && (
        <div className="px-6 pb-24 space-y-4">
          <div className="relative w-full h-36 rounded-2xl overflow-hidden">
            {ic.iconImage ? (
              <>
                <img src={ic.iconImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-primary/5 dark:from-primary/25 dark:to-white/5 flex items-center justify-center">
                <GoalIcon icon={ic.icon} className="text-primary/70 text-6xl" />
              </div>
            )}
            <h2 className={`absolute bottom-3 left-4 right-4 text-xl font-bold tracking-tight truncate ${ic.iconImage ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {group.name}
            </h2>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-2xl p-4 border border-gray-100 dark:border-white/5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PrivacyBadge privacy={group.privacy} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-2 py-0.5">{t(CAT_KEY[group.category])}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('community.membersCount', { count: group.memberCount })}</span>
            </div>
            {group.description && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('community.aboutCircle')}</p>
                <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{group.description}</p>
              </div>
            )}
          </div>

          {!isMember && !isPending && (
            <button onClick={doJoin} disabled={busy} className={primaryBtn}>
              {group.privacy === 'private' ? t('community.requestToJoin') : t('community.join')}
            </button>
          )}
          {isPending && <div className={ghostBtn}>{t('community.requestPending')}</div>}
          {!isMember && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('community.nonMemberNotice')}</p>}

          {isMember && (
            <div className="space-y-2 pt-2">
              {isAdmin && <button onClick={() => setShowInvite(true)} className={ghostBtn}>{t('community.inviteTitle')}</button>}
              <button onClick={() => setShowReport(true)} className="w-full text-sm font-medium py-2 text-gray-500 dark:text-gray-400">{t('community.report')}</button>
              <button onClick={doLeave} className="w-full text-sm font-bold py-2 text-red-500 dark:text-red-400">{t('community.leave')}</button>
            </div>
          )}
        </div>
      )}

      {isChatTab && (
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatTab
            groupId={groupId}
            isModerator={isModerator}
            onGuestAction={guard}
            verseOfDay={group.verseOfDay}
            onReflectOnVerse={onReflectOnVerse}
          />
        </div>
      )}

      {isMember && tab === 'reflections' && (
        <CircleReflections groupId={groupId} onOpen={onOpenReflection} onNew={() => (guard() ? null : onNewReflection())} />
      )}

      {isMember && tab === 'challenges' && (
        <CircleChallenges groupId={groupId} isAdmin={isAdmin} onOpen={onOpenChallenge} guard={guard} />
      )}

      {isMember && tab === 'members' && (
        <MembersTab groupId={groupId} myRole={group.myRole ?? 'member'} meId={meId} onChanged={load} onOpenThread={onOpenThread} guard={guard} />
      )}

      <InviteSheet isOpen={showInvite} onClose={() => setShowInvite(false)} groupId={groupId} isAdmin={isAdmin} />
      <ReportSheet isOpen={showReport} onClose={() => setShowReport(false)} entityType="group" entityId={groupId} groupId={groupId} onDone={() => alert(t('community.reportSent'))} />
      <GroupFormSheet isOpen={showEdit} onClose={() => setShowEdit(false)} editing={group} onSave={async draft => { await community.updateGroup(groupId, draft); load(); }} />
    </div>
  );
};

const CircleReflections: React.FC<{ groupId: string; onOpen: (id: string) => void; onNew: () => void }> = ({ groupId, onOpen, onNew }) => {
  const { t } = useUser();
  const [list, setList] = useState<GroupReflection[] | null>(null);
  useEffect(() => { community.listGroupReflections(groupId).then(setList).catch(() => setList([])); }, [groupId]);
  return (
    <div className="px-6 pb-24 space-y-3">
      <button onClick={onNew} className={primaryBtn}><span className="material-symbols-outlined text-lg">edit</span>{t('community.newReflection')}</button>
      {list === null ? <p className="text-sm text-gray-400 py-6">{t('community.loading')}</p>
        : list.length === 0 ? <Empty icon="menu_book" text={t('community.noGroupReflections')} />
          : list.map(r => (
            <button key={r.id} onClick={() => onOpen(r.id)} className="w-full text-left bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Avatar src={r.author?.avatarUrl ?? undefined} className="size-7 rounded-full" iconClassName="text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-gray-300 truncate">{r.author?.displayName || '…'}</p>
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">{fmtDate(r.createdAt)}</span>
                {r.sourceLocalId && <span className="text-[10px] text-primary bg-primary/10 rounded-full px-1.5 shrink-0">{t('community.shareToCommunity')}</span>}
              </div>
              {r.title && <h4 className="font-bold text-slate-900 dark:text-white">{r.title}</h4>}
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{r.content.replace(/\[\[quran:\d+:\d+(?:\|([^\]]+))?\]\]/g, '$1')}</p>
            </button>
          ))}
    </div>
  );
};

const CircleChallenges: React.FC<{ groupId: string; isAdmin: boolean; onOpen: (id: string) => void; guard: () => boolean }> = ({ groupId, isAdmin, onOpen, guard }) => {
  const { t } = useUser();
  const [list, setList] = useState<GroupChallenge[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(() => community.listGroupChallenges(groupId).then(setList).catch(() => setList([])), [groupId]);
  useEffect(() => { load(); }, [load]);

  const active = (list ?? []).filter(c => c.status === 'active');
  const pending = (list ?? []).filter(c => c.status === 'pending');

  return (
    <div className="px-6 pb-24 space-y-3">
      <button onClick={() => (guard() ? null : setShowForm(true))} className={primaryBtn}><span className="material-symbols-outlined text-lg">add</span>{t('community.createChallenge')}</button>
      {list === null ? <p className="text-sm text-gray-400 py-6">{t('community.loading')}</p> : (
        <>
          {isAdmin && pending.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">{t('community.pendingApproval')}</p>
              {pending.map(c => (
                <div key={c.id} className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-amber-500/30 mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">{c.title}</h4>
                  {c.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{c.description}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={async () => { await community.setChallengeStatus(c.id, 'active'); load(); }} className="flex-1 py-2 rounded-xl bg-primary text-background-dark text-sm font-bold">{t('community.approveChallenge')}</button>
                    <button onClick={async () => { await community.setChallengeStatus(c.id, 'rejected'); load(); }} className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 text-sm font-bold">{t('community.rejectChallenge')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {active.length === 0 ? <Empty icon="flag" text={t('community.noChallenges')} /> : active.map(c => <ChallengeRow key={c.id} c={c} onClick={() => onOpen(c.id)} />)}
        </>
      )}

      <ChallengeFormSheet
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        myCircles={[]}
        lockedGroupId={groupId}
        submitLabelForTarget={() => (isAdmin ? t('community.create') : t('community.sendForApproval'))}
        onSubmit={async draft => { await community.createChallenge(draft, isAdmin); load(); if (!isAdmin) alert(t('community.challengeSentForApproval')); }}
      />
    </div>
  );
};

const ChallengeRow: React.FC<{ c: GroupChallenge; onClick: () => void }> = ({ c, onClick }) => {
  const { t } = useUser();
  const ic = challengeIcon(c);
  return (
    <button onClick={onClick} className="w-full text-left bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-primary/30 transition-colors flex items-center gap-3">
      <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
        <GoalIcon icon={ic.icon} iconImage={ic.iconImage} className="material-symbols-outlined w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-bold text-slate-900 dark:text-white truncate">{c.title}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {c.groupId ? t('community.challengeInCircle', { name: c.groupName || '' }) : t('community.challengeGlobalBadge')}
          {' · '}{t('community.challengeEnds', { date: fmtDate(c.endsOn) })}
          {c.status === 'pending' && ` · ${t('community.challengePendingBadge')}`}
        </p>
      </div>
      <span className="material-symbols-outlined text-gray-400">chevron_right</span>
    </button>
  );
};

const roleBadgeStyle: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  moderator: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  member: 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10',
};

const MembersTab: React.FC<{
  groupId: string;
  myRole: string;
  meId: string | null;
  onChanged: () => void;
  onOpenThread: (thread: DMThread) => void;
  guard: () => boolean;
}> = ({ groupId, myRole, meId, onChanged, onOpenThread, guard }) => {
  const { t } = useUser();
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [query, setQuery] = useState('');
  const load = useCallback(() => community.listMembers(groupId).then(setMembers).catch(() => setMembers([])), [groupId]);
  useEffect(() => { load(); }, [load]);

  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const q = query.trim().toLowerCase();
  const matches = (m: GroupMember) => !q || (m.profile?.displayName || '').toLowerCase().includes(q);
  const active = (members ?? []).filter(m => (m.status === 'active' || m.status === 'muted') && matches(m));
  const pending = (members ?? []).filter(m => m.status === 'pending');
  const roleKey: Record<string, TranslationKey> = { owner: 'community.roleOwner', admin: 'community.roleAdmin', moderator: 'community.roleModerator', member: 'community.roleMember' };

  const messageMember = async (userId: string) => {
    if (guard()) return;
    try {
      const threadId = await dm.getOrCreateThread(userId);
      const profiles = await community.getProfiles([userId]);
      onOpenThread({ id: threadId, otherUserId: userId, otherProfile: profiles[userId], lastMessageAt: new Date().toISOString(), isUnread: false });
    } catch { /* ignore */ }
  };

  return (
    <div className="px-6 pb-24 space-y-4">
      {members !== null && members.length > 0 && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('community.searchMembers')}
            className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/5 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      )}
      {members === null ? <p className="text-sm text-gray-400 py-6">{t('community.loading')}</p> : (
        <>
          {isAdmin && pending.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{t('community.pendingRequests')}</p>
              {pending.map(m => (
                <div key={m.userId} className="flex items-center gap-3 bg-white dark:bg-card-dark p-3 rounded-xl border border-gray-100 dark:border-white/5 mb-2">
                  <Avatar src={m.profile?.avatarUrl ?? undefined} className="size-8 rounded-full" iconClassName="text-sm" />
                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-white truncate">{m.profile?.displayName || '…'}</span>
                  <button onClick={async () => { await community.approveJoin(groupId, m.userId); load(); onChanged(); }} className="text-xs font-bold text-primary">{t('community.approve')}</button>
                  <button onClick={async () => { await community.rejectJoin(groupId, m.userId); load(); }} className="text-xs font-bold text-red-500">{t('community.reject')}</button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {active.map(m => (
              <div key={m.userId} className="flex items-center gap-3 bg-white dark:bg-card-dark p-3 rounded-xl border border-gray-100 dark:border-white/5">
                <Avatar src={m.profile?.avatarUrl ?? undefined} className="size-9 rounded-full" iconClassName="text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.profile?.displayName || '…'}{m.userId === meId ? ` (${t('community.you')})` : ''}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${roleBadgeStyle[m.role]}`}>{t(roleKey[m.role])}</span>
                </div>
                {m.userId !== meId && (
                  <button onClick={() => messageMember(m.userId)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5 shrink-0" title={t('community.messageMember')}>
                    <span className="material-symbols-outlined text-lg">mail</span>
                  </button>
                )}
                {isAdmin && m.role !== 'owner' && m.userId !== meId && (
                  <select
                    value={m.role}
                    onChange={async e => {
                      const v = e.target.value;
                      if (v === 'kick') { await community.kickMember(groupId, m.userId); }
                      else if (v === 'ban') { await community.banMember(groupId, m.userId); }
                      else { await community.setMemberRole(groupId, m.userId, v as any); }
                      load(); onChanged();
                    }}
                    className="text-xs bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg py-1 px-2 text-slate-900 dark:text-white"
                  >
                    <option value="member">{t('community.roleMember')}</option>
                    <option value="moderator">{t('community.roleModerator')}</option>
                    <option value="admin">{t('community.roleAdmin')}</option>
                    <option value="kick">{t('community.removeMember')}</option>
                    <option value="ban">{t('community.banMember')}</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ===========================================================================
// Group reflection detail
// ===========================================================================

const GroupReflectionDetail: React.FC<{
  groupId: string;
  reflectionId: string;
  meId: string | null;
  onBack: () => void;
  onEdit: (r: GroupReflection) => void;
  onDeleted: () => void;
  onQuranRef: (s: number, a: number) => void;
  guard: () => boolean;
}> = ({ reflectionId, meId, onBack, onEdit, onDeleted, onQuranRef, guard }) => {
  const { t } = useUser();
  const [r, setR] = useState<GroupReflection | null>(null);
  const [comments, setComments] = useState<GroupReflectionComment[]>([]);
  const [reactions, setReactions] = useState<ReactionSummary | undefined>(undefined);
  const [draft, setDraft] = useState('');

  const loadReactions = useCallback(() => {
    community.listReactions('reflection', [reflectionId]).then(m => setReactions(m[reflectionId])).catch(() => {});
  }, [reflectionId]);

  useEffect(() => {
    community.getGroupReflection(reflectionId).then(setR).catch(() => {});
    community.listComments(reflectionId).then(setComments).catch(() => {});
    loadReactions();
  }, [reflectionId, loadReactions]);

  if (!r) return <SubScreen title="" onBack={onBack}><p className="text-center text-sm text-gray-400 py-10">{t('community.loading')}</p></SubScreen>;

  const mine = r.authorId === meId;

  const toggleReact = async (emoji: ReactionEmoji, on: boolean) => {
    if (guard()) return;
    setReactions(prev => {
      const counts = { ...(prev?.counts ?? {}) };
      const m = new Set(prev?.mine ?? []);
      counts[emoji] = (counts[emoji] ?? 0) + (on ? -1 : 1);
      on ? m.delete(emoji) : m.add(emoji);
      return { counts, mine: [...m] };
    });
    try { await community.toggleReaction('reflection', reflectionId, emoji, on); } catch { /* ignore */ }
    loadReactions();
  };

  const addComment = async () => {
    if (!draft.trim()) return;
    if (guard()) return;
    const body = draft.trim();
    setDraft('');
    try { const added = await community.addComment(reflectionId, body); setComments(prev => [...prev, added]); } catch { setDraft(body); }
  };

  return (
    <SubScreen
      title=""
      onBack={onBack}
      right={mine ? (
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(r)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"><span className="material-symbols-outlined text-xl">edit</span></button>
          <button
            onClick={async () => { if (confirm(t('community.deleteReflectionConfirm'))) { await community.softDeleteGroupReflection(r.id); onDeleted(); } }}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-red-500"
          ><span className="material-symbols-outlined text-xl">delete</span></button>
        </div>
      ) : undefined}
    >
      <div className="px-6 pb-24 space-y-4">
        <div className="flex items-center gap-2">
          <Avatar src={r.author?.avatarUrl ?? undefined} className="size-8 rounded-full" iconClassName="text-sm" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{r.author?.displayName || '…'}</span>
        </div>
        {r.title && <h1 className="text-2xl font-bold tracking-tight">{r.title}</h1>}
        <MarkdownContent onQuranRef={onQuranRef} className="text-slate-800 dark:text-gray-200 leading-relaxed">{r.content}</MarkdownContent>
        <ReactionBar summary={reactions} onToggle={toggleReact} />

        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('community.comments')}</p>
          {comments.length === 0 && <p className="text-xs text-gray-400 mb-3">{t('community.noComments')}</p>}
          <div className="space-y-3 mb-3">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <Avatar src={c.author?.avatarUrl ?? undefined} className="size-7 rounded-full shrink-0" iconClassName="text-xs" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{c.author?.displayName || '…'}</p>
                  <p className="text-sm text-slate-800 dark:text-gray-200">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder={t('community.commentPlaceholder')} className="flex-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 text-sm outline-none" />
            <button onClick={addComment} disabled={!draft.trim()} className="size-9 rounded-full bg-primary text-background-dark flex items-center justify-center disabled:opacity-40"><span className="material-symbols-outlined text-lg">send</span></button>
          </div>
        </div>
      </div>
    </SubScreen>
  );
};

// ===========================================================================
// Challenges tab (merged global + circles)
// ===========================================================================

const ChallengesTab: React.FC<{
  myGroups: Group[];
  isAppAdmin: boolean;
  onOpen: (id: string) => void;
  guard: () => boolean;
}> = ({ myGroups, isAppAdmin, onOpen, guard }) => {
  const { t } = useUser();
  const { authUserId } = useAuth();
  const [list, setList] = useState<GroupChallenge[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => community.listChallenges().then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);

  const myAdminGroupIds = new Set(myGroups.filter(g => g.myRole === 'owner' || g.myRole === 'admin' || g.myRole === 'moderator').map(g => g.id));
  const canApproveFor = (groupId: string | null) => (groupId === null ? isAppAdmin : myAdminGroupIds.has(groupId));

  const active = (list ?? []).filter(c => c.status === 'active');
  const myPending = (list ?? []).filter(c => c.status === 'pending' && c.creatorId === authUserId);
  const toApprove = (list ?? []).filter(c => c.status === 'pending' && c.creatorId !== authUserId && canApproveFor(c.groupId));

  return (
    <div className="px-6 pb-24 space-y-3">
      <button onClick={() => (guard() ? null : setShowForm(true))} className={primaryBtn}>
        <span className="material-symbols-outlined text-lg">add</span>{t('community.createChallenge')}
      </button>

      {list === null ? <p className="text-sm text-gray-400 py-6">{t('community.loading')}</p> : (
        <>
          {toApprove.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">{t('community.pendingApproval')}</p>
              {toApprove.map(c => (
                <div key={c.id} className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-amber-500/30 mb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">{c.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.groupId ? t('community.challengeInCircle', { name: c.groupName || '' }) : t('community.challengeGlobalBadge')}</p>
                  {c.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{c.description}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={async () => { await community.setChallengeStatus(c.id, 'active'); load(); }} className="flex-1 py-2 rounded-xl bg-primary text-background-dark text-sm font-bold">{t('community.approveChallenge')}</button>
                    <button onClick={async () => { await community.setChallengeStatus(c.id, 'rejected'); load(); }} className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 text-sm font-bold">{t('community.rejectChallenge')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {myPending.map(c => <ChallengeRow key={c.id} c={c} onClick={() => onOpen(c.id)} />)}
          {active.length === 0 && myPending.length === 0
            ? <Empty icon="flag" text={t('community.noChallenges')} sub={t('community.noChallengesSub')} />
            : active.map(c => <ChallengeRow key={c.id} c={c} onClick={() => onOpen(c.id)} />)}
        </>
      )}

      <ChallengeFormSheet
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        myCircles={myGroups.filter(g => g.myStatus === 'active')}
        submitLabelForTarget={gid => (canApproveFor(gid) ? t('community.create') : t('community.sendForApproval'))}
        onSubmit={async draft => {
          const approve = canApproveFor(draft.groupId);
          await community.createChallenge(draft, approve);
          load();
          if (!approve) alert(t('community.challengeSentForApproval'));
        }}
      />
    </div>
  );
};

const ChallengeDetail: React.FC<{
  challengeId: string;
  meId: string | null;
  isAppAdmin: boolean;
  onBack: () => void;
  guard: () => boolean;
}> = ({ challengeId, meId, onBack, guard }) => {
  const { t } = useUser();
  const [c, setC] = useState<GroupChallenge | null>(null);
  const [participants, setParticipants] = useState<import('../types').ChallengeParticipant[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setC(await community.getChallenge(challengeId).catch(() => null));
    setParticipants(await community.listParticipants(challengeId).catch(() => []));
  }, [challengeId]);
  useEffect(() => { load(); }, [load]);

  if (!c) return <SubScreen title="" onBack={onBack}><p className="text-center text-sm text-gray-400 py-10">{t('community.loading')}</p></SubScreen>;

  const me = (participants as any[]).find(p => p.userId === meId);
  const joined = !!me;
  const completedToday = !!me?.completedToday;
  const total = (participants as any[]).length;
  const doneCount = (participants as any[]).filter(p => p.completedToday).length;
  const ic = challengeIcon(c);

  const rearm = () => community.listMyJoinedChallenges().then(rearmChallengeNotifications).catch(() => {});

  const join = async () => {
    if (guard() || busy) return;
    setBusy(true);
    try { await community.joinChallenge(challengeId); await load(); rearm(); } finally { setBusy(false); }
  };
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try { await community.leaveChallenge(challengeId); await load(); rearm(); } finally { setBusy(false); }
  };
  const markDone = async () => {
    if (guard() || busy || completedToday) return;
    setBusy(true);
    try { await community.logChallengeProgress(challengeId, 1); await load(); } finally { setBusy(false); }
  };
  const toggleShare = async () => { await community.setShareDetail(challengeId, !me?.shareDetail); load(); };

  return (
    <SubScreen title="" onBack={onBack}>
      <div className="px-6 pb-24 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary">
            <GoalIcon icon={ic.icon} iconImage={ic.iconImage} className="material-symbols-outlined text-2xl w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {c.groupId ? t('community.challengeInCircle', { name: c.groupName || '' }) : t('community.challengeGlobalBadge')}
              {' · '}{t('community.challengeEnds', { date: fmtDate(c.endsOn) })}
            </p>
          </div>
        </div>

        {c.status === 'pending' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-600 dark:text-amber-400">{t('community.pendingApproval')}</div>
        )}
        {c.description && <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">{c.description}</p>}

        <div className="flex gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">{t('community.participantsCount', { count: total })}</span>
          <span className="text-gray-500 dark:text-gray-400">{t('community.completedTodayCount', { count: doneCount })}</span>
        </div>

        {c.status === 'active' && (
          <div className="space-y-2">
            {!joined ? (
              <button onClick={join} disabled={busy} className={primaryBtn}>{t('community.joinChallenge')}</button>
            ) : (
              <>
                <button onClick={markDone} disabled={busy || completedToday} className={completedToday ? ghostBtn : primaryBtn}>
                  <span className="material-symbols-outlined text-lg">{completedToday ? 'check_circle' : 'radio_button_unchecked'}</span>
                  {completedToday ? t('community.doneToday') : t('community.markTodayDone')}
                </button>
                {me?.progressCount != null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{t('community.myProgressCount', { count: me.progressCount })}</p>
                )}
                <label className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 py-1">
                  <span>{t('community.shareMyProgress')}</span>
                  <input type="checkbox" checked={!!me?.shareDetail} onChange={toggleShare} className="size-5 accent-primary" />
                </label>
                <button onClick={leave} className="w-full text-sm font-bold py-2 text-red-500 dark:text-red-400">{t('community.leaveChallenge')}</button>
              </>
            )}
          </div>
        )}

        {total > 0 && (
          <div className="pt-2 space-y-2">
            {(participants as any[]).map(p => (
              <div key={p.userId} className="flex items-center gap-2 text-sm">
                <Avatar src={p.profile?.avatarUrl ?? undefined} className="size-7 rounded-full" iconClassName="text-xs" />
                <span className="flex-1 text-slate-800 dark:text-gray-200 truncate">{p.profile?.displayName || '…'}</span>
                {p.completedToday && <span className="material-symbols-outlined text-primary text-lg">check_circle</span>}
                {p.progressCount != null && p.userId !== meId && <span className="text-xs text-gray-400">{p.progressCount}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </SubScreen>
  );
};

// ===========================================================================
// Duas tab
// ===========================================================================

const DuasTab: React.FC<{ guard: () => boolean; meId: string | null }> = ({ guard, meId }) => {
  const { t } = useUser();
  const [list, setList] = useState<DuaRequest[] | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(() => community.listDuaRequests().then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return subscribeDuaRequests(
      async row => {
        setList(prev => (prev && !prev.some(d => d.id === row.id) ? [{ id: row.id, authorId: row.author_id, body: row.body, isAnonymous: row.is_anonymous, ameenCount: row.ameen_count ?? 0, createdAt: row.created_at, iSaidAmeen: false }, ...prev] : prev));
      },
      row => {
        setList(prev => prev?.map(d => (d.id === row.id ? { ...d, ameenCount: row.ameen_count ?? d.ameenCount, ...(row.deleted_at ? { _deleted: true } as any : {}) } : d)).filter((d: any) => !d._deleted) ?? prev);
      },
    );
  }, []);

  const toggleAmeen = async (d: DuaRequest) => {
    if (guard()) return;
    const on = !!d.iSaidAmeen;
    setList(prev => prev?.map(x => (x.id === d.id ? { ...x, iSaidAmeen: !on, ameenCount: x.ameenCount + (on ? -1 : 1) } : x)) ?? prev);
    try { await community.toggleAmeen(d.id, on); } catch { load(); }
  };

  return (
    <div className="px-6 pb-24 space-y-4">
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
        <p className="text-sm text-primary text-center font-medium">{t('community.duaHadithQuote')}</p>
      </div>

      {list === null ? <p className="text-sm text-gray-400 py-6">{t('community.loading')}</p>
        : list.length === 0 ? <Empty icon="pan_tool" text={t('community.noDuaRequests')} />
          : list.map(d => (
            <div key={d.id} className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
              <p className="text-slate-900 dark:text-white font-serif text-lg leading-relaxed mb-4">"{d.body}"</p>
              <hr className="border-gray-100 dark:border-white/5 mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium flex items-center gap-2">
                  {d.isAnonymous || !d.author ? t('community.anonymousRequest') : (
                    <><Avatar src={d.author.avatarUrl ?? undefined} className="size-5 rounded-full" iconClassName="text-[10px]" />{d.author.displayName}</>
                  )}
                  {d.authorId === meId && (
                    <button onClick={async () => { if (confirm(t('community.deleteDuaConfirm'))) { await community.softDeleteDua(d.id); load(); } }} className="text-red-500 dark:text-red-400 ml-1">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </span>
                <button
                  onClick={() => toggleAmeen(d)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                    d.iSaidAmeen
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]" style={d.iSaidAmeen ? { fontVariationSettings: "'FILL' 1" } : {}}>volunteer_activism</span>
                  <span className="text-xs font-bold">{t('community.ameenCount', { count: d.ameenCount })}</span>
                </button>
              </div>
            </div>
          ))}

      <button onClick={() => (guard() ? null : setShowCompose(true))} className="fixed bottom-24 right-6 size-14 bg-primary rounded-full shadow-glow flex items-center justify-center text-background-dark hover:scale-105 transition-transform z-20">
        <span className="material-symbols-outlined text-2xl">edit</span>
      </button>

      <DuaComposeSheet
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        onSubmit={async (body, anon) => { const posted = await community.postDuaRequest(body, anon); setList(prev => (prev ? [posted, ...prev] : [posted])); }}
      />
    </div>
  );
};
