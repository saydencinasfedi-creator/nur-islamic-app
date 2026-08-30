import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

interface OnboardingProps {
  onStart: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onStart }) => {
  const { t } = useUser();
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-xl overflow-hidden transition-colors duration-300">
      <div className="relative w-full h-[18vh] min-h-[160px]">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-background-light dark:to-background-dark z-10"></div>
        <div className="w-full h-full bg-center bg-cover bg-no-repeat opacity-80 dark:opacity-50" style={{ backgroundImage: "url('https://picsum.photos/400/200?blur=10')" }}></div>
        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent z-20"></div>
      </div>

      <div className="flex-1 px-6 relative z-30 -mt-8 flex flex-col items-center">
        <div className="w-full text-center mb-6">
          <h1 className="text-slate-900 dark:text-white tracking-tight text-[34px] font-bold leading-tight mb-3">
            {t('onboarding.headline1')}<br />{t('onboarding.headline2')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
            {t('onboarding.subheadline')}
          </p>
        </div>

        <div className="w-full flex flex-col gap-3 mb-8">
          {[
            { icon: 'lock', title: t('onboarding.privacyFirstTitle'), desc: t('onboarding.privacyFirstDesc') },
            { icon: 'auto_awesome', title: t('onboarding.zeroAdsTitle'), desc: t('onboarding.zeroAdsDesc') },
            { icon: 'spa', title: t('onboarding.spiritualFocusTitle'), desc: t('onboarding.spiritualFocusDesc') }
          ].map(item => (
            <div key={item.title} className="group flex gap-4 bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 transition-all hover:shadow-md hover:border-primary/30">
              <div className="flex items-center justify-center rounded-full bg-primary/10 shrink-0 size-12 text-primary">
                <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-slate-900 dark:text-gray-100 text-[15px] font-semibold leading-normal mb-0.5">{item.title}</p>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-normal leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 w-full p-6 pt-4 bg-gradient-to-t from-background-light via-background-light/95 to-transparent dark:from-background-dark dark:via-background-dark/95 z-40">
        <button
          onClick={onStart}
          className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 text-white font-bold text-lg h-14 rounded-full shadow-lg shadow-primary/25 flex items-center justify-center gap-2 group border border-transparent dark:border-white/10"
        >
          <span>{t('onboarding.startMyPractice')}</span>
          <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">arrow_forward</span>
        </button>
        <div className="text-center mt-4">
          <button onClick={() => setShowPrivacy(true)} className="text-gray-400 hover:text-primary text-xs font-medium transition-colors">
            {t('onboarding.readFullPrivacyPolicy')}
          </button>
        </div>
      </div>

      {showPrivacy && (
        <div className="absolute inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('onboarding.privacyPolicyTitle')}</h2>
            <button onClick={() => setShowPrivacy(false)} className="size-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-gray-400">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-6 pb-20">
            <div className="space-y-2">
              <p className="font-bold text-lg text-slate-900 dark:text-white">{t('onboarding.privacySection1Title')}</p>
              <p>{t('onboarding.privacySection1Body')}</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-lg text-slate-900 dark:text-white">{t('onboarding.privacySection2Title')}</p>
              <p>{t('onboarding.privacySection2Body')}</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-primary">
                <li><strong>{t('onboarding.privacyLocationDataLabel')}</strong> {t('onboarding.privacyLocationDataBody')}</li>
                <li><strong>{t('onboarding.privacyUsageDataLabel')}</strong> {t('onboarding.privacyUsageDataBody')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-lg text-slate-900 dark:text-white">{t('onboarding.privacySection3Title')}</p>
              <p>{t('onboarding.privacySection3Intro')}</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-primary">
                <li>{t('onboarding.privacySection3Item1')}</li>
                <li>{t('onboarding.privacySection3Item2')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-lg text-slate-900 dark:text-white">{t('onboarding.privacySection4Title')}</p>
              <p>{t('onboarding.privacySection4Intro')}</p>
              <ul className="list-disc pl-5 space-y-1 marker:text-primary">
                <li><strong>{t('onboarding.privacyAladhanLabel')}</strong> {t('onboarding.privacyAladhanBody')}</li>
              </ul>
              <p>{t('onboarding.privacySection4Footer')}</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-lg text-slate-900 dark:text-white">{t('onboarding.privacySection5Title')}</p>
              <p>{t('onboarding.privacySection5Body')}</p>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-lg text-slate-900 dark:text-white">{t('onboarding.privacySection6Title')}</p>
              <p>{t('onboarding.privacySection6Body')}</p>
            </div>

            <div className="text-center pt-8 text-xs text-gray-400">
              <p>{t('onboarding.privacyLastUpdated')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
