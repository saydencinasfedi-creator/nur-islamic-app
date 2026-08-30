
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Coordinates, Qibla as calculateQibla } from 'adhan';
import * as geomagnetism from 'geomagnetism';
import { useUser } from '../contexts/UserContext';
import { startCompassAccuracy, stopCompassAccuracy, CompassAccuracy } from '../services/compassAccuracy';

interface QiblaProps {
  onBack: () => void;
}

const COMPASS_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const degToCompass = (deg: number): string => {
  const index = Math.round(deg / 22.5) % 16;
  return COMPASS_DIRECTIONS[(index + 16) % 16];
};

const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

// Shortest signed distance from b to a, always in (-180, 180]. Safe for any magnitude of a/b.
const shortestAngleDiff = (a: number, b: number): number => {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const Qibla: React.FC<QiblaProps> = ({ onBack }) => {
  const { location, updateLocation, t } = useUser();
  const [heading, setHeading] = useState<number | null>(null);
  const [orientationSupported, setOrientationSupported] = useState(true);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);

  // Real magnetometer accuracy from Android's SensorManager (see services/compassAccuracy.ts)
  // — null on web/iOS or before the first callback arrives, since there's genuinely no data
  // yet, not because it's bad.
  const [magAccuracy, setMagAccuracy] = useState<CompassAccuracy | null>(null);

  useEffect(() => {
    let handle: Awaited<ReturnType<typeof startCompassAccuracy>> = null;
    startCompassAccuracy(setMagAccuracy).then(h => { handle = h; });
    return () => { stopCompassAccuracy(handle); };
  }, []);

  const calibrationStatus: 'unknown' | 'poor' | 'medium' | 'good' =
    magAccuracy === null ? 'unknown' :
      magAccuracy >= 3 ? 'good' :
        magAccuracy === 2 ? 'medium' : 'poor';

  const qiblaBearing = useMemo(() => {
    if (!location) return null;
    return calculateQibla(new Coordinates(location.latitude, location.longitude));
  }, [location]);

  // Magnetic declination (WMM model) at the user's location — `deviceorientation`'s `alpha`
  // is relative to magnetic north, not true north, and the gap between the two grows with
  // location (a few degrees in some places, over 15° in others). Without this correction the
  // needle is consistently off by whatever the local declination is. `webkitCompassHeading`
  // (iOS) already reports true heading, so it doesn't need this.
  const geomagModel = useMemo(() => geomagnetism.model(), []);
  const declination = useMemo(() => {
    if (!location) return 0;
    return geomagModel.point([location.latitude, location.longitude]).decl;
  }, [geomagModel, location]);
  const declinationRef = useRef(0);
  useEffect(() => { declinationRef.current = declination; }, [declination]);

  // `normRef` stays bounded to [0, 360) so consecutive raw readings are always compared as a
  // short hop. `continuousRef` accumulates those same small hops without ever wrapping, which is
  // what actually gets rendered — CSS `rotate()` interpolates between two numbers directly, so a
  // wrapped value jumping from 359deg to 0deg makes it visibly spin the long way around.
  const normRef = useRef<number | null>(null);
  const continuousRef = useRef<number>(0);
  // Rolling buffer of recent raw deltas (relative to normRef), so a single spurious sensor
  // spike gets outvoted by its median instead of yanking the needle on its own.
  const rawDeltaBufferRef = useRef<number[]>([]);
  const RAW_BUFFER_SIZE = 7;
  // Below this, a filtered raw delta is treated as sensor noise floor rather than real
  // movement — without this, a phone sitting still on a table still shows a faint but very
  // noticeable tremor (the needle never *actually* stops), which reads as "not fixed" even
  // though the underlying math already locks the marker to a constant offset from the dial.
  const DEADBAND_DEG = 1;

  useEffect(() => {
    const applyReading = (rawHeading: number) => {
      const SMOOTHING = 0.08;
      if (normRef.current === null) {
        normRef.current = rawHeading;
        continuousRef.current = rawHeading;
        rawDeltaBufferRef.current = [];
        setHeading(continuousRef.current);
        return;
      }

      const buffer = rawDeltaBufferRef.current;
      buffer.push(shortestAngleDiff(rawHeading, normRef.current));
      if (buffer.length > RAW_BUFFER_SIZE) buffer.shift();
      const filteredRawDelta = median(buffer);
      if (Math.abs(filteredRawDelta) < DEADBAND_DEG) return; // hold still — no real movement

      const delta = filteredRawDelta * SMOOTHING;
      normRef.current = normalizeDeg(normRef.current + delta);
      continuousRef.current += delta;
      setHeading(continuousRef.current);
    };

    const processEvent = (event: DeviceOrientationEvent) => {
      // iOS Safari exposes a pre-corrected (true-north) compass heading; other browsers
      // report magnetic-north-relative alpha, which needs the declination correction above.
      const webkitHeading = (event as any).webkitCompassHeading;
      if (typeof webkitHeading === 'number') {
        applyReading(normalizeDeg(webkitHeading));
      } else if (event.alpha !== null) {
        applyReading(normalizeDeg(360 - event.alpha + declinationRef.current));
      }
    };

    // On Android, Chrome fires BOTH 'deviceorientationabsolute' and plain 'deviceorientation'
    // for the *same* underlying sensor sample whenever absolute data is available (unlike
    // iOS, which only ever fires plain 'deviceorientation'). Listening to both unconditionally
    // — as this used to — processes every sample twice through two independently-timed event
    // dispatches, which is what actually caused the marker to visibly tremble/overshoot even
    // after smoothing: it wasn't sensor noise so much as double bookkeeping. Once absolute
    // events start arriving, the plain handler ignores everything so each sample is only
    // ever processed once.
    let receivingAbsolute = false;
    const handleAbsolute = (event: DeviceOrientationEvent) => {
      receivingAbsolute = true;
      processEvent(event);
    };
    const handleRelative = (event: DeviceOrientationEvent) => {
      if (receivingAbsolute) return;
      processEvent(event);
    };

    const requestApi = (window as any).DeviceOrientationEvent;
    const start = () => {
      window.addEventListener('deviceorientationabsolute', handleAbsolute, true);
      window.addEventListener('deviceorientation', handleRelative, true);
    };

    if (requestApi && typeof requestApi.requestPermission === 'function') {
      // iOS 13+ requires an explicit user-gesture-triggered permission request.
      setNeedsPermission(true);
    } else if (!requestApi) {
      setOrientationSupported(false);
    } else {
      start();
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleAbsolute, true);
      window.removeEventListener('deviceorientation', handleRelative, true);
    };
  }, []);

  const handleRefreshLocation = async () => {
    if (isRefreshingLocation) return;
    setIsRefreshingLocation(true);
    try {
      await updateLocation();
    } finally {
      setIsRefreshingLocation(false);
    }
  };

  const requestIOSPermission = async () => {
    try {
      const result = await (window as any).DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        setNeedsPermission(false);
      }
    } catch (err) {
      console.error('Error requesting orientation permission:', err);
    }
  };

  // Continuous (unwrapped) value used for the actual CSS rotation, to avoid boundary jumps.
  const relativeBearingContinuous = heading !== null && qiblaBearing !== null
    ? qiblaBearing - heading
    : null;

  // Bounded [0, 360) copy, only for the alignment check and numeric readout.
  const relativeBearing = relativeBearingContinuous !== null
    ? normalizeDeg(relativeBearingContinuous)
    : null;

  const isAligned = relativeBearing !== null && (relativeBearing <= 6 || relativeBearing >= 354);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased transition-colors duration-200 overflow-hidden">
      <header className="flex items-center p-4 pb-2 justify-between z-10">
        <button onClick={onBack} className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
        </button>
        <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center uppercase text-gray-500 dark:text-slate-400 text-sm">{t('qibla.title')}</h2>
        <div className="flex size-12 items-center justify-end">
          <button onClick={handleRefreshLocation} disabled={isRefreshingLocation} className="flex size-12 cursor-pointer items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60">
            <span className={`material-symbols-outlined text-2xl ${isRefreshingLocation ? 'animate-spin' : ''}`}>
              {isRefreshingLocation ? 'progress_activity' : 'my_location'}
            </span>
          </button>
        </div>
      </header>

      <div className="flex w-full justify-center px-4 py-2 z-10">
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/5 backdrop-blur-md pl-3 pr-5 shadow-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
          <p className="text-sm font-medium leading-normal">
            {location ? `${location.city}, ${location.country}` : t('qibla.locating')}
          </p>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center relative w-full px-6">
        {needsPermission ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs">
              {t('qibla.permissionMessage')}
            </p>
            <button
              onClick={requestIOSPermission}
              className="rounded-full bg-primary text-background-dark font-bold px-6 py-3"
            >
              {t('qibla.enableCompass')}
            </button>
          </div>
        ) : !orientationSupported ? (
          <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs text-center">
            {t('qibla.orientationNotSupported')}
          </p>
        ) : !location ? (
          <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs text-center">
            {t('qibla.waitingForLocation')}
          </p>
        ) : heading === null ? (
          <p className="text-gray-500 dark:text-slate-400 text-sm max-w-xs text-center">
            {t('qibla.moveToCalibrate')}
          </p>
        ) : (
          <div className="relative aspect-square w-full max-w-[340px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-gray-200 dark:border-white/10 bg-white/40 dark:bg-surface-dark/30 backdrop-blur-sm"></div>

            <div
              className="absolute inset-2 rounded-full bg-center bg-no-repeat bg-contain opacity-40 transition-transform duration-100"
              style={{ transform: `rotate(${-heading}deg)` }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="absolute top-4 text-xs font-bold text-gray-400 dark:text-slate-500">{t('qibla.compassN')}</span>
                <span className="absolute bottom-4 text-xs font-bold text-gray-400 dark:text-slate-500">{t('qibla.compassS')}</span>
                <span className="absolute left-4 text-xs font-bold text-gray-400 dark:text-slate-500">{t('qibla.compassW')}</span>
                <span className="absolute right-4 text-xs font-bold text-gray-400 dark:text-slate-500">{t('qibla.compassE')}</span>
              </div>
            </div>

            <div className="relative w-[85%] h-[85%] rounded-full bg-background-light dark:bg-background-dark shadow-2xl border border-gray-200 dark:border-white/5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-transparent to-black/10 dark:to-black/30 pointer-events-none"></div>

              {/* Rotates as the Qibla marker moves around the dial with the device's heading */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-100"
                style={{ transform: `rotate(${relativeBearingContinuous}deg)` }}
              >
                <div className="absolute top-4 flex flex-col items-center gap-1">
                  <div className={`size-8 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(19,236,146,0.5)] ${isAligned ? 'bg-primary/40 text-primary' : 'bg-primary/20 text-primary'}`}>
                    <span className="material-symbols-outlined text-[18px] filled">mosque</span>
                  </div>
                  <div className="w-1.5 h-3 bg-primary rounded-full shadow-[0_0_10px_rgba(19,236,146,0.8)]"></div>
                </div>
              </div>

              {/* Fixed needle: always points straight ahead (where the phone itself is pointing).
                  Turns green once the rotating marker above lines up with it. */}
              <div className="w-16 h-16 rounded-full bg-white dark:bg-surface-dark border-4 border-background-light dark:border-background-dark shadow-inner flex items-center justify-center z-10">
                <span className={`material-symbols-outlined filled text-3xl transition-colors ${isAligned ? 'text-primary' : 'text-gray-400 dark:text-white/60'}`}>
                  navigation
                </span>
              </div>
            </div>
            <div className="absolute inset-0 rounded-full bg-primary/5 blur-3xl -z-10"></div>
          </div>
        )}

        {heading !== null && (
          <div
            className={`mt-6 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium text-center max-w-xs ${calibrationStatus === 'good'
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
              }`}
          >
            <span className={`material-symbols-outlined text-sm ${calibrationStatus === 'good' ? 'filled' : ''}`}>
              {calibrationStatus === 'good' ? 'check_circle' : 'explore_off'}
            </span>
            {calibrationStatus === 'good'
              ? t('qibla.calibrationGood')
              : calibrationStatus === 'medium'
                ? t('qibla.calibrationMedium')
                : calibrationStatus === 'poor'
                  ? t('qibla.calibrationPoor')
                  : t('qibla.calibrationUnknown')}
          </div>
        )}
      </main>

      <div className="flex flex-col items-center justify-end pb-12 pt-4 px-6 z-10">
        <div className="text-center">
          <h1 className="text-slate-900 dark:text-white tracking-tight text-5xl font-light leading-tight">
            {qiblaBearing !== null ? Math.round(qiblaBearing) : '--'}
            <span className="text-primary align-top text-2xl font-bold">°</span>{' '}
            <span className="text-2xl font-normal text-gray-400 dark:text-slate-500">
              {qiblaBearing !== null ? degToCompass(qiblaBearing) : ''}
            </span>
          </h1>
          <p className={`text-sm font-medium tracking-wider uppercase mt-1 ${isAligned ? 'text-primary' : 'text-gray-400 dark:text-slate-500'}`}>
            {isAligned ? t('qibla.aligned') : t('qibla.turnTowardsMarker')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Qibla;
