// Module-singleton hand-offs for the Community section, same pattern as
// services/reflectionsNav.ts. `navigate(page)` carries no payload.

export type CommunityReturnView = 'greflection' | 'circle';

// Set when a group reflection's Qur'an reference is tapped → after the Qur'an
// reader, hardware-back returns to Community restored to this circle + view.
let returnToCommunity: { groupId: string; reflectionId?: string; view: CommunityReturnView } | null = null;
export const setReturnToCommunity = (v: typeof returnToCommunity) => { returnToCommunity = v; };
export const consumeReturnToCommunity = () => {
  const v = returnToCommunity;
  returnToCommunity = null;
  return v;
};

// Set by e.g. a dashboard shortcut, or a tapped push notification (see
// services/pushNotifications.ts) → Community opens straight to this circle or DM.
export type PendingCommunityTarget =
  | { groupId: string }
  | { dmThreadId: string; otherUserId: string };

let pendingCommunityTarget: PendingCommunityTarget | null = null;
export const setPendingCommunityTarget = (v: PendingCommunityTarget | null) => { pendingCommunityTarget = v; };
export const consumePendingCommunityTarget = () => {
  const v = pendingCommunityTarget;
  pendingCommunityTarget = null;
  return v;
};
