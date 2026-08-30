
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Goal, GoalType } from '../types';
import { useUser } from '../contexts/UserContext';
import GoalFormSheet from '../components/GoalFormSheet';
import GoalIcon from '../components/GoalIcon';

interface DailyGoalsProps {
    onBack: () => void;
}

const isGoalComplete = (g: Goal) => g.type === 'boolean' ? g.done : g.current >= (g.target && g.target > 0 ? g.target : 1);
const goalRatio = (g: Goal) => g.type === 'boolean' ? (g.done ? 1 : 0) : Math.min(g.current / (g.target && g.target > 0 ? g.target : 1), 1);

const DailyGoals: React.FC<DailyGoalsProps> = ({ onBack }) => {
    const { goals, goalsTodayPercent, toggleBooleanGoal, setGoalAmount, addGoal, updateGoal, deleteGoal, reorderGoals, t } = useUser();

    const [showForm, setShowForm] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [amountGoal, setAmountGoal] = useState<Goal | null>(null);
    const [amountInput, setAmountInput] = useState('');

    // Reorder drag: same pointer-based drag + FLIP-ease pattern used for bookmarked ayahs
    // and My Recitations — the dragged row is pulled out of the list and rendered as a
    // floating clone that tracks the finger, while the rest reorder underneath.
    const goalRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const goalPrevRects = useRef<Map<string, DOMRect>>(new Map());
    const dragStartYRef = useRef(0);
    const lastSwapTargetRef = useRef<string | null>(null);
    const [draggingGoalId, setDraggingGoalId] = useState<string | null>(null);
    const [dragDeltaY, setDragDeltaY] = useState(0);
    const dragDeltaYRef = useRef(0);
    const [dragOriginRect, setDragOriginRect] = useState<DOMRect | null>(null);
    const [isReorderMode, setIsReorderMode] = useState(false);

    const handleGoalPointerDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
        const rowEl = goalRowRefs.current.get(id);
        setDragOriginRect(rowEl ? rowEl.getBoundingClientRect() : null);
        setDraggingGoalId(id);
        setDragDeltaY(0);
        dragDeltaYRef.current = 0;
        lastSwapTargetRef.current = null;
        dragStartYRef.current = e.clientY;
    };

    useEffect(() => {
        if (!draggingGoalId) return;
        const draggedId = draggingGoalId;
        const originRect = dragOriginRect;

        const handleMove = (e: PointerEvent) => {
            const delta = e.clientY - dragStartYRef.current;
            dragDeltaYRef.current = delta;
            setDragDeltaY(delta);

            const el = document.elementFromPoint(e.clientX, e.clientY);
            const row = el?.closest('[data-goal-id]') as HTMLElement | null;
            const targetId = row?.getAttribute('data-goal-id');
            if (!targetId || targetId === draggedId || targetId === lastSwapTargetRef.current) return;
            lastSwapTargetRef.current = targetId;

            const rects = new Map<string, DOMRect>();
            goalRowRefs.current.forEach((rowEl, rowId) => rects.set(rowId, rowEl.getBoundingClientRect()));
            goalPrevRects.current = rects;

            const ids = goals.map(g => g.id);
            const fromIdx = ids.indexOf(draggedId);
            const toIdx = ids.indexOf(targetId);
            if (fromIdx === -1 || toIdx === -1) return;
            const updated = [...ids];
            updated.splice(fromIdx, 1);
            updated.splice(toIdx, 0, draggedId);
            reorderGoals(updated);
        };

        const handleUp = () => {
            if (originRect) {
                goalPrevRects.current.set(draggedId, { top: originRect.top + dragDeltaYRef.current } as DOMRect);
            }
            setDraggingGoalId(null);
            setDragOriginRect(null);
            setDragDeltaY(0);
            lastSwapTargetRef.current = null;
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleUp);
        };
    }, [draggingGoalId, dragOriginRect, goals, reorderGoals]);

    useLayoutEffect(() => {
        const prevRects = goalPrevRects.current;
        if (prevRects.size === 0) return;
        goalPrevRects.current = new Map();

        goalRowRefs.current.forEach((rowEl, id) => {
            const before = prevRects.get(id);
            if (!before) return;
            const after = rowEl.getBoundingClientRect();
            const deltaY = before.top - after.top;
            if (Math.abs(deltaY) < 1) return;

            rowEl.style.transition = 'none';
            rowEl.style.transform = `translateY(${deltaY}px)`;
            rowEl.getBoundingClientRect();
            requestAnimationFrame(() => {
                rowEl.style.transition = 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)';
                rowEl.style.transform = '';
            });
        });
    }, [goals, draggingGoalId]);

    const progress = goalsTodayPercent;
    const completedCount = goals.filter(isGoalComplete).length;

    const openAdd = () => { setEditingGoal(null); setShowForm(true); };
    const openEdit = (g: Goal) => { setEditingGoal(g); setShowForm(true); };

    const handleSaveGoal = (data: { label: string; icon: string; iconImage?: string; type: GoalType; target?: number }) => {
        if (editingGoal) {
            updateGoal(editingGoal.id, data);
        } else {
            addGoal(data);
        }
        setShowForm(false);
        setEditingGoal(null);
    };

    const handleDeleteGoal = () => {
        if (editingGoal) deleteGoal(editingGoal.id);
        setShowForm(false);
        setEditingGoal(null);
    };

    const openAmountModal = (g: Goal) => {
        setAmountGoal(g);
        setAmountInput(String(g.current));
    };

    const saveAmount = () => {
        if (!amountGoal) return;
        setGoalAmount(amountGoal.id, parseInt(amountInput, 10) || 0);
        setAmountGoal(null);
    };

    const handleGoalTap = (g: Goal) => {
        if (g.type === 'boolean') toggleBooleanGoal(g.id);
        else openAmountModal(g);
    };

    return (
        <div className="relative flex h-full min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-hidden">
            <header className="flex items-center gap-4 p-6 pt-12 pb-4 bg-background-light dark:bg-background-dark z-10">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">arrow_back_ios_new</span>
                </button>
                <h1 className="text-2xl font-bold tracking-tight flex-1">{t('dailyGoals.title')}</h1>
                <button
                    onClick={openAdd}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl">add</span>
                </button>
            </header>

            <div className="p-6 pt-2">
                {/* Progress Card */}
                <div className="bg-primary/10 dark:bg-primary/5 rounded-3xl p-6 mb-8 relative overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="relative size-32 mb-4 flex items-center justify-center">
                            <svg className="absolute inset-0 size-full -rotate-90 transform" viewBox="0 0 36 36">
                                <path className="text-primary/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4"></path>
                                <path className="text-primary transition-all duration-1000 ease-out" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4"></path>
                            </svg>
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-bold text-primary">{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('dailyGoals.keepItUp')}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('dailyGoals.completedProgress', { count: completedCount, total: goals.length })}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dailyGoals.yourGoals')}</h3>
                    {goals.length > 1 && (
                        isReorderMode ? (
                            <button onClick={() => setIsReorderMode(false)} className="text-xs font-bold text-primary">{t('common.done')}</button>
                        ) : (
                            <button onClick={() => setIsReorderMode(true)} className="flex items-center gap-1 text-xs font-bold text-primary">
                                <span className="material-symbols-outlined text-[14px]">swap_vert</span>
                                {t('dailyGoals.reorder')}
                            </button>
                        )
                    )}
                </div>

                <div className="space-y-4">
                    {goals.map((g) => {
                        const isCompleted = isGoalComplete(g);
                        const ratio = goalRatio(g);
                        return (
                            <div
                                key={g.id}
                                ref={(el) => {
                                    if (el) goalRowRefs.current.set(g.id, el);
                                    else goalRowRefs.current.delete(g.id);
                                }}
                                data-goal-id={g.id}
                                className={`p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 ${isCompleted ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5'}`}
                                style={draggingGoalId === g.id ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
                            >
                                {isReorderMode && (
                                    <button
                                        onPointerDown={(e) => handleGoalPointerDown(e, g.id)}
                                        className="touch-none cursor-grab active:cursor-grabbing text-gray-400 shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => handleGoalTap(g)}
                                    className={`relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}
                                >
                                    {g.type === 'amount' && !isCompleted && (
                                        <svg className="absolute inset-0 size-full -rotate-90 transform" viewBox="0 0 36 36">
                                            <path className="text-primary/60" strokeDasharray={`${ratio * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3"></path>
                                        </svg>
                                    )}
                                    <span className="relative z-10 flex items-center justify-center size-full">
                                        <GoalIcon icon={g.icon} iconImage={g.iconImage} className="text-2xl size-full" />
                                    </span>
                                    {isCompleted && (
                                        <div className="absolute bottom-0 right-0 bg-primary border-2 border-background-light dark:border-background-dark rounded-full size-5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>
                                        </div>
                                    )}
                                </button>
                                <button onClick={() => handleGoalTap(g)} className="flex-1 text-left">
                                    <h3 className={`font-bold ${isCompleted ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{g.label}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {g.type === 'amount' ? `${g.current} / ${g.target ?? 1}` : (g.note || (isCompleted ? t('common.done') : t('dailyGoals.tapToMarkDone')))}
                                    </p>
                                </button>
                                <button
                                    onClick={() => openEdit(g)}
                                    className="size-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Floating clone of the dragged row: pulled fully out of the list flow above
                (via visibility: hidden) so it can't leave a gap while it tracks the finger. */}
            {draggingGoalId && dragOriginRect && (() => {
                const dragged = goals.find(g => g.id === draggingGoalId);
                if (!dragged) return null;
                const isCompleted = isGoalComplete(dragged);
                return (
                    <div
                        style={{
                            position: 'fixed',
                            top: dragOriginRect.top + dragDeltaY,
                            left: dragOriginRect.left,
                            width: dragOriginRect.width,
                            zIndex: 200,
                            pointerEvents: 'none',
                            transform: 'scale(1.03)'
                        }}
                        className={`p-4 rounded-2xl border shadow-2xl flex items-center gap-4 ${isCompleted ? 'bg-primary/5 border-primary/40' : 'bg-white dark:bg-white/5 border-primary/40'}`}
                    >
                        <span className="material-symbols-outlined text-[20px] text-gray-400 shrink-0">drag_indicator</span>
                        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400'}`}>
                            <GoalIcon icon={dragged.icon} iconImage={dragged.iconImage} className="text-2xl size-full" />
                            {isCompleted && (
                                <div className="absolute bottom-0 right-0 bg-primary border-2 border-background-light dark:border-background-dark rounded-full size-5 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-bold ${isCompleted ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{dragged.label}</h3>
                        </div>
                    </div>
                );
            })()}

            <GoalFormSheet
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditingGoal(null); }}
                onSave={handleSaveGoal}
                onDelete={editingGoal ? handleDeleteGoal : undefined}
                editingGoal={editingGoal}
            />

            {/* Set Amount Modal */}
            {amountGoal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200" onClick={() => setAmountGoal(null)}>
                    <div className="w-full max-w-sm bg-white dark:bg-card-dark rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{amountGoal.label}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('dailyGoals.amountPrompt', { target: amountGoal.target ?? 1 })}</p>
                        <input
                            type="number"
                            min={0}
                            value={amountInput}
                            onChange={(e) => setAmountInput(e.target.value)}
                            autoFocus
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-center text-2xl font-bold focus:outline-none focus:border-primary transition-colors mb-6"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setAmountGoal(null)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">{t('common.cancel')}</button>
                            <button onClick={saveAmount} className="flex-1 py-3 rounded-xl font-bold bg-primary text-background-dark shadow-glow hover:scale-105 transition-transform">{t('common.save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyGoals;
