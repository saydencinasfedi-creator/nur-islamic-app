import React from 'react';
import { useUser } from '../contexts/UserContext';

interface ContentAIProps {
    onBack: () => void;
}

const ContentAI: React.FC<ContentAIProps> = ({ onBack }) => {
    const { t } = useUser();
    return (
        <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display transition-colors duration-200">
            <header className="flex items-center gap-4 p-6 pt-8">
                <button onClick={onBack} className="flex items-center justify-center size-10 rounded-full bg-gray-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="text-xl font-bold">{t('contentAI.title')}</h1>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-gray-500 dark:text-gray-400">
                <span className="material-symbols-outlined text-6xl mb-4 text-primary opacity-50">smart_toy</span>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{t('contentAI.heading')}</h2>
                <p className="max-w-xs">{t('contentAI.description')}</p>
            </div>
        </div>
    );
};

export default ContentAI;
