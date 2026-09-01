// All Community reads/writes. One module, mirrors the style of authService.ts
// (typed functions, row<->camelCase mappers). Every call goes through db(),
// which throws a friendly error when the build has no Supabase credentials.

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  CommunityProfile, Group, GroupMember, GroupMessage, GroupReflection,
  GroupReflectionComment, ReactionEmoji, ReactionEntityType, GroupChallenge,
  ChallengeParticipant, GroupInvite, GlobalSalawat, DuaRequest, GroupRole,
  GroupCategory, GroupPrivacy, GroupGender, ChallengeNotifyFrequency, Reflection,
  QuranReference,
} from '../types';

class CommunityUnavailableError extends Error {
  constructor() {
    super('community_unavailable');
    this.name = 'CommunityUnavailableError';
  }
}

const db = () => {
  if (!isSupabaseConfigured) throw new CommunityUnavailableError();
  return supabase;
};

const myId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

// --- mappers ---------------------------------------------------------------

const toProfile = (r: any): CommunityProfile => ({
  id: r.id,
  displayName: r.display_name ?? '',
  avatarUrl: r.avatar_url ?? null,
  bio: r.bio ?? null,
  ageRange: r.age_range ?? null,
  languages: r.languages ?? [],
  interests: r.interests ?? [],
  isAnonymous: !!r.is_anonymous,
});

const toGroup = (r: any): Group => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description ?? null,
  avatarUrl: r.avatar_url ?? null,
  category: r.category,
  tags: r.tags ?? [],
  privacy: r.privacy,
  groupGender: r.group_gender,
  ageFocus: r.age_focus ?? null,
  primaryLanguage: r.primary_language ?? null,
  ownerId: r.owner_id,
  memberCount: r.member_count ?? 0,
  createdAt: r.created_at,
  archivedAt: r.archived_at ?? null,
  myRole: r.__myRole ?? null,
  myStatus: r.__myStatus ?? null,
});

const toMember = (r: any): GroupMember => ({
  groupId: r.group_id,
  userId: r.user_id,
  role: r.role,
  status: r.status,
  joinedAt: r.joined_at,
  mutedUntil: r.muted_until ?? null,
  profile: r.profile ? toProfile(r.profile) : undefined,
});

const toMessage = (r: any): GroupMessage => ({
  id: r.id,
  groupId: r.group_id,
  authorId: r.author_id ?? null,
  body: r.body,
  replyTo: r.reply_to ?? null,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? null,
  deletedAt: r.deleted_at ?? null,
  author: r.author ? toProfile(r.author) : undefined,
});

const toGroupReflection = (r: any): GroupReflection => ({
  id: r.id,
  groupId: r.group_id,
  authorId: r.author_id ?? null,
  title: r.title ?? null,
  content: r.content ?? '',
  quranRefs: Array.isArray(r.quran_refs) ? (r.quran_refs as QuranReference[]) : [],
  tags: r.tags ?? [],
  sourceLocalId: r.source_local_id ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at ?? null,
  author: r.author ? toProfile(r.author) : undefined,
});

const toComment = (r: any): GroupReflectionComment => ({
  id: r.id,
  reflectionId: r.reflection_id,
  authorId: r.author_id ?? null,
  body: r.body,
  createdAt: r.created_at,
  deletedAt: r.deleted_at ?? null,
  author: r.author ? toProfile(r.author) : undefined,
});

const toChallenge = (r: any): GroupChallenge => ({
  id: r.id,
  groupId: r.group_id ?? null,
  creatorId: r.creator_id ?? null,
  title: r.title,
  description: r.description ?? null,
  type: r.type,
  icon: r.icon ?? null,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  durationDays: r.duration_days ?? null,
  status: r.status,
  notifyFrequency: r.notify_frequency ?? 'none',
  notifyAt: r.notify_at ? String(r.notify_at).slice(0, 5) : null,
  goalTotal: r.goal_total ?? null,
  dailyGoal: r.daily_goal ?? null,
  archivedAt: r.archived_at ?? null,
  groupName: r.groups?.name ?? r.__groupName ?? null,
});

const toParticipant = (r: any): ChallengeParticipant => ({
  challengeId: r.challenge_id,
  userId: r.user_id,
  joinedAt: r.joined_at,
  shareDetail: !!r.share_detail,
  completedToday: !!r.completed_today,
  progressCount: r.progress_count ?? null,
  lastProgressOn: r.last_progress_on ?? null,
  profile: r.profile ? toProfile(r.profile) : undefined,
});

