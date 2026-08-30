import { QuranReference } from '../types';

// Module-singleton hand-offs between screens. `navigate(page)` in App.tsx takes no
// payload, so — like audioEngine / backHandlerStack — cross-screen intent rides on a
// singleton the destination consumes once on mount. Each getter clears the slot.

// Set by the Qur'an reader's per-ayah "Add Reflection" button → the Reflections editor
// opens pre-filled with this reference.
let pendingReflectionDraft: { quranRefs: QuranReference[] } | null = null;
export const setPendingReflectionDraft = (d: { quranRefs: QuranReference[] } | null) => {
    pendingReflectionDraft = d;
};
export const consumePendingReflectionDraft = () => {
    const d = pendingReflectionDraft;
    pendingReflectionDraft = null;
    return d;
};

// Set when a reflection's Qur'an reference is tapped → the Qur'an reader opens this surah
// scrolled to this ayah.
let pendingQuranTarget: { surahNumber: number; ayahNumber: number } | null = null;
export const setPendingQuranTarget = (t: { surahNumber: number; ayahNumber: number } | null) => {
    pendingQuranTarget = t;
};
export const consumePendingQuranTarget = () => {
    const t = pendingQuranTarget;
    pendingQuranTarget = null;
    return t;
};

// Breadcrumb: the reflection id to reopen when back is pressed in the Qur'an reader after
// arriving there from a reference.
let returnToReflectionId: string | null = null;
export const setReturnToReflectionId = (id: string | null) => {
    returnToReflectionId = id;
};
export const consumeReturnToReflectionId = () => {
    const id = returnToReflectionId;
    returnToReflectionId = null;
    return id;
};

// Set by the Qur'an reader's back handler → the Reflections screen opens straight to this
// reflection's detail view.
let pendingOpenReflectionId: string | null = null;
export const setPendingOpenReflectionId = (id: string | null) => {
    pendingOpenReflectionId = id;
};
export const consumePendingOpenReflectionId = () => {
    const id = pendingOpenReflectionId;
    pendingOpenReflectionId = null;
    return id;
};
