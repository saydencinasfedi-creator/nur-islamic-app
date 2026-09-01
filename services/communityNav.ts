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

// Set by e.g. a dashboard shortcut → Community opens straight to this circle.
let pendingCommunityTarget: { groupId: string } | null = null;
export const setPendingCommunityTarget = (v: { groupId: string } | null) => { pendingCommunityTarget = v; };
export const consumePendingCommunityTarget = () => {
  const v = pendingCommunityTarget;
  pendingCommunityTarget = null;
  return v;
};