const toInvite = (r: any): GroupInvite => ({
  id: r.id,
  groupId: r.group_id,
  code: r.code,
  createdBy: r.created_by ?? null,
  createdAt: r.created_at,
  expiresAt: r.expires_at ?? null,
  maxUses: r.max_uses ?? null,
  useCount: r.use_count ?? 0,
  revokedAt: r.revoked_at ?? null,
});

const toSalawat = (r: any): GlobalSalawat => ({
  totalCount: Number(r.total_count ?? 0),
  todayCount: Number(r.today_count ?? 0),
  todayDate: r.today_date,
});

const toDua = (r: any): DuaRequest => ({
  id: r.id,
  authorId: r.author_id ?? null,
  body: r.body,
  isAnonymous: !!r.is_anonymous,
  ameenCount: r.ameen_count ?? 0,
  createdAt: r.created_at,
  author: r.author ? toProfile(r.author) : undefined,
});

const throwOnError = <T>(res: { data: T; error: any }): T => {
  if (res.error) throw res.error;
  return res.data;
};

// =========================================================================
// Profiles
// =========================================================================

export const amIAppAdmin = async (): Promise<boolean> => {
  const me = await myId();
  if (!me) return false;
  const row = throwOnError(await db().from('profiles').select('is_app_admin').eq('id', me).maybeSingle());
  return !!row?.is_app_admin;
};

export const getProfiles = async (ids: string[]): Promise<Record<string, CommunityProfile>> => {
  if (!ids.length) return {};
  const rows = throwOnError(await db().from('profiles').select('*').in('id', [...new Set(ids)]));
  const map: Record<string, CommunityProfile> = {};
  for (const r of rows ?? []) map[r.id] = toProfile(r);
  return map;
};

// =========================================================================
// Groups (circles)
// =========================================================================

export interface GroupDraft {
  name: string;
  description?: string;
  category: GroupCategory;
  privacy: GroupPrivacy;
  groupGender: GroupGender;
  avatarUrl?: string | null;
  primaryLanguage?: string | null;
  tags?: string[];
}

const enrichWithMembership = async (groups: Group[]): Promise<Group[]> => {
  const me = await myId();
  if (!me || !groups.length) return groups;
  const rows = throwOnError(
    await db()
      .from('group_members')
      .select('group_id,role,status')
      .eq('user_id', me)
      .in('group_id', groups.map(g => g.id)),
  );
  const byId: Record<string, any> = {};
  for (const r of rows ?? []) byId[r.group_id] = r;
  return groups.map(g => ({ ...g, myRole: byId[g.id]?.role ?? null, myStatus: byId[g.id]?.status ?? null }));
};

export const listMyGroups = async (): Promise<Group[]> => {
  const me = await myId();
  if (!me) return [];
  const rows = throwOnError(
    await db()
      .from('group_members')
      .select('role,status,groups(*)')
      .eq('user_id', me)
      .in('status', ['active', 'muted', 'pending']),
  );
  return (rows ?? [])
    .filter((r: any) => r.groups)
    .map((r: any) => ({ ...toGroup(r.groups), myRole: r.role as GroupRole, myStatus: r.status }));
};

export const searchGroups = async (query: string): Promise<Group[]> => {
  let q = db().from('groups').select('*').is('archived_at', null).limit(40);
  if (query.trim()) {
    q = q.textSearch('tsv', query.trim(), { type: 'websearch', config: 'simple' });
  } else {
    q = q.order('member_count', { ascending: false });
  }
  const rows = throwOnError(await q);
  return enrichWithMembership((rows ?? []).map(toGroup));
};

export const getGroup = async (id: string): Promise<Group | null> => {
  const row = throwOnError(await db().from('groups').select('*').eq('id', id).maybeSingle());
  if (!row) return null;
  const [enriched] = await enrichWithMembership([toGroup(row)]);
  return enriched;
};

export const createGroup = async (draft: GroupDraft): Promise<Group> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('groups')
      .insert({
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        category: draft.category,
        privacy: draft.privacy,
        group_gender: draft.groupGender,
        avatar_url: draft.avatarUrl ?? null,
        primary_language: draft.primaryLanguage ?? null,
        tags: draft.tags ?? [],
        owner_id: me,
        slug: '', // filled by the tg_groups_slug trigger
      })
      .select('*')
      .single(),
  );
  return { ...toGroup(row), myRole: 'owner', myStatus: 'active' };
};

