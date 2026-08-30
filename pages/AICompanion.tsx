import React, { useState, useRef, useEffect } from 'react';
import MarkdownContent from '../components/MarkdownContent';
import { PageId, User, Message } from '../types';
import { generateSpiritualResponse } from '../services/geminiService';
import { useUser } from '../contexts/UserContext';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import VoiceWaveform from '../components/VoiceWaveform';
import { TranslationKey } from '../services/i18n';

interface AICompanionProps {
    navigate: (page: PageId) => void;
    user: User | null; // Kept for prop compatibility
}

// Suggestion chip prompts — translated via these keys (see locales/en(es)/aiCompanion.ts).
const SUGGESTION_KEYS: TranslationKey[] = [
    'aiCompanion.suggestionPrayerTimes',
    'aiCompanion.suggestionDuasAnxiety',
    'aiCompanion.suggestionProphetStories',
    'aiCompanion.suggestionVersesPatience',
    'aiCompanion.suggestionHowWudu',
    'aiCompanion.suggestionRamadanSignificance',
    'aiCompanion.suggestionDhikrBenefits',
    'aiCompanion.suggestionRightsParents',
    'aiCompanion.suggestionCompanionsStories',
    'aiCompanion.suggestionDuaEtiquette',
    'aiCompanion.suggestionQadar',
    'aiCompanion.suggestionSadaqahVirtues',
    'aiCompanion.suggestionTahajjud',
    'aiCompanion.suggestionRecommendedFasting',
    'aiCompanion.suggestionTafsirFatiha',
    'aiCompanion.suggestionIstikhara',
    'aiCompanion.suggestionJumuahVirtues',
    'aiCompanion.suggestionLaylatulQadr',
    'aiCompanion.suggestionSunnahsEating',
    'aiCompanion.suggestionTypesCharity',
    'aiCompanion.suggestionForgiveness',
    'aiCompanion.suggestionDuaStudying',
    'aiCompanion.suggestionHadithKindness',
    'aiCompanion.suggestionTenPromisedJannah',
    'aiCompanion.suggestionAngels',
    'aiCompanion.suggestionBarzakh',
    'aiCompanion.suggestionSignsJudgement',
    'aiCompanion.suggestionMusaStory',
    'aiCompanion.suggestionYusufStory',
    'aiCompanion.suggestionTawakkul',
    'aiCompanion.suggestionImportanceSalah',
    'aiCompanion.suggestionMarriageAdvice',
    'aiCompanion.suggestionDuaSickPerson',
    'aiCompanion.suggestionWhatBreaksWudu',
    'aiCompanion.suggestionSunnahsSleeping',
    'aiCompanion.suggestionAyatulKursi',
    'aiCompanion.suggestionKahfFriday',
    'aiCompanion.suggestionDuaParents',
    'aiCompanion.suggestionDealingAnger',
    'aiCompanion.suggestionIslamicHealth',
];

