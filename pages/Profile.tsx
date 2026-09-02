
import React, { useState, useEffect, useRef } from 'react';
import { PageId, User } from '../types';
import Avatar from '../components/Avatar';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { pushBackHandler } from '../services/backHandlerStack';

interface ProfileProps {
  navigate: (page: PageId) => void;
  user: User | null; // Kept for prop compatibility but prefer context locallly
  onSignOut: () => void;
}

const Profile: React.FC<ProfileProps> = ({ navigate, onSignOut }) => {
  const { user, updateUser, location, updateLocationManual, totalPrayersCompleted, prayerStreak, goalsTodayPercent, notifSettings, updateNotifSettings, t } = useUser();
  const { bypassed, profile: communityProfile, saveProfile } = useAuth();

  // Modal States
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showImageEdit, setShowImageEdit] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [openStat, setOpenStat] = useState<string | null>(null);

  // Edit Form State
  const [editName, setEditName] = useState(user?.name || '');
  const [editLocation, setEditLocation] = useState('');
  const [isAutoLocation, setIsAutoLocation] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Update edit fields when user/location changes
  useEffect(() => {
    if (user) setEditName(user.name);
    if (location) {
      setEditLocation(`${location.city}, ${location.country}`);
      // If user has not manually set a location different from the detected one, assume auto
      // For MVP, we'll just flag it based on if it matches current context location exactly
    }
  }, [user, location]);

  // Mock Achievements
  const allAchievements = [
    { title: t('profile.achEarlyBird'), icon: 'military_tech', color: 'text-gold-accent', bg: 'from-yellow-600/20 to-yellow-900/20', unlocked: true },
    { title: t('profile.achRamadan'), icon: 'star', color: 'text-primary', bg: 'from-primary/20 to-green-900/20', unlocked: true },
    { title: t('profile.achQuranFinisher'), icon: 'menu_book', color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-900/20', unlocked: true },
    { title: t('profile.achTahajjudWarrior'), icon: 'nights_stay', color: 'text-indigo-400', bg: 'from-indigo-500/20 to-purple-900/20', unlocked: false },
    { title: t('profile.achConsistencyKing'), icon: 'repeat', color: 'text-emerald-400', bg: 'from-emerald-500/20 to-teal-900/20', unlocked: false },
    { title: t('profile.achDuaSeeker'), icon: 'volunteer_activism', color: 'text-rose-400', bg: 'from-rose-500/20 to-red-900/20', unlocked: false },
    { title: t('profile.achKnowledge'), icon: 'school', color: 'text-amber-400', bg: 'from-amber-500/20 to-orange-900/20', unlocked: false },
    { title: t('profile.achCharityGiver'), icon: 'savings', color: 'text-teal-400', bg: 'from-teal-500/20 to-cyan-900/20', unlocked: false },
    { title: t('profile.achCommunityPillar'), icon: 'groups', color: 'text-purple-400', bg: 'from-purple-500/20 to-violet-900/20', unlocked: false },
  ];

  const handleEditOpen = () => {
    setEditName(user?.name || '');
    if (location) {
      setEditLocation(location.city); // Just show city for easier editing
    }
    setShowEditProfile(true);
  }

  const handleSaveProfile = async () => {
    setIsSaving(true);
    updateUser({ name: editName });

    // Check if location changed
    if (location && editLocation.trim().toLowerCase() !== location.city.toLowerCase()) {
      const success = await updateLocationManual(editLocation);
      if (!success) {
        alert(t('profile.locationNotFoundAlert'));
        setIsSaving(false);
        return;
      }
      setIsAutoLocation(false);
    }

    setIsSaving(false);
    setShowEditProfile(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        updateUser({ avatar: result });
        // Best-effort: this is also the photo other members see in chat/DMs/member
        // lists (a separate Supabase-backed profile from this local one) — keep them
        // in sync. No-ops quietly on a bypassed/offline build or if the request fails.
        // saveProfile does a full upsert, so the rest of the existing profile (bio,
        // age range, languages, interests) must be carried over here too — otherwise
        // changing your photo would silently wipe them.
        if (!bypassed) {
          saveProfile({
            ...communityProfile,
            avatarUrl: result,
            displayName: communityProfile?.displayName || user?.name || '',
          }).catch(() => {});
        }
        setShowImageEdit(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const triggerCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const toggleNotif = (key: keyof typeof notifSettings) => {
    updateNotifSettings({ [key]: !notifSettings[key] });
  };

  // Android back/gesture closes the stat info popover instead of leaving the page.
  useEffect(() => {
    if (!openStat) return;
    return pushBackHandler(() => {
      setOpenStat(null);
      return true;
    });
  }, [openStat]);

  const stats = [
    { id: 'streak', label: t('profile.statDayStreakLabel'), value: `${prayerStreak}`, icon: 'local_fire_department', color: 'text-orange-400', bg: 'bg-orange-500/10', info: t('profile.statStreakInfo') },
    { id: 'goals', label: t('profile.statGoalsLabel'), value: `${Math.round(goalsTodayPercent)}%`, icon: 'check_circle', color: 'text-primary', bg: 'bg-primary/10', info: t('profile.statGoalsInfo') },
    { id: 'prayers', label: t('profile.statPrayersLabel'), value: `${totalPrayersCompleted}`, icon: 'mosque', color: 'text-blue-400', bg: 'bg-blue-500/10', info: t('profile.statPrayersInfo') },
  ];

  if (!user) return null;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200 pb-32">
      <header className="flex items-center justify-between p-6 pt-8">
        <h2 className="text-2xl font-bold tracking-tight">{t('profile.title')}</h2>
        <button
          onClick={() => navigate('settings')}
          className="flex items-center justify-center rounded-full size-10 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-gray-100 dark:border-white/5"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* Hidden File Inputs: `capture` is what actually tells the mobile browser to open the
          camera app directly instead of the gallery/file picker — without it, both buttons
          would open the same picker. */}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="user" onChange={handleFileSelect} />

      <div className="flex flex-col items-center px-6 mb-8 text-center">
        <div className="relative mb-4 group cursor-pointer" onClick={() => setShowImageEdit(true)}>
          <Avatar src={user.avatar} className="rounded-full size-28 border-4 border-white dark:border-card-dark shadow-glow transition-transform group-hover:scale-105" iconClassName="text-5xl" />
          <div className="absolute bottom-1 right-1 size-8 bg-primary rounded-full border-4 border-background-light dark:border-background-dark flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-background-dark text-[16px] font-bold">edit</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{user.name}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('profile.memberSince', { date: user.memberSince })}</p>
        {(user.isPremium) && (
          <div className="inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[16px] filled" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            <span className="text-xs font-semibold text-primary">{t('profile.premiumMember')}</span>
          </div>
        )}
      </div>

      <div className="px-6 mb-8">
        {openStat && (
          <div className="fixed inset-0 z-20" onClick={() => setOpenStat(null)}></div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, idx) => {
            // The popover is wider than a single grid column — centering it on the button
            // itself (as if every card had room on both sides) pushes it off-screen for the
            // first/last cards, which only have room on one side. Anchor to whichever edge of
            // the card actually has room, and only center for the middle card.
            const align = idx === 0 ? 'left' : idx === stats.length - 1 ? 'right' : 'center';
            const boxAlignClass = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const arrowAlignClass = align === 'left' ? 'left-6' : align === 'right' ? 'right-6' : 'left-1/2 -translate-x-1/2';
            return (
              <div key={stat.id} className="relative">
                <button
                  onClick={() => setOpenStat(prev => prev === stat.id ? null : stat.id)}
                  className="w-full bg-white dark:bg-card-dark p-4 rounded-2xl border border-gray-100 dark:border-white/5 flex flex-col items-center justify-center gap-2 shadow-soft hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className={`size-10 rounded-full ${stat.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <span className={`material-symbols-outlined ${stat.color}`}>{stat.icon}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold whitespace-nowrap">{stat.label}</span>
                  </div>
                </button>
                {openStat === stat.id && (
                  <div className={`absolute bottom-full ${boxAlignClass} mb-2 w-48 max-w-[calc(100vw-3rem)] bg-white dark:bg-[#1a2e25] border border-gray-100 dark:border-white/10 rounded-lg shadow-2xl p-3 z-30 animate-in fade-in zoom-in-95 duration-150`}>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{stat.info}</p>
                    <div className={`absolute top-full ${arrowAlignClass} -mt-px w-3 h-3 bg-white dark:bg-[#1a2e25] border-b border-r border-gray-100 dark:border-white/10 rotate-45`}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-end px-6 mb-4">
          <h3 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">{t('profile.achievementsTitle')}</h3>
          <button onClick={() => setShowAchievements(true)} className="text-xs font-medium text-primary hover:text-primary/80">{t('profile.viewAll')}</button>
        </div>
        <div className="flex gap-4 px-6 pt-4 overflow-x-auto no-scrollbar pb-2">
          {allAchievements.slice(0, 3).map((ach, i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0">
              <div className={`size-16 rounded-full bg-gradient-to-br ${ach.bg} border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-glow`}>
                <span className={`material-symbols-outlined ${ach.color} text-3xl`}>{ach.icon}</span>
              </div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{ach.title}</p>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2 shrink-0 opacity-50">
            <div className="size-16 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center border-dashed">
              <span className="material-symbols-outlined text-gray-500 text-3xl">lock</span>
            </div>
            <p className="text-xs font-medium text-gray-500">{t('profile.locked')}</p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-6">
        <h3 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 pl-2">{t('profile.preferencesTitle')}</h3>
        <div className="bg-white dark:bg-card-dark rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-soft">
          <button onClick={handleEditOpen} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 group">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-xl">person_outline</span>
              </div>
              <div className="text-left">
                <span className="block font-medium text-sm text-slate-900 dark:text-white">{t('profile.personalInformation')}</span>
                <span className="block text-xs text-gray-500">{t('profile.nameLocation')}</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 group-hover:text-primary transition-colors text-xl">chevron_right</span>
          </button>
          <button onClick={() => setShowNotifications(true)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 group">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-xl">notifications_none</span>
              </div>
              <div className="text-left">
                <span className="block font-medium text-sm text-slate-900 dark:text-white">{t('profile.notifications')}</span>
                <span className="block text-xs text-gray-500">{t('profile.adhanReminders')}</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 group-hover:text-primary transition-colors text-xl">chevron_right</span>
          </button>
          <button onClick={() => navigate('data-privacy')} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-xl">shield</span>
              </div>
              <div className="text-left">
                <span className="block font-medium text-sm text-slate-900 dark:text-white">{t('profile.privacyData')}</span>
                <span className="block text-xs text-primary">{t('profile.storedLocally')}</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 group-hover:text-primary transition-colors text-xl">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="px-6 mb-8">
        <h3 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 pl-2">{t('profile.appTitle')}</h3>
        <div className="bg-white dark:bg-card-dark rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 shadow-soft">
          <button
            onClick={() => setShowSupport(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 group"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-xl">help_outline</span>
              </div>
              <span className="font-medium text-sm text-slate-900 dark:text-white">{t('profile.helpSupport')}</span>
            </div>
            <span className="material-symbols-outlined text-gray-400 dark:text-gray-600 group-hover:text-primary transition-colors text-xl">chevron_right</span>
          </button>
          <button onClick={onSignOut} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 dark:text-red-400 group-hover:bg-red-500/20 transition-colors">
                <span className="material-symbols-outlined text-xl">logout</span>
              </div>
              <span className="font-medium text-sm text-red-500 dark:text-red-400">{t('profile.signOut')}</span>
            </div>
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 text-center">
        <p className="text-[10px] text-gray-500 dark:text-gray-600">v2.4.0</p>
      </div>

      {/* MODALS */}

      {/* Upload Image Modal */}
      {showImageEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200" onClick={() => setShowImageEdit(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">{t('profile.updatePhoto')}</h3>
            <div className="flex justify-center mb-8">
              <Avatar src={user.avatar} className="rounded-full size-32 border-4 border-primary shadow-glow" iconClassName="text-6xl" />
            </div>
            <div className="space-y-3">
              <button onClick={triggerFileSelect} className="w-full py-4 rounded-xl font-bold bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">image</span>
                {t('profile.chooseFromGallery')}
              </button>
              <button onClick={triggerCameraCapture} className="w-full py-4 rounded-xl font-bold bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                <span className="material-symbols-outlined">photo_camera</span>
                {t('profile.takePhoto')}
              </button>
            </div>
            <button onClick={() => setShowImageEdit(false)} className="mt-6 w-full py-3 text-sm font-bold text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors">{t('profile.cancel')}</button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal (Text) */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t('profile.editPersonalInfo')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('profile.displayName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">{t('profile.location')}</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-gray-500">location_on</span>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => {
                      setEditLocation(e.target.value);
                      setIsAutoLocation(false);
                    }}
                    className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isAutoLocation && <span className="text-[10px] text-primary uppercase font-bold bg-gray-100 dark:bg-card-dark/80 px-2 rounded-full backdrop-blur-sm">{t('profile.autoDetected')}</span>}
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-center">
                  {isAutoLocation ? t('profile.autoDetectedHint') : t('profile.manualLocationHint')}
                </p>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowEditProfile(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">{t('profile.cancel')}</button>
              <button onClick={handleSaveProfile} disabled={isSaving} className="flex-1 py-3 rounded-xl font-bold bg-primary text-background-dark shadow-glow hover:scale-105 transition-transform disabled:opacity-50">
                {isSaving ? t('profile.saving') : t('profile.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 dark:bg-black/90 backdrop-blur-md sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-card-dark rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative h-[80vh] flex flex-col">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-6 sm:hidden shrink-0"></div>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('profile.allAchievements')}</h3>
              <button onClick={() => setShowAchievements(false)} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="overflow-y-auto grid grid-cols-3 gap-4 pb-4">
              {allAchievements.map((ach, i) => (
                <div key={i} className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 dark:border-white/5 ${ach.unlocked ? 'bg-gray-50 dark:bg-white/5' : 'opacity-50'}`}>
                  <div className={`size-14 rounded-full bg-gradient-to-br ${ach.bg} border border-gray-100 dark:border-white/10 flex items-center justify-center shadow-glow`}>
                    <span className={`material-symbols-outlined ${ach.color} text-2xl`}>{ach.icon}</span>
                  </div>
                  <p className="text-[10px] font-bold text-center text-gray-600 dark:text-gray-300 leading-tight">{ach.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full mx-auto mb-6 sm:hidden"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('profile.notifications')}</h3>
              <button onClick={() => setShowNotifications(false)} className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              {[
                { key: 'prayerTimes', label: t('profile.prayerTimeAlerts'), desc: t('profile.prayerTimeAlertsDesc') },
                { key: 'dailyGoalReminder', label: t('profile.dailyGoalReminder'), desc: t('profile.dailyGoalReminderDesc') },
                { key: 'streakAchievements', label: t('profile.streakAchievements'), desc: t('profile.streakAchievementsDesc') }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleNotif(item.key as keyof typeof notifSettings)}
                    className={`w-12 h-7 rounded-full p-1 transition-colors relative ${notifSettings[item.key as keyof typeof notifSettings] ? 'bg-primary' : 'bg-gray-300 dark:bg-white/10'}`}
                  >
                    <div className={`size-5 bg-white rounded-full shadow-sm transition-transform ${notifSettings[item.key as keyof typeof notifSettings] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200" onClick={() => setShowSupport(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('profile.contactSupport')}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
              {t('profile.supportDescription')}
            </p>
            <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5 flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary">mail</span>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">{t('profile.emailUs')}</p>
                <p className="text-slate-900 dark:text-white font-medium">salam@nurapp.com</p>
              </div>
            </div>
            <button onClick={() => setShowSupport(false)} className="w-full py-3 rounded-xl font-bold bg-primary text-background-dark shadow-glow hover:scale-105 transition-transform">{t('profile.close')}</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