export const updateGroup = async (id: string, patch: Partial<GroupDraft>): Promise<void> => {
  const body: any = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.description !== undefined) body.description = patch.description?.trim() || null;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.privacy !== undefined) body.privacy = patch.privacy;
  if (patch.groupGender !== undefined) body.group_gender = patch.groupGender;
  if (patch.avatarUrl !== undefined) body.avatar_url = patch.avatarUrl;
  if (patch.tags !== undefined) body.tags = patch.tags;
  throwOnError(await db().from('groups').update(body).eq('id', id).select('id').single());
};

export const joinPublicGroup = async (groupId: string): Promise<void> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  throwOnError(
    await db()
      .from('group_members')
      .insert({ group_id: groupId, user_id: me, role: 'member', status: 'active' })
      .select('group_id')
      .single(),
  );
};

export const requestJoin = async (groupId: string): Promise<void> => {
  throwOnError(await db().rpc('request_join', { p_group_id: groupId }) as any);
};

export const leaveGroup = async (groupId: string): Promise<void> => {
  const me = await myId();
  if (!me) return;
  throwOnError(await db().from('group_members').delete().eq('group_id', groupId).eq('user_id', me) as any);
};

export const listMembers = async (groupId: string): Promise<GroupMember[]> => {
  const rows = throwOnError(
    await db()
      .from('group_members')
      .select('*, profile:profiles!group_members_user_id_fkey(*)')
      .eq('group_id', groupId)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true }),
  );
  return (rows ?? []).map(toMember);
};

export const approveJoin = async (groupId: string, userId: string) =>
  throwOnError(await db().rpc('approve_join', { p_group_id: groupId, p_user_id: userId }) as any);
export const rejectJoin = async (groupId: string, userId: string) =>
  throwOnError(await db().rpc('reject_join', { p_group_id: groupId, p_user_id: userId }) as any);
export const setMemberRole = async (groupId: string, userId: string, role: GroupRole) =>
  throwOnError(await db().rpc('set_member_role', { p_group_id: groupId, p_user_id: userId, p_role: role }) as any);
export const kickMember = async (groupId: string, userId: string) =>
  throwOnError(await db().rpc('kick_member', { p_group_id: groupId, p_user_id: userId }) as any);
export const banMember = async (groupId: string, userId: string) =>
  throwOnError(await db().rpc('ban_member', { p_group_id: groupId, p_user_id: userId }) as any);
export const muteMember = async (groupId: string, userId: string, until: string) =>
  throwOnError(await db().rpc('mute_member', { p_group_id: groupId, p_user_id: userId, p_until: until }) as any);

// --- invites -------------------------------------------------------------

export const listInvites = async (groupId: string): Promise<GroupInvite[]> => {
  const rows = throwOnError(
    await db().from('group_invites').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
  );
  return (rows ?? []).map(toInvite);
};
export const generateInvite = async (groupId: string): Promise<string> =>
  throwOnError(await db().rpc('generate_invite', { p_group_id: groupId })) as string;
export const revokeInvite = async (inviteId: string) =>
  throwOnError(await db().rpc('revoke_invite', { p_invite_id: inviteId }) as any);

export interface InvitePreview {
  groupId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  privacy: string;
  groupGender: string;
  memberCount: number;
}
export const previewInvite = async (code: string): Promise<InvitePreview | null> => {
  const rows = throwOnError(await db().rpc('preview_invite', { invite_code: code.trim() }));
  const r = Array.isArray(rows) ? rows[0] : rows;
  if (!r) return null;
  return {
    groupId: r.group_id,
    name: r.name,
    description: r.description ?? null,
    avatarUrl: r.avatar_url ?? null,
    privacy: r.privacy,
    groupGender: r.group_gender,
    memberCount: r.member_count ?? 0,
  };
};
export const redeemInvite = async (code: string): Promise<string> =>
  throwOnError(await db().rpc('redeem_invite', { invite_code: code.trim() })) as string;

// =========================================================================
// Chat
// =========================================================================

const MESSAGE_PAGE = 30;

