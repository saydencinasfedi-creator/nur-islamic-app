import React from 'react';
import type { ReactionEmoji } from '../types';
import type { ReactionSummary } from '../services/communityService';

export const EMOJI: { key: ReactionEmoji; char: string }[] = [
  { key: 'heart', char: '❤️' },
  { key: 'dua', char: '🤲' },
  { key: 'like', char: '👍' },
  { key: 'laugh', char: '😂' },
  { key: 'wow', char: '😮' },
  { key: 'sad', char: '😢' },
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