const AICompanion: React.FC<AICompanionProps> = ({ navigate }) => {
    const { user, prayerTimes, chatHistory, updateChatHistory, t } = useUser(); // Getting prayerTimes & chatHistory form context

    const allSuggestions = React.useMemo(() => SUGGESTION_KEYS.map(k => t(k)), [t]);

    // Initialize messages from context or default if empty
    const [messages, setMessages] = useState<Message[]>(() => {
        if (chatHistory && chatHistory.length > 0) return chatHistory;
        return [{ role: 'model', text: t('aiCompanion.welcomeMessage', { name: user?.name || 'Ahmed' }), timestamp: new Date() }];
    });

    // Update global context whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            updateChatHistory(messages);
        }
    }, [messages, updateChatHistory]);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showMenu, setShowMenu] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [micLevel, setMicLevel] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previousInputRef = useRef(''); // To store input before current recording session
    const sendOnStopRef = useRef(false); // If true, the next transcript is sent immediately instead of filling the textbox
    const userStoppedRef = useRef(false); // Only true once the user taps a stop button — see listenLoop
    const accumulatedTranscriptRef = useRef('');
    const consecutiveFailuresRef = useRef(0);

    // Initialize random suggestions on mount
    useEffect(() => {
        const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
        setSuggestions(shuffled.slice(0, 3));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Drive the waveform with the real mic level while recording (requires the
    // hand-patched `rmsChanged` event — see project memory). Android's SpeechRecognizer
    // RMS dB roughly ranges -2 (silence) to 10 (loud speech); normalize to 0..1.
    useEffect(() => {
        if (!isRecording) {
            setMicLevel(0);
            return;
        }
        const handlePromise = SpeechRecognition.addListener('rmsChanged', ({ value }) => {
            setMicLevel(Math.max(0, Math.min((value + 2) / 12, 1)));
        });
        return () => {
            handlePromise.then(handle => handle.remove()).catch(() => { });
        };
    }, [isRecording]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // Adjust textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            if (input === '') {
                textareaRef.current.style.height = '24px'; // Force single line when empty to ensure placeholder centering
            } else {
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; // Approx 6 lines max
            }
        }
    }, [input]);

    // Voice Input Logic. The WebView doesn't implement the Web Speech API (same reason
    // Share/TTS needed native plugins), so this uses the native Capacitor plugin instead.
    //
    // Android's SpeechRecognizer auto-stops after a pause in speech (~1-2s of silence),
    // and the intent extras that are supposed to let a caller extend that timeout aren't
    // reliably honored across devices/OS versions. So instead of depending on that, this
    // keeps listening by immediately restarting recognition whenever a session ends on its
    // own — accumulating the transcript across restarts — until the user explicitly taps
    // one of the two stop buttons (tracked via userStoppedRef). Only then does the
    // accumulated text land in the textbox / get sent.
    const listenLoop = async () => {
        try {
            const { matches } = await SpeechRecognition.start({
                language: 'en-US',
                popup: false,
                partialResults: false,
            });
            consecutiveFailuresRef.current = 0;
            if (matches && matches.length > 0) {
                accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current && !accumulatedTranscriptRef.current.endsWith(' ') ? ' ' : '') + matches[0];
            }
        } catch (err) {
            console.error('Speech recognition error', err);
            consecutiveFailuresRef.current += 1;
        }

        // Give up after several immediate failures in a row (e.g. permission revoked
        // mid-session) instead of spinning forever.
        if (userStoppedRef.current || consecutiveFailuresRef.current >= 4) {
            const transcript = accumulatedTranscriptRef.current;
            if (sendOnStopRef.current) {
                sendOnStopRef.current = false;
                sendMessage(transcript);
            } else {
                setInput(transcript);
            }
            setIsRecording(false);
            return;
        }

        listenLoop();
    };

    const requestStop = (sendDirectly: boolean) => {
        if (!isRecording) return;
        userStoppedRef.current = true;
        sendOnStopRef.current = sendDirectly;
        SpeechRecognition.stop().catch(() => { });
    };

    const toggleRecording = async () => {
        if (isRecording) {
            requestStop(false);
            return;
        }

        try {
            const status = await SpeechRecognition.checkPermissions();
            if (status.speechRecognition !== 'granted') {
                const requested = await SpeechRecognition.requestPermissions();
                if (requested.speechRecognition !== 'granted') {
                    alert(t('aiCompanion.micPermissionRequired'));
                    return;
                }
            }
        } catch (err) {
            console.error('Error checking microphone permission', err);
            return;
        }

        // Store the existing input plus a space if it has text and no trailing space
        previousInputRef.current = input + (input.length > 0 && !input.endsWith(' ') ? ' ' : '');
        accumulatedTranscriptRef.current = previousInputRef.current;
        userStoppedRef.current = false;
        sendOnStopRef.current = false;
        consecutiveFailuresRef.current = 0;
        setIsRecording(true);
        listenLoop();
    };

    // Stop recording and send the transcript straight to the chat, skipping the textbox.
    const handleStopAndSend = () => requestStop(true);

    const getNewSuggestion = (current: string[]) => {
        const available = allSuggestions.filter(s => !current.includes(s));
        if (available.length === 0) return allSuggestions[Math.floor(Math.random() * allSuggestions.length)];
        return available[Math.floor(Math.random() * available.length)];
    };

    const handleSuggestionClick = (suggestion: string, index: number) => {
        setInput(suggestion);
        setSuggestions(prev => {
            const newCtx = [...prev];
            newCtx[index] = getNewSuggestion(newCtx);
            return newCtx;
        });
    };

    const handleClearChat = () => {
        const newMessages: Message[] = [
            { role: 'model', text: t('aiCompanion.clearedMessage', { name: user?.name || 'Ahmed' }), timestamp: new Date() }
        ];
        setMessages(newMessages);
        updateChatHistory(newMessages); // Clear global
        setShowMenu(false);
    };

    const handleHelp = () => {
        setShowMenu(false);
        const helpMessage: Message = { role: 'user', text: t('aiCompanion.helpRequestLabel'), timestamp: new Date() };
        setMessages(prev => [...prev, helpMessage]);
        setLoading(true);

        // Simulate AI thinking delay for realism
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'model', text: t('aiCompanion.helpMessage'), timestamp: new Date() }]);
            setLoading(false);
        }, 1000);
    };

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        const userMessage: Message = { role: 'user', text: trimmed, timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        setLoading(true);

        // Reset textarea height to auto/single line
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Will trigger useEffect to resize to min
        }

        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const context = user?.location
            ? `User Location: ${user.location.city}, ${user.location.country}.
               Prayer Times Today:
               Fajr: ${prayerTimes?.Fajr || 'N/A'},
               Dhuhr: ${prayerTimes?.Dhuhr || 'N/A'},
               Asr: ${prayerTimes?.Asr || 'N/A'},
               Maghrib: ${prayerTimes?.Maghrib || 'N/A'},
               Isha: ${prayerTimes?.Isha || 'N/A'}.
               Use strictly these times for queries.`
            : "User location is unknown.";

        const response = await generateSpiritualResponse(trimmed, history, context);

        setMessages(prev => [...prev, { role: 'model', text: response, timestamp: new Date() }]);
        setLoading(false);
    };

    const handleSend = () => {
        if (!input.trim() || loading) return;

        if (isRecording) {
            SpeechRecognition.stop().catch(() => { });
            setIsRecording(false);
        }

        const text = input;
        setInput('');
        sendMessage(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div
            className="relative flex w-full flex-col overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200"
            style={{ height: 'calc(100vh - env(safe-area-inset-top, 0px))' }}
        >
            <div className="absolute left-0 right-0 z-[60] bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm" style={{ top: 'calc(-1 * env(safe-area-inset-top, 0px))', height: 'env(safe-area-inset-top, 0px)' }}></div>
            <header className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm z-10 relative">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-primary">smart_toy</span>
                    </div>
                    <div>
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">{t('aiCompanion.title')}</h2>
                        <div className="flex items-center gap-1.5">
                            <span className={`size-1.5 rounded-full ${loading ? 'bg-amber-400' : 'bg-primary'} animate-pulse`}></span>
                            <span className={`text-xs font-medium ${loading ? 'text-amber-400' : 'text-primary'}`}>{loading ? t('aiCompanion.thinking') : t('aiCompanion.online')}</span>
                        </div>
                    </div>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className={`flex items-center justify-center rounded-full size-10 transition-colors ${showMenu ? 'bg-gray-100 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div className="absolute right-0 top-12 w-48 bg-white dark:bg-card-dark border border-gray-100 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={handleClearChat}
                                className="w-full text-left px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-400/10 flex items-center gap-2 transition-colors font-medium"
                            >
                                <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                                {t('aiCompanion.clearChat')}
                            </button>
                            <button
                                onClick={handleHelp}
                                className="w-full text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition-colors border-t border-gray-100 dark:border-white/5"
                            >
                                <span className="material-symbols-outlined text-[18px]">help</span>
                                {t('aiCompanion.help')}
                            </button>
                        </div>
                    )}

                    {/* Backdrop for menu */}
                    {showMenu && (
                        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                    )}
                </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 pb-48 no-scrollbar scroll-smooth">
                <div className="mb-8 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/20 rounded-xl flex gap-3 items-start">
                    <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 shrink-0 text-sm mt-0.5">info</span>
                    <p className="text-xs text-blue-800 dark:text-blue-100/80 leading-relaxed">
                        {t('aiCompanion.disclaimer')}
                    </p>
                </div>

                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 mb-6 ${m.role === 'user' ? 'flex-col items-end' : ''}`}>
                        {m.role === 'model' && (
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/10 self-end mb-1">
                                <span className="material-symbols-outlined text-xs">smart_toy</span>
                            </div>
                        )}
                        <div className={`flex flex-col gap-1 ${m.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%]'}`}>
                            <div className={`${m.role === 'user' ? 'bg-primary text-background-dark font-semibold' : 'bg-white dark:bg-card-dark text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-white/5'} p-4 rounded-2xl ${m.role === 'user' ? 'rounded-br-none' : 'rounded-bl-none'} text-sm leading-relaxed shadow-soft prose prose-sm dark:prose-invert max-w-none`}>
                                {/* Render Markdown content */}
                                <MarkdownContent>{m.text}</MarkdownContent>
                            </div>
                            <span className={`text-[10px] text-gray-500 dark:text-gray-400 ${m.role === 'user' ? 'mr-1 self-end' : 'ml-1'}`}>
                                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3 mb-6">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/10 self-end mb-1">
                            <span className="material-symbols-outlined text-xs">smart_toy</span>
                        </div>
                        <div className="bg-white dark:bg-card-dark p-4 rounded-2xl rounded-bl-none border border-gray-100 dark:border-white/5 flex items-center gap-2">
                            <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 pointer-events-none">
                <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/90 dark:via-background-dark/90 to-transparent -z-10"></div>
                <div className="px-4 pb-[6.5rem] w-full pointer-events-auto">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 px-1">
                        {suggestions.map((suggestion, idx) => (
                            <button
                                key={`${suggestion}-${idx}`}
                                onClick={() => handleSuggestionClick(suggestion, idx)}
                                className="shrink-0 text-xs font-medium bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300 shadow-sm active:scale-95"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                    <div className={`bg-white dark:bg-[#1A2E25] p-2 ${isRecording ? 'pl-3' : 'pl-5'} rounded-[28px] border transition-colors flex items-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] ring-1 ${isRecording ? 'border-primary/50 ring-primary/50 shadow-glow' : 'border-gray-200 dark:border-white/10 ring-gray-100 dark:ring-white/5'}`}>
                        {isRecording ? (
                            <>
                                <VoiceWaveform level={micLevel} />
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={toggleRecording}
                                        title={t('aiCompanion.stopAndWrite')}
                                        className="size-11 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 active:scale-95 transition-all"
                                    >
                                        <span className="material-symbols-outlined">stop</span>
                                    </button>
                                    <button
                                        onClick={handleStopAndSend}
                                        title={t('aiCompanion.stopAndSend')}
                                        className="size-11 rounded-2xl bg-primary text-background-dark shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                                    >
                                        <span className="material-symbols-outlined filled" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    className="bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 w-full text-sm p-0 ml-1 resize-none overflow-y-auto max-h-[120px] leading-[24px]"
                                    placeholder={t('aiCompanion.inputPlaceholder')}
                                    style={{ minHeight: '24px' }}
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={toggleRecording}
                                        className="p-2 transition-all rounded-full text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-white/5"
                                    >
                                        <span className="material-symbols-outlined">mic</span>
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() && !loading}
                                        className={`size-10 rounded-full flex items-center justify-center transition-all ${input.trim() ? 'bg-primary text-background-dark shadow-glow hover:scale-105' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`}
                                    >
                                        <span className="material-symbols-outlined filled" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AICompanion;