export const listMessages = async (groupId: string, before?: string): Promise<GroupMessage[]> => {
  let q = db()
    .from('group_messages')
    .select('*, author:profiles!group_messages_author_id_fkey(*)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE);
  if (before) q = q.lt('created_at', before);
  const rows = throwOnError(await q);
  return (rows ?? []).map(toMessage).reverse(); // chronological
};

export const getMessage = async (id: string): Promise<GroupMessage | null> => {
  const row = throwOnError(
    await db().from('group_messages').select('*, author:profiles!group_messages_author_id_fkey(*)').eq('id', id).maybeSingle(),
  );
  return row ? toMessage(row) : null;
};

export const sendMessage = async (groupId: string, body: string, replyTo?: string): Promise<GroupMessage> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('group_messages')
      .insert({ group_id: groupId, author_id: me, body: body.trim(), reply_to: replyTo ?? null })
      .select('*, author:profiles!group_messages_author_id_fkey(*)')
      .single(),
  );
  return toMessage(row);
};

export const updateMessage = async (id: string, body: string): Promise<void> => {
  throwOnError(
    await db()
      .from('group_messages')
      .update({ body: body.trim(), edited_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single(),
  );
};

export const softDeleteMessage = async (id: string): Promise<void> => {
  const me = await myId();
  throwOnError(
    await db().from('group_messages').update({ deleted_at: new Date().toISOString(), deleted_by: me }).eq('id', id).select('id').single(),
  );
};

// =========================================================================
// Group reflections + comments
// =========================================================================

export const listGroupReflections = async (groupId: string): Promise<GroupReflection[]> => {
  const rows = throwOnError(
    await db()
      .from('group_reflections')
      .select('*, author:profiles!group_reflections_author_id_fkey(*)')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  );
  return (rows ?? []).map(toGroupReflection);
};

export const getGroupReflection = async (id: string): Promise<GroupReflection | null> => {
  const row = throwOnError(
    await db().from('group_reflections').select('*, author:profiles!group_reflections_author_id_fkey(*)').eq('id', id).maybeSingle(),
  );
  return row ? toGroupReflection(row) : null;
};

export interface GroupReflectionDraft {
  title?: string;
  content: string;
  quranRefs: QuranReference[];
  tags?: string[];
}

export const createGroupReflection = async (groupId: string, draft: GroupReflectionDraft): Promise<GroupReflection> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('group_reflections')
      .insert({
        group_id: groupId,
        author_id: me,
        title: draft.title?.trim() || null,
        content: draft.content,
        quran_refs: draft.quranRefs ?? [],
        tags: draft.tags ?? [],
      })
      .select('*, author:profiles!group_reflections_author_id_fkey(*)')
      .single(),
  );
  return toGroupReflection(row);
};

export const updateGroupReflection = async (id: string, draft: GroupReflectionDraft): Promise<void> => {
  throwOnError(
    await db()
      .from('group_reflections')
      .update({
        title: draft.title?.trim() || null,
        content: draft.content,
        quran_refs: draft.quranRefs ?? [],
        tags: draft.tags ?? [],
      })
      .eq('id', id)
      .select('id')
      .single(),
  );
};

export const softDeleteGroupReflection = async (id: string): Promise<void> => {
  throwOnError(await db().from('group_reflections').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single());
};

// Server-side COPY of a personal reflection into a circle. The local reflection
// is never touched. source_local_id records where it came from.
export const sharePersonalReflection = async (reflection: Reflection, groupId: string): Promise<GroupReflection> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('group_reflections')
      .insert({
        group_id: groupId,
        author_id: me,
        title: reflection.title?.trim() || null,
        content: reflection.content,
        quran_refs: reflection.quranRefs ?? [],
        tags: [],
        source_local_id: reflection.id,
      })
      .select('*, author:profiles!group_reflections_author_id_fkey(*)')
      .single(),
  );
  return toGroupReflection(row);
};

export const listComments = async (reflectionId: string): Promise<GroupReflectionComment[]> => {
  const rows = throwOnError(
    await db()
      .from('group_reflection_comments')
      .select('*, author:profiles!group_reflection_comments_author_id_fkey(*)')
      .eq('reflection_id', reflectionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  );
  return (rows ?? []).map(toComment);
};

export const addComment = async (reflectionId: string, body: string): Promise<GroupReflectionComment> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('group_reflection_comments')
      .insert({ reflection_id: reflectionId, author_id: me, body: body.trim() })
      .select('*, author:profiles!group_reflection_comments_author_id_fkey(*)')
      .single(),
  );
  return toComment(row);
};

export const softDeleteComment = async (id: string): Promise<void> => {
  throwOnError(await db().from('group_reflection_comments').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single());
};

// =========================================================================
// Reactions (message | reflection | comment)
// =========================================================================

export interface ReactionSummary {
  counts: Partial<Record<ReactionEmoji, number>>;
  mine: ReactionEmoji[];
}

