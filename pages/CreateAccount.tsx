import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

interface CreateAccountProps {
    onBack: () => void;
    onSignUp: (name: string, email: string) => void;
    onLogin: () => void;
}

const CreateAccount: React.FC<CreateAccountProps> = ({ onBack, onSignUp, onLogin }) => {
    const { t } = useUser();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name && email && password && confirmPassword) {
            if (password === confirmPassword) {
                onSignUp(name, email);
            } else {
                alert(t('createAccount.passwordsDoNotMatch'));
            }
        }
    };

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden font-display text-gray-900 dark:text-white transition-colors duration-200">
            <div className="flex items-center p-6 pb-2 justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-[#0c8e56] flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-background-dark text-xl font-bold">mosque</span>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
                        {t('createAccount.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-sm">
                        {t('createAccount.subtitle')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.fullNameLabel')}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">person</span>
                            </div>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400"
                                placeholder={t('createAccount.fullNamePlaceholder')}
                                required
                                type="text"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.emailLabel')}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">mail</span>
                            </div>
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400"
                                placeholder={t('createAccount.emailPlaceholder')}
                                required
                                type="email"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('createAccount.passwordLabel')}</label>
                            <a className="text-xs font-medium text-primary hover:text-primary/80 transition-colors" href="#">{t('createAccount.forgotPassword')}</a>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock</span>
                            </div>
                            <input
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-12 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400"
                                placeholder="••••••••"
                                required
                                type={showPassword ? "text" : "password"}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    {showPassword ? 'visibility' : 'visibility_off'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">{t('createAccount.confirmPasswordLabel')}</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock_reset</span>
                            </div>
                            <input
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#152a21] text-gray-900 dark:text-white py-4 pl-11 pr-12 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-sm placeholder:text-gray-400"
                                placeholder="••••••••"
                                required
                                type={showPassword ? "text" : "password"}
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <button
                            type="submit"
                            className="w-full rounded-xl bg-primary hover:bg-[#10d482] text-background-dark font-bold text-base py-4 flex items-center justify-center gap-2 transition-transform active:scale-[0.99] shadow-[0_4px_20px_rgba(19,236,146,0.3)]"
                        >
                            <span>{t('createAccount.signUp')}</span>
                            <span className="material-symbols-outlined text-xl">arrow_forward</span>
                        </button>
                    </div>
                </form>

                <div className="flex-1"></div>

                <div className="text-center pt-8 pb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('createAccount.alreadyHaveAccount')}
                        <button onClick={onLogin} className="font-semibold text-primary hover:text-[#10d482] transition-colors ml-1">{t('createAccount.logIn')}</button>
                    </p>
                </div>
            </div>
            <div className="h-5 bg-background-light dark:bg-background-dark"></div>
        </div>
    );
};

export default CreateAccount;
