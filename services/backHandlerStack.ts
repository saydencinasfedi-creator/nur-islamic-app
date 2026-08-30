// A tiny registry so components with their own internal sub-navigation (e.g. the Quran
// reader sitting "inside" the Quran page, or a detail modal) can claim the hardware/gesture
// back press before it falls through to the app-wide page hierarchy in App.tsx.
//
// Returns `true` from a handler to consume the back press (stop here); `false` lets it
// fall through to the next-most-recently-registered handler, and eventually to App.tsx.

type BackHandler = () => boolean;

const stack: BackHandler[] = [];

export const pushBackHandler = (handler: BackHandler): (() => void) => {
  stack.push(handler);
  return () => {
    const index = stack.indexOf(handler);
    if (index !== -1) stack.splice(index, 1);
  };
};

export const consumeBackPress = (): boolean => {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]()) return true;
  }
  return false;
};
