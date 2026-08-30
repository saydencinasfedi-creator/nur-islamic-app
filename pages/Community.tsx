import React, { useState, useEffect } from 'react';
import { PageId } from '../types';
import { useUser } from '../contexts/UserContext';
import { TranslationKey } from '../services/i18n';

interface CommunityProps {
  navigate: (page: PageId) => void;
}

const TABS = ['Overview', 'Challenges', 'Circles', 'Dua Requests'] as const;
const TAB_LABEL_KEYS: Record<typeof TABS[number], TranslationKey> = {
  'Overview': 'community.tabOverview',
  'Challenges': 'community.tabChallenges',
  'Circles': 'community.tabCircles',
  'Dua Requests': 'community.tabDuaRequests',
};

const Community: React.FC<CommunityProps> = ({ navigate }) => {
  const { t } = useUser();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Overview');
  const [salawatCount, setSalawatCount] = useState(2543890);
  const [joinedChallenges, setJoinedChallenges] = useState<string[]>([]);
  const [joinedCircles, setJoinedCircles] = useState<string[]>([]);
  const [ameenGiven, setAmeenGiven] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Simulate live counter
  useEffect(() => {
    const interval = setInterval(() => {
      setSalawatCount(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleContribute = () => {
    setSalawatCount(prev => prev + 1);
  };

  const toggleChallenge = (id: string) => {
    setJoinedChallenges(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleCircle = (id: string) => {
    setJoinedCircles(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleAmeen = (id: string) => {
    setAmeenGiven(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  // Mock Data — titleKey/descKey/tagKey point at locales/en(es)/community.ts
  const challenges: { id: string; titleKey: TranslationKey; descKey: TranslationKey; tagKey: TranslationKey; color: string; bg: string; icon: string }[] = [
    { id: 'c1', titleKey: 'community.challengeFajrTitle', descKey: 'community.challengeFajrDesc', tagKey: 'community.challengeFajrTag', color: 'text-indigo-400', bg: 'bg-indigo-500/10', icon: 'wb_twilight' },
    { id: 'c2', titleKey: 'community.challengeKahfTitle', descKey: 'community.challengeKahfDesc', tagKey: 'community.challengeKahfTag', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: 'auto_stories' },
    { id: 'c3', titleKey: 'community.challengeDetoxTitle', descKey: 'community.challengeDetoxDesc', tagKey: 'community.challengeDetoxTag', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: 'smartphone' },
    { id: 'c4', titleKey: 'community.challengeCharityTitle', descKey: 'community.challengeCharityDesc', tagKey: 'community.challengeCharityTag', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: 'volunteer_activism' },
  ];

  const circles: { id: string; nameKey: TranslationKey; members: string; descKey: TranslationKey }[] = [
    { id: 'g1', nameKey: 'community.circleAdhkarName', members: '12.4k', descKey: 'community.circleAdhkarDesc' },
    { id: 'g2', nameKey: 'community.circleQuranName', members: '8.2k', descKey: 'community.circleQuranDesc' },
    { id: 'g3', nameKey: 'community.circleQiyamName', members: '5.1k', descKey: 'community.circleQiyamDesc' },
  ];

  const duas: { id: string; textKey: TranslationKey; count: number }[] = [
    { id: 'd1', textKey: 'community.duaExamsText', count: 42 },
    { id: 'd2', textKey: 'community.duaMotherText', count: 128 },
    { id: 'd3', textKey: 'community.duaFamilyText', count: 89 },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Overview':
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
                  <h1 className="text-4xl font-bold tracking-tight text-white tabular-nums">{salawatCount.toLocaleString()}</h1>
                  <p className="text-gray-300 font-medium text-sm mt-1 mb-6">{t('community.salawatRecitedToday')}</p>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 rounded-full p-2 text-primary"><span className="material-symbols-outlined text-[20px]">touch_app</span></div>
                      <div className="text-sm"><p className="text-white font-medium">{t('community.contribute')}</p><p className="text-xs text-gray-400">{t('community.tapToAddAnonymously')}</p></div>
                    </div>
                    <button
                      onClick={handleContribute}
                      className="size-8 rounded-full bg-primary flex items-center justify-center text-background-dark hover:scale-105 active:scale-95 transition-transform"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 mb-8">
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t('community.weeklyChallenges')}</h3>
                <button onClick={() => setActiveTab('Challenges')} className="text-sm font-medium text-primary hover:text-primary/80">{t('community.viewAll')}</button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {challenges.slice(0, 3).map(ch => (
                  <div key={ch.id} className="min-w-[220px] bg-white dark:bg-card-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 relative group hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`${ch.bg} p-2.5 rounded-xl ${ch.color} border border-gray-100 dark:border-white/5`}><span className="material-symbols-outlined">{ch.icon}</span></div>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-black/20 px-2 py-1 rounded-full border border-gray-100 dark:border-white/5">{t(ch.tagKey)}</span>
                    </div>
                    <h4 className="text-slate-900 dark:text-white font-bold text-lg leading-tight mb-1">{t(ch.titleKey)}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{t(ch.descKey)}</p>
                    <button
                      onClick={() => toggleChallenge(ch.id)}
                      className={`w-full text-sm font-bold py-2.5 rounded-xl border transition-colors ${joinedChallenges.includes(ch.id) ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-slate-900 dark:text-white border-gray-200 dark:border-white/10'}`}
                    >
                      {joinedChallenges.includes(ch.id) ? t('community.joined') : t('community.joinAnonymously')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 mb-8">
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">{t('community.activeCircles')}</h3>
                <button onClick={() => setActiveTab('Circles')} className="text-sm font-medium text-primary hover:text-primary/80">{t('community.viewAll')}</button>
              </div>
              <div className="space-y-3">
                {circles.slice(0, 2).map((circle) => (
                  <div key={circle.id} className="bg-white dark:bg-card-dark p-4 rounded-xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <h4 className="text-slate-900 dark:text-white font-bold">{t(circle.nameKey)}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('community.membersCount', { count: circle.members })}</p>
                    </div>
                    <button
                      onClick={() => toggleCircle(circle.id)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors ${joinedCircles.includes(circle.id) ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                    >
                      {joinedCircles.includes(circle.id) ? t('community.joined') : t('community.join')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      case 'Challenges':
        return (
          <div className="px-6 pb-24 space-y-4">
            {challenges.map(ch => (
              <div key={ch.id} className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 relative group hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className={`${ch.bg} p-2.5 rounded-xl ${ch.color} border border-gray-100 dark:border-white/5`}><span className="material-symbols-outlined">{ch.icon}</span></div>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-black/20 px-2 py-1 rounded-full border border-gray-100 dark:border-white/5">{t(ch.tagKey)}</span>
                </div>
                <h4 className="text-slate-900 dark:text-white font-bold text-lg leading-tight mb-1">{t(ch.titleKey)}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t(ch.descKey)}</p>
                <button
                  onClick={() => toggleChallenge(ch.id)}
                  className={`w-full text-sm font-bold py-3 rounded-xl border transition-colors ${joinedChallenges.includes(ch.id) ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-slate-900 dark:text-white border-gray-200 dark:border-white/10'}`}
                >
                  {joinedChallenges.includes(ch.id) ? t('community.joined') : t('community.joinChallenge')}
                </button>
              </div>
            ))}
          </div>
        );
      case 'Circles':
        return (
          <div className="px-6 pb-24 space-y-3">
            {circles.map((circle) => (
              <div key={circle.id} className="bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-slate-900 dark:text-white font-bold text-lg">{t(circle.nameKey)}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t(circle.descKey)}</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-white/5">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gray-600 border border-background-light dark:border-background-dark"></div>
                    <div className="w-6 h-6 rounded-full bg-gray-500 border border-background-light dark:border-background-dark"></div>
                    <div className="w-6 h-6 rounded-full bg-gray-400 border border-background-light dark:border-background-dark flex items-center justify-center text-[8px] text-black font-bold">+{parseInt(circle.members)}k</div>
                  </div>
                  <button
                    onClick={() => toggleCircle(circle.id)}
                    className={`px-5 py-2 text-sm font-bold rounded-lg border transition-colors ${joinedCircles.includes(circle.id) ? 'bg-primary text-background-dark border-primary' : 'bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                  >
                    {joinedCircles.includes(circle.id) ? t('community.joined') : t('community.joinCircle')}
                  </button>
                </div>
              </div>
            ))}
            <div className="p-4 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-center py-8 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-gray-500 text-3xl mb-2">add_circle</span>
              <h4 className="text-slate-900 dark:text-white font-semibold">{t('community.createACircle')}</h4>
              <p className="text-xs text-gray-500">{t('community.formPrivateGroup')}</p>
            </div>
          </div>
        );
      case 'Dua Requests':
        return (
          <div className="px-6 pb-24 space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
              <p className="text-sm text-primary text-center font-medium">{t('community.duaHadithQuote')}</p>
            </div>
            {duas.map(dua => (
              <div key={dua.id} className="bg-white dark:bg-card-dark p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                <p className="text-slate-900 dark:text-white font-serif text-lg leading-relaxed mb-4">"{t(dua.textKey)}"</p>
                <hr className="border-gray-100 dark:border-white/5 mb-3" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">{t('community.anonymousRequest')}</span>
                  <button
                    onClick={() => toggleAmeen(dua.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${ameenGiven.includes(dua.id) ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'}`}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${ameenGiven.includes(dua.id) ? 'filled' : ''}`} style={ameenGiven.includes(dua.id) ? { fontVariationSettings: "'FILL' 1" } : {}}>volunteer_activism</span>
                    <span className="text-xs font-bold">{t('community.ameenCount', { count: dua.count + (ameenGiven.includes(dua.id) ? 1 : 0) })}</span>
                  </button>
                </div>
              </div>
            ))}
            <button className="fixed bottom-24 right-6 size-14 bg-primary rounded-full shadow-glow flex items-center justify-center text-background-dark hover:scale-105 transition-transform z-20">
              <span className="material-symbols-outlined text-2xl">edit</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200 pb-32">
      <header className="flex items-center justify-between p-6 pt-8">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-primary uppercase tracking-wider mb-1">{t('community.theUmmah')}</span>
          <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">{t('community.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{t('community.tagline')}</p>
        </div>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className={`relative flex items-center justify-center rounded-full size-10 text-slate-900 dark:text-white shadow-sm border transition-colors ${showNotifications ? 'bg-gray-200 dark:bg-white/10 border-gray-300 dark:border-white/20' : 'bg-gray-100 dark:bg-white/5 border-gray-100 dark:border-white/5'}`}
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2.5 right-2.5 size-2 bg-red-500 rounded-full border border-background-light dark:border-background-dark"></span>
        </button>
      </header>

      <div className="flex gap-3 px-6 pb-6 overflow-x-auto no-scrollbar scroll-smooth">
        {TABS.map(tab => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full px-5 shadow-sm cursor-pointer transition-all ${activeTab === tab ? 'bg-primary text-background-dark shadow-glow font-bold' : 'bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 font-medium'}`}
          >
            <p className="text-sm whitespace-nowrap">{t(TAB_LABEL_KEYS[tab])}</p>
          </div>
        ))}
      </div>

      {renderContent()}

      <div className="px-6 pb-6 text-center mt-auto">
        <div className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-full border border-gray-100 dark:border-white/5">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>shield</span>
          <span className="text-[10px] uppercase tracking-wide font-bold">{t('community.noPersonalDataShared')}</span>
        </div>
      </div>
    </div>
  );
};

export default Community;