export const listReactions = async (
  entityType: ReactionEntityType,
  entityIds: string[],
): Promise<Record<string, ReactionSummary>> => {
  const out: Record<string, ReactionSummary> = {};
  if (!entityIds.length) return out;
  const me = await myId();
  const rows = throwOnError(
    await db().from('community_reactions').select('entity_id,emoji,user_id').eq('entity_type', entityType).in('entity_id', entityIds),
  );
  for (const id of entityIds) out[id] = { counts: {}, mine: [] };
  for (const r of rows ?? []) {
    const s = out[r.entity_id] ?? (out[r.entity_id] = { counts: {}, mine: [] });
    s.counts[r.emoji as ReactionEmoji] = (s.counts[r.emoji as ReactionEmoji] ?? 0) + 1;
    if (me && r.user_id === me) s.mine.push(r.emoji as ReactionEmoji);
  }
  return out;
};

export const toggleReaction = async (
  entityType: ReactionEntityType,
  entityId: string,
  emoji: ReactionEmoji,
  currentlyOn: boolean,
): Promise<void> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  if (currentlyOn) {
    throwOnError(
      await db()
        .from('community_reactions')
        .delete()
        .match({ entity_type: entityType, entity_id: entityId, user_id: me, emoji }) as any,
    );
  } else {
    throwOnError(
      await db().from('community_reactions').insert({ entity_type: entityType, entity_id: entityId, user_id: me, emoji }) as any,
    );
  }
};

// =========================================================================
// Challenges
// =========================================================================

export interface ChallengeDraft {
  groupId: string | null;
  title: string;
  description?: string;
  icon?: string | null;
  type?: GroupChallenge['type'];
  durationDays: number;
  notifyFrequency: ChallengeNotifyFrequency;
  notifyAt?: string | null; // 'HH:MM'
}

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// Active challenges the viewer can see: global + those of circles they belong
// to. Plus their own pending proposals. Merged + de-duped, newest first.
export const listChallenges = async (): Promise<GroupChallenge[]> => {
  const rows = throwOnError(
    await db()
      .from('group_challenges')
      .select('*, groups(name)')
      .in('status', ['active', 'pending'])
      .order('starts_on', { ascending: false })
      .limit(100),
  );
  return (rows ?? []).map(toChallenge);
};

export const listGroupChallenges = async (groupId: string): Promise<GroupChallenge[]> => {
  const rows = throwOnError(
    await db()
      .from('group_challenges')
      .select('*, groups(name)')
      .eq('group_id', groupId)
      .in('status', ['active', 'pending'])
      .order('starts_on', { ascending: false }),
  );
  return (rows ?? []).map(toChallenge);
};

export const getChallenge = async (id: string): Promise<GroupChallenge | null> => {
  const row = throwOnError(await db().from('group_challenges').select('*, groups(name)').eq('id', id).maybeSingle());
  return row ? toChallenge(row) : null;
};

// Returns whether the challenge went live ('active') or is awaiting approval ('pending').
export const createChallenge = async (
  draft: ChallengeDraft,
  canApprove: boolean,
): Promise<GroupChallenge> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const startsOn = todayISO();
  const row = throwOnError(
    await db()
      .from('group_challenges')
      .insert({
        group_id: draft.groupId,
        creator_id: me,
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        icon: draft.icon ?? null,
        type: draft.type ?? 'custom',
        starts_on: startsOn,
        ends_on: addDays(startsOn, Math.max(1, draft.durationDays)),
        duration_days: Math.max(1, draft.durationDays),
        status: canApprove ? 'active' : 'pending',
        notify_frequency: draft.notifyFrequency,
        notify_at: draft.notifyAt ? `${draft.notifyAt}:00` : null,
      })
      .select('*, groups(name)')
      .single(),
  );
  return toChallenge(row);
};

export const setChallengeStatus = async (id: string, status: GroupChallenge['status']): Promise<void> => {
  throwOnError(await db().from('group_challenges').update({ status }).eq('id', id).select('id').single());
};

export const joinChallenge = async (challengeId: string): Promise<void> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  throwOnError(
    await db().from('challenge_participants').insert({ challenge_id: challengeId, user_id: me }).select('challenge_id').single(),
  );
};

export const leaveChallenge = async (challengeId: string): Promise<void> => {
  const me = await myId();
  if (!me) return;
  throwOnError(await db().from('challenge_participants').delete().eq('challenge_id', challengeId).eq('user_id', me) as any);
};

