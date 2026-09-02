import React from 'react';
import type { ReactionEmoji } from '../types';
import type { ReactionSummary } from '../services/communityService';

// The reaction *is* the emoji now (no symbolic name layer) — simplest thing that
// works once the server accepts any emoji rather than a fixed enum (see
// supabase/migrations/20260902110000_free_reaction_emoji.sql). This curated list is
// just the built-in default set; services/emojiUsage.ts's personalized quick-bar
// falls back to it for a new user with no reaction history yet.
export const EMOJI: { key: ReactionEmoji; char: string }[] = [
  { key: '❤️', char: '❤️' },
  { key: '🤲', char: '🤲' },
  { key: '👍', char: '👍' },
  { key: '😂', char: '😂' },
  { key: '😮', char: '😮' },
  { key: '😢', char: '😢' },
];

interface Props {
  summary?: ReactionSummary;
  onToggle: (emoji: ReactionEmoji, currentlyOn: boolean) => void;
  disabled?: boolean;
}

const ReactionBar: React.FC<Props> = ({ summary, onToggle, disabled }) => {
  const counts = summary?.counts ?? {};
  const mine = summary?.mine ?? [];
  return (
    <div className="flex items-center gap-1.5">
      {EMOJI.map(({ key, char }) => {
        const on = mine.includes(key);
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            disabled={disabled}
            onClick={() => onToggle(key, on)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs transition-colors disabled:opacity-50 ${
              on
                ? 'bg-primary/15 border-primary/30 text-primary'
                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            <span>{char}</span>
            {count > 0 && <span className="font-bold tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ReactionBar;
