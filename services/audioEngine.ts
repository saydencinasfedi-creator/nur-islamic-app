
// services/audioEngine.ts
import AudioFetcherWorker from './audioFetcher.worker.ts?worker';

type AudioEventType = 'timeupdate' | 'trackchange' | 'playing' | 'paused' | 'ended' | 'error' | 'waiting';
type AudioEventHandler = (data?: any) => void;

interface AudioSourceWrapper {
    source: AudioBufferSourceNode;
    gain: GainNode;
    startTime: number; // The audioContext time this source started
    duration: number; // Buffer duration - trim
}

class AudioEngine {
    private static instance: AudioEngine;
    private ctx: AudioContext;
    private masterGain: GainNode;

    // State
    private queue: string[] = [];
    private currentIndex: number = 0;
    private isPlaying: boolean = false;
    private wrapperIndex: number | null = null; // which queue index `currentWrapper` actually belongs to

    // Audio Nodes
    // Audio Nodes
    private currentWrapper: AudioSourceWrapper | null = null;
    private nextWrapper: AudioSourceWrapper | null = null;
    private activeNodes: AudioBufferSourceNode[] = []; // Track ALL sources (legacy/safety)
    private activeSource: AudioBufferSourceNode | null = null;
    private nextSourceNode: AudioBufferSourceNode | null = null;
    private playSessionId: number = 0;

    // Buffering
    private bufferCache: Map<string, AudioBuffer> = new Map();
    private fetchWorker: Worker;
    private pendingFetches: Map<string, (buffer: AudioBuffer) => void> = new Map();
    private LOOKAHEAD_COUNT = 3;

    // Events
    private handlers: Map<AudioEventType, Set<AudioEventHandler>> = new Map();
    // A setInterval, not requestAnimationFrame: rAF unconditionally stops firing once the
    // WebView isn't visible (screen off / app backgrounded), which used to silently halt
    // ayah-to-ayah scheduling — the audio already playing would finish, but nothing would
    // ever queue up the next one. setInterval keeps ticking through that.
    private uiTimerId: number | null = null;

    // Constants
    private readonly CROSSFADE_DURATION = 0.02; // 20ms (Reduced to preserve attack)
    private readonly START_TRIM = 0.02; // Skip start silence

    private constructor() {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.fetchWorker = new AudioFetcherWorker();
        this.fetchWorker.onmessage = this.handleWorkerMessage.bind(this);
    }

    public static getInstance(): AudioEngine {
        if (!AudioEngine.instance) {
            AudioEngine.instance = new AudioEngine();
        }
        return AudioEngine.instance;
    }

    // --- Worker Handling ---

    private handleWorkerMessage(e: MessageEvent) {
        const { id, buffer, success, error } = e.data;
        const url = id;

        if (success && buffer) {
            this.ctx.decodeAudioData(buffer, (decodedBuffer) => {
                this.bufferCache.set(url, decodedBuffer);
                if (this.pendingFetches.has(url)) {
                    this.pendingFetches.get(url)!(decodedBuffer);
                    this.pendingFetches.delete(url);
                }
                // Auto-start if simplified case logic applies
                if (this.isPlaying && !this.currentWrapper && this.queue[this.currentIndex] === url) {
                    this.initializeAndPlay();
                }
            }, (err) => {
                console.error("Error decoding audio data", err);
                this.emit('error', err);
            });
        } else {
            console.error("Worker fetch error:", error);
            this.emit('error', error);
        }
    }

    private async getAudioBuffer(url: string): Promise<AudioBuffer> {
        if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
        return new Promise((resolve) => {
            this.pendingFetches.set(url, resolve);
            this.fetchWorker.postMessage({ url, id: url });
        });
    }

    private preloadAhead() {
        for (let i = 1; i <= this.LOOKAHEAD_COUNT; i++) {
            const idx = this.currentIndex + i;
            if (idx < this.queue.length) {
                const url = this.queue[idx];
                if (!this.bufferCache.has(url) && !this.pendingFetches.has(url)) {
                    this.fetchWorker.postMessage({ url, id: url });
                }
            }
        }
    }