export const logChallengeProgress = async (challengeId: string, amount = 1): Promise<void> => {
  throwOnError(await db().rpc('log_challenge_progress', { p_challenge_id: challengeId, p_amount: amount }) as any);
};

export const setShareDetail = async (challengeId: string, share: boolean): Promise<void> => {
  const me = await myId();
  if (!me) return;
  throwOnError(
    await db().from('challenge_participants').update({ share_detail: share }).eq('challenge_id', challengeId).eq('user_id', me).select('challenge_id').single(),
  );
};

export const listParticipants = async (challengeId: string): Promise<ChallengeParticipant[]> => {
  const rows = throwOnError(
    await db().from('challenge_participants_public').select('*').eq('challenge_id', challengeId),
  );
  const list = (rows ?? []).map(toParticipant);
  const profiles = await getProfiles(list.map(p => p.userId));
  return list.map(p => ({ ...p, profile: profiles[p.userId] }));
};

// The joined challenges (with their notify schedule) — for local notifications.
export const listMyJoinedChallenges = async (): Promise<GroupChallenge[]> => {
  const me = await myId();
  if (!me) return [];
  const rows = throwOnError(
    await db()
      .from('challenge_participants')
      .select('group_challenges(*, groups(name))')
      .eq('user_id', me),
  );
  return (rows ?? [])
    .map((r: any) => r.group_challenges)
    .filter((c: any) => c && c.status === 'active')
    .map(toChallenge);
};

// =========================================================================
// Global Salawat
// =========================================================================

export const getSalawat = async (): Promise<GlobalSalawat> => {
  const row = throwOnError(await db().from('global_salawat').select('*').eq('id', true).single());
  return toSalawat(row);
};

export const addSalawat = async (amount = 1): Promise<GlobalSalawat> => {
  const row = throwOnError(await db().rpc('add_salawat', { p_amount: amount }));
  return toSalawat(Array.isArray(row) ? row[0] : row);
};

// =========================================================================
// Dua requests
// =========================================================================

const DUA_PAGE = 25;

export const listDuaRequests = async (before?: string): Promise<DuaRequest[]> => {
  let q = db()
    .from('dua_requests')
    .select('*, author:profiles!dua_requests_author_id_fkey(*)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(DUA_PAGE);
  if (before) q = q.lt('created_at', before);
  const rows = throwOnError(await q);
  const list = (rows ?? []).map(toDua);
  const me = await myId();
  if (me && list.length) {
    const ameens = throwOnError(
      await db().from('dua_ameens').select('dua_id').eq('user_id', me).in('dua_id', list.map(d => d.id)),
    );
    const mine = new Set((ameens ?? []).map((a: any) => a.dua_id));
    for (const d of list) d.iSaidAmeen = mine.has(d.id);
  }
  return list;
};

export const postDuaRequest = async (body: string, isAnonymous: boolean): Promise<DuaRequest> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  const row = throwOnError(
    await db()
      .from('dua_requests')
      .insert({ author_id: me, body: body.trim(), is_anonymous: isAnonymous })
      .select('*, author:profiles!dua_requests_author_id_fkey(*)')
      .single(),
  );
  return { ...toDua(row), iSaidAmeen: false };
};

export const toggleAmeen = async (duaId: string, currentlyOn: boolean): Promise<void> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  if (currentlyOn) {
    throwOnError(await db().from('dua_ameens').delete().eq('dua_id', duaId).eq('user_id', me) as any);
  } else {
    throwOnError(await db().from('dua_ameens').insert({ dua_id: duaId, user_id: me }) as any);
  }
};

export const softDeleteDua = async (id: string): Promise<void> => {
  throwOnError(await db().from('dua_requests').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id').single());
};

// =========================================================================
// Reports
// =========================================================================

export const reportEntity = async (
  entityType: 'message' | 'reflection' | 'comment' | 'group' | 'user' | 'dua_request' | 'challenge',
  entityId: string,
  reason: 'spam' | 'harassment' | 'inappropriate' | 'hate' | 'misinfo' | 'other',
  detail: string,
  groupId?: string | null,
): Promise<void> => {
  const me = await myId();
  if (!me) throw new Error('not_authenticated');
  throwOnError(
    await db()
      .from('reports')
      .insert({ reporter_id: me, entity_type: entityType, entity_id: entityId, reason, detail: detail.trim() || null, group_id: groupId ?? null }) as any,
  );
};

export { CommunityUnavailableError };
