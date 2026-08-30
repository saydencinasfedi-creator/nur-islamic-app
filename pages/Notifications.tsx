
import React, { useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useUser } from '../contexts/UserContext';

interface NotificationsProps {
    onBack: () => void;
}

const TYPE_STYLE: Record<string, { bg: string; icon: string }> = {
    prayer: { bg: 'bg-primary/20 text-primary', icon: 'schedule' },
    goal: { bg: 'bg-gold-accent/20 text-gold-accent', icon: 'task_alt' },
    streak: { bg: 'bg-blue-500/20 text-blue-500', icon: 'local_fire_department' },
};

const formatTime = (timestamp: number, yesterdayLabel: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const Notifications: React.FC<NotificationsProps> = ({ onBack }) => {
    const { notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, t } = useUser();

    // Without this Android permission, prayer alarms can silently degrade to inexact timers
    // that Doze/App Standby may delay indefinitely once the app is fully closed — surface it
    // instead of leaving it to the easy-to-miss implicit prompt the plugin shows on first schedule.
    const [exactAlarmGranted, setExactAlarmGranted] = useState(true);
    const [dismissedBanner, setDismissedBanner] = useState(false);

    useEffect(() => {
        LocalNotifications.checkExactNotificationSetting()
            .then(status => setExactAlarmGranted(status.exact_alarm === 'granted'))
            .catch(() => { });
    }, []);

    const requestExactAlarm = () => {
        LocalNotifications.changeExactNotificationSetting()
            .then(status => setExactAlarmGranted(status.exact_alarm === 'granted'))
            .catch(() => { });
    };

    return (
        <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden">
            <header className="flex items-center gap-4 p-6 pt-12 pb-4 bg-background-light dark:bg-background-dark z-10">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <h1 className="text-2xl font-bold tracking-tight flex-1">{t('notifications.title')}</h1>
                {unreadNotificationCount > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs font-medium text-primary hover:text-primary/80">
                        {t('notifications.markAllRead')}
                    </button>
                )}
            </header>

            {!exactAlarmGranted && !dismissedBanner && (
                <div className="mx-6 mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                    <span className="material-symbols-outlined text-amber-500 shrink-0">alarm</span>
                    <div className="flex-1">
                        <h4 className="font-bold text-sm text-amber-600 dark:text-amber-400">{t('notifications.alarmsMayBeDelayed')}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                            {t('notifications.alarmsExplanation')}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={requestExactAlarm} className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:opacity-80">
                                {t('notifications.enable')}
                            </button>
                            <button onClick={() => setDismissedBanner(true)} className="text-xs font-bold text-gray-400 hover:text-gray-500">
                                {t('notifications.dismiss')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 pt-0 no-scrollbar">
                <div className="space-y-4">
                    {notifications.map((item) => {
                        const style = TYPE_STYLE[item.type] ?? TYPE_STYLE.prayer;
                        return (
                            <button
                                key={item.id}
                                onClick={() => markNotificationRead(item.id)}
                                className={`w-full text-left p-4 rounded-2xl bg-white dark:bg-white/5 border shadow-sm flex gap-4 items-start transition-colors ${item.read ? 'border-gray-100 dark:border-white/5 opacity-60' : 'border-primary/20 dark:border-primary/20'}`}
                            >
                                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${style.bg}`}>
                                    <span className="material-symbols-outlined text-[20px]">{style.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-sm">{item.title}</h3>
                                        <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-2">{formatTime(item.timestamp, t('notifications.yesterday'))}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.body}</p>
                                </div>
                                {!item.read && <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5"></span>}
                            </button>
                        );
                    })}
                    {notifications.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4 text-gray-400">
                                <span className="material-symbols-outlined text-3xl">notifications_off</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-500 dark:text-gray-400">{t('notifications.noNotifications')}</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{t('notifications.allCaughtUp')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
