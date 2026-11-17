export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🎄"] as const;

export type ReactionGroup = { emoji: string; users: string[] };

export type ReactionRow = {
  message_id: number;
  user_id: string;
  emoji: string;
};

export function withReactionAdded(
  groups: ReactionGroup[],
  emoji: string,
  userId: string
): ReactionGroup[] {
  const idx = groups.findIndex((g) => g.emoji === emoji);
  if (idx === -1) return [...groups, { emoji, users: [userId] }];
  const g = groups[idx];
  if (g.users.includes(userId)) return groups;
  const next = groups.slice();
  next[idx] = { ...g, users: [...g.users, userId] };
  return next;
}

export function withReactionRemoved(
  groups: ReactionGroup[],
  emoji: string,
  userId: string
): ReactionGroup[] {
  const idx = groups.findIndex((g) => g.emoji === emoji);
  if (idx === -1) return groups;
  const g = groups[idx];
  const users = g.users.filter((u) => u !== userId);
  if (users.length === 0) return groups.filter((_, i) => i !== idx);
  const next = groups.slice();
  next[idx] = { ...g, users };
  return next;
}

export function applyReaction(
  groups: ReactionGroup[],
  emoji: string,
  userId: string,
  add: boolean
): ReactionGroup[] {
  return add
    ? withReactionAdded(groups, emoji, userId)
    : withReactionRemoved(groups, emoji, userId);
}

export function reactionRowsByMessage(
  rows: ReactionRow[] | null | undefined
): Map<number, Map<string, string[]>> {
  const byMsg = new Map<number, Map<string, string[]>>();
  for (const r of rows ?? []) {
    let byEmoji = byMsg.get(r.message_id);
    if (!byEmoji) {
      byEmoji = new Map();
      byMsg.set(r.message_id, byEmoji);
    }
    let users = byEmoji.get(r.emoji);
    if (!users) {
      users = [];
      byEmoji.set(r.emoji, users);
    }
    if (!users.includes(r.user_id)) users.push(r.user_id);
  }
  return byMsg;
}

export function reactionsFor(
  byMsg: Map<number, Map<string, string[]>>,
  messageId: number
): ReactionGroup[] {
  const byEmoji = byMsg.get(messageId);
  if (!byEmoji) return [];
  return [...byEmoji.entries()].map(([emoji, users]) => ({ emoji, users }));
}