    // --- Playback Control ---

    public setQueue(urls: string[], startIndex: number = 0) {
        this.stop();
        this.queue = urls;
        this.currentIndex = startIndex;
        this.bufferCache.clear();
        this.currentWrapper = null;
        this.nextWrapper = null;

        if (this.queue[this.currentIndex]) {
            this.getAudioBuffer(this.queue[this.currentIndex]);
        }
        this.preloadAhead();
    }

    // New silent seek
    public setIndex(index: number) {
        this.currentIndex = index;
        // Preload the new index
        if (this.queue[this.currentIndex]) {
            this.getAudioBuffer(this.queue[this.currentIndex]);
        }
        this.preloadAhead();
        this.emit('trackchange', this.currentIndex);
    }

    public async initializeAndPlay() {
        const mySession = ++this.playSessionId;




        // 2. Explicit Resume
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (mySession !== this.playSessionId) return;

        // Force Kill All Previous Sound
        this.killAll(); // Strict Mode

        // Enforce Range Bounds
        if (this.repeatSettings.repeatMode === 'Range') {
            const startIdx = Math.max(0, this.repeatSettings.rangeStart - 1);
            const endIdx = this.repeatSettings.rangeEnd - 1;

            if (this.currentIndex < startIdx || this.currentIndex > endIdx) {
                this.currentIndex = startIdx;
                this.emit('trackchange', this.currentIndex);
            }
        }

        this.isPlaying = true;
        this.emit('playing');

        const url = this.queue[this.currentIndex];
        if (!url) return;

        let buffer: AudioBuffer;
        try {
            buffer = await this.getAudioBuffer(url);
        } catch (e) {
            this.emit('error', e);
            return;
        }

        if (mySession !== this.playSessionId) return;

        const offset = 0;
        if (this.ctx) {
            // Restore Gain
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);

            this.wrapperIndex = this.currentIndex;
            this.playTrack(buffer, offset, this.ctx.currentTime, mySession);
            this.startUIFrame();
        }
    }

    // True only when there's a suspended-but-intact source for the CURRENT index, i.e.
    // `pause()` was called and nothing has changed since — safe to `resume()` in place
    // instead of restarting the ayah from the beginning.
    public hasActiveTrack(): boolean {
        return this.currentWrapper !== null
            && this.wrapperIndex === this.currentIndex
            && this.ctx.state === 'suspended';
    }

    private playTrack(buffer: AudioBuffer, offset: number, when: number, session: number) {
        if (session !== this.playSessionId) return;

        // Safety cleanup though killAll should have handled it
        if (this.currentWrapper) {
            try { this.currentWrapper.source.stop(); } catch (e) { }
            this.currentWrapper.source.disconnect();
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        this.activeSource = source;
        this.activeNodes.push(source);
        source.onended = () => {
            this.activeNodes = this.activeNodes.filter(n => n !== source);
        };

        const gain = this.ctx.createGain();
        source.connect(gain);
        gain.connect(this.masterGain);

        const playOffset = offset + this.START_TRIM;
        source.start(when, playOffset);

        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(1, when + 0.02);

        const duration = buffer.duration - this.START_TRIM - offset;

        this.currentWrapper = {
            source,
            gain,
            startTime: when,
            duration
        };

        this.scheduleNext(when, duration, session);
    }

    // Repeat State
    private repeatSettings = {
        repeatVerse: false,
        repeatMode: 'Off' as 'Off' | 'Surah' | 'Range',
        rangeStart: 1,
        rangeEnd: 1
    };

    public setRepeatSettings(settings: {
        repeatVerse: boolean;
        repeatMode: 'Off' | 'Surah' | 'Range';
        rangeStart: number;
        rangeEnd: number;
    }) {
        this.repeatSettings = settings;

        // If Playing and settings changed in a way that affects next track, reschedule
        if (this.isPlaying && this.currentWrapper) {
            // If "Repeat Verse" is turned ON while playing, we should probably reschedule immediately if we are close to end?
            // That's complex. Let's assume it picks up on next track or if user seeks.
            // Actually, `scheduleNext` is called at start of track.
            // If I toggle "Repeat Verse" in middle of track, `nextWrapper` is already scheduled for *next* track.
            // I need to CANCEL `nextWrapper` and reschedule same track.
            // This is "Elite" level polish.
            // For now, let's just get the logic in.
            // Actually, for "Repeat Verse", if I turn it on, I expect it to repeat THIS verse.
            // If I'm 50% through, `nextWrapper` is already buffered for NEXT verse.
            // If I don't reschedule, it will play next verse, THEN repeat that one?
            // Or will it loop the *next* one?
            // If `scheduleNext` runs at start, it's done.
            // We need `rescheduleNext` capability.
            // But first we must KILL `nextWrapper`.
            if (this.nextWrapper) {
                try { this.nextWrapper.source.stop(); this.nextWrapper.source.disconnect(); } catch (e) { }
                this.nextWrapper = null;
                this.nextSourceNode = null;
            }
            this.scheduleNext(this.currentWrapper.startTime, this.currentWrapper.duration, this.playSessionId);
        }
    }

    private getNextIndex(current: number): number | null {
        // 1. Repeat Verse (Highest Priority)
        if (this.repeatSettings.repeatVerse) {
            return current;
        }

        const next = current + 1;

        // 2. Range Mode
        if (this.repeatSettings.repeatMode === 'Range') {
            const startIdx = Math.max(0, this.repeatSettings.rangeStart - 1);
            const endIdx = this.repeatSettings.rangeEnd - 1;

            // If we are currently AT (or past) the end of range, loop back
            if (current >= endIdx) {
                return startIdx;
            }
            // Ensure we don't go past queue even if range is weird
            if (next >= this.queue.length) return null;
            return next;
        }

        // 3. Surah Mode (Loop whole queue)
        if (this.repeatSettings.repeatMode === 'Surah') {
            if (next >= this.queue.length) {
                return 0;
            }
            return next;
        }

        // 4. Default (Stop at end)
        if (next >= this.queue.length) return null;

        return next;
    }

    private async scheduleNext(currentStart: number, currentDuration: number, session: number) {
        const nextIndex = this.getNextIndex(this.currentIndex);

        // If no next track, we just return.
        // UI loop will detect end of current track and stop().
        if (nextIndex === null) return;

        const nextUrl = this.queue[nextIndex];
        const buffer = await this.getAudioBuffer(nextUrl);

        if (session !== this.playSessionId) return;

        const endTime = currentStart + currentDuration;
        const transitionTime = endTime - this.CROSSFADE_DURATION;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        this.nextSourceNode = source;
        this.activeNodes.push(source);
        source.onended = () => {
            this.activeNodes = this.activeNodes.filter(n => n !== source);
        };

        const gain = this.ctx.createGain();
        source.connect(gain);
        gain.connect(this.masterGain);

        source.start(transitionTime, this.START_TRIM);

        gain.gain.setValueAtTime(0, transitionTime);
        gain.gain.linearRampToValueAtTime(1, endTime);

        if (this.currentWrapper) {
            const currentGain = this.currentWrapper.gain;
            currentGain.gain.setValueAtTime(1, transitionTime);
            currentGain.gain.linearRampToValueAtTime(0, endTime);
        }

        this.nextWrapper = {
            source,
            gain,
            startTime: transitionTime,
            duration: buffer.duration - this.START_TRIM
        };

        this.preloadAhead();
    }

    // NUCLEAR OPTION
    private killAll() {
        this.activeNodes.forEach(node => {
            try {
                node.stop();
                node.disconnect();
            } catch (e) { }
        });
        this.activeNodes = [];
        this.activeSource = null;
        this.nextSourceNode = null;
        this.currentWrapper = null;
        this.nextWrapper = null;
        this.wrapperIndex = null;
    }

    public stop() {
        this.playSessionId++; // Invalidate pending
        this.killAll();
        // Master Mute
        if (this.ctx && this.masterGain) {
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.resetEngine();
        this.emit('paused');
    }

    public pause() {
        this.playSessionId++; // Invalidate future
        if (!this.isPlaying) return;
        this.ctx.suspend();
        this.isPlaying = false;
        this.stopUIFrame();
        this.emit('paused');
    }

    public resume() {
        if (this.ctx) this.ctx.resume();
        this.isPlaying = true;
        this.emit('playing');
        this.startUIFrame();
    }

    // ... Internal Helpers ...

    public next() {
        if (this.currentIndex < this.queue.length - 1) {
            this.currentIndex++;
            this.initializeAndPlay();
            this.emit('trackchange', this.currentIndex);
        }
    }
    public prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.initializeAndPlay();
            this.emit('trackchange', this.currentIndex);
        }
    }
    public seek(index: number) {
        this.currentIndex = index;
        this.initializeAndPlay();
        this.emit('trackchange', this.currentIndex);
    }

    private resetEngine() {
        // Just statics, killAll handled nodes already
        this.isPlaying = false;
        this.stopUIFrame();
        this.currentIndex = 0;
    }

    private cleanupNodes() {
        if (this.currentWrapper) {
            try { this.currentWrapper.source.stop() } catch (e) { };
            this.currentWrapper.source.disconnect();
        }
        if (this.nextWrapper) {
            try { this.nextWrapper.source.stop() } catch (e) { };
            this.nextWrapper.source.disconnect();
        }
        this.currentWrapper = null;
        this.nextWrapper = null;
    }

    // --- UI Loop ---

    private startUIFrame() {
        if (this.uiTimerId) window.clearInterval(this.uiTimerId);
        const tick = () => {
            if (!this.isPlaying) return;

            const now = this.ctx.currentTime;

            // Check for Transition completion
            if (this.nextWrapper && now >= this.nextWrapper.startTime) {
                // We successfully crossed into the next track
                // Update state only once
                if (this.currentWrapper !== this.nextWrapper) {
                    this.currentWrapper = this.nextWrapper;
                    this.nextWrapper = null;

                    // Update Index properly considering repeats
                    const nextIdx = this.getNextIndex(this.currentIndex);
                    if (nextIdx !== null) {
                        this.currentIndex = nextIdx;
                    } else {
                        // Fallback (shouldn't happen if nextWrapper exists)
                        this.currentIndex++;
                    }

                    this.emit('trackchange', this.currentIndex);

                    // Schedule the one AFTER this
                    this.scheduleNext(this.currentWrapper.startTime, this.currentWrapper.duration, this.playSessionId);
                }
            }

            // Emit progress
            if (this.currentWrapper) {
                const elapsed = now - this.currentWrapper.startTime;
                this.emit('timeupdate', {
                    currentTime: elapsed,
                    duration: this.currentWrapper.duration
                });

                // Check for Queue Completion
                if (elapsed >= this.currentWrapper.duration + 0.1 && !this.nextWrapper) {
                    this.emit('ended');
                    this.stop();
                }
            }
        };
        this.uiTimerId = window.setInterval(tick, 150);
    }

    private stopUIFrame() {
        if (this.uiTimerId) {
            window.clearInterval(this.uiTimerId);
            this.uiTimerId = null;
        }
    }


    public setPlaybackRate(rate: number) {
        if (this.currentWrapper) this.currentWrapper.source.playbackRate.value = rate;
        if (this.nextWrapper) this.nextWrapper.source.playbackRate.value = rate;
    }

    // --- Events ---
    public on(event: AudioEventType, handler: AudioEventHandler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)?.add(handler);
    }

    public off(event: AudioEventType, handler: AudioEventHandler) {
        this.handlers.get(event)?.delete(handler);
    }

    private emit(event: AudioEventType, data?: any) {
        this.handlers.get(event)?.forEach(h => h(data));
    }
}

export const audioEngine = AudioEngine.getInstance();
