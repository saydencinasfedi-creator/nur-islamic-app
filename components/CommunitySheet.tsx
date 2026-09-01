import React, { useEffect } from 'react';
import { pushBackHandler } from '../services/backHandlerStack';

// Shared bottom-sheet shell for the Community sheets. Same visual pattern as
// GoalFormSheet / IconPickerSheet (the repo has no shared sheet component, but
// all of Community's sheets are new so they share this one).
interface CommunitySheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const CommunitySheet: React.FC<CommunitySheetProps> = ({ isOpen, onClose, title, children, footer }) => {
  useEffect(() => {
    if (!isOpen) return;
    return pushBackHandler(() => { onClose(); return true; });
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative w-full max-w-md max-h-[88vh] bg-white dark:bg-[#1a2e25] rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-300 flex flex-col overflow-hidden border border-gray-100 dark:border-white/10">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        <div className="overflow-y-auto no-scrollbar space-y-4 pb-2 flex-1">{children}</div>
        {footer && <div className="pt-4 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

export const sheetField =
  'w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary p-3 outline-none';
export const sheetLabel =
  'text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block';
export const sheetPrimaryBtn = (enabled: boolean) =>
  `w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
    enabled
      ? 'bg-primary text-background-dark hover:bg-[#10d482] shadow-glow'
      : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 cursor-not-allowed'
  }`;
export const sheetChip = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
    active
      ? 'bg-primary text-background-dark border-primary'
      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10'
  }`;

export default CommunitySheet;
