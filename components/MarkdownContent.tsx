import React from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Inline Qur'an reference token authored in the editor, e.g. [[quran:2:255|Al-Baqarah]].
// It is rewritten to a markdown link with a custom scheme that the `a` renderer turns
// into a clickable inline chip.
const QURAN_TOKEN_RE = /\[\[quran:(\d{1,3}):(\d{1,4})(?:\|([^\]|]+))?\]\]/g;

export const quranTokenToText = (md: string): string =>
    md.replace(QURAN_TOKEN_RE, (_m, s, a, name) => (name ? `${name} ${s}:${a}` : `${s}:${a}`));

// Shared Markdown renderer — the component map that used to live inline in
// pages/AICompanion.tsx, extracted so the Reflections reader renders formatted text the
// same way (bold in primary green, primary-bordered blockquotes, GFM tables/lists).
const baseComponents = {
    p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-bold text-primary" {...props} />,
    em: ({ node, ...props }: any) => <em className="italic text-gray-600 dark:text-gray-300" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-2" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2 mb-1" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
    li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
    blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-primary/50 pl-4 py-1 italic bg-gray-100 dark:bg-white/5 rounded-r my-2 text-gray-600 dark:text-gray-400" {...props} />,
    code: ({ node, ...props }: any) => <code className="bg-gray-200 dark:bg-black/30 px-1 py-0.5 rounded text-primary font-mono text-xs" {...props} />,
    pre: ({ node, ...props }: any) => <pre className="bg-gray-200 dark:bg-black/30 p-2 rounded-lg overflow-x-auto my-2 text-xs" {...props} />,
    table: ({ node, ...props }: any) => <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 dark:border-white/10"><table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-left text-xs" {...props} /></div>,
    thead: ({ node, ...props }: any) => <thead className="bg-gray-100 dark:bg-white/5" {...props} />,
    tbody: ({ node, ...props }: any) => <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-gray-50 dark:bg-black/10" {...props} />,
    tr: ({ node, ...props }: any) => <tr className="hover:bg-gray-100 dark:hover:bg-white/5 transition-colors" {...props} />,
    th: ({ node, ...props }: any) => <th className="px-3 py-2 font-semibold text-primary" {...props} />,
    td: ({ node, ...props }: any) => <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap" {...props} />,
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

interface MarkdownContentProps {
    children: string;
    className?: string;
    // When provided, [[quran:S:A|Name]] tokens render as tappable inline chips.
    onQuranRef?: (surahNumber: number, ayahNumber: number) => void;
    // When provided, the chip also shows the ayah's text.
    resolveAyahText?: (surahNumber: number, ayahNumber: number) => string | undefined;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ children, className, onQuranRef, resolveAyahText }) => {
    const src = onQuranRef
        ? children.replace(QURAN_TOKEN_RE, (_m, s, a, name) => `[${name ? `${name} ` : ''}${s}:${a}](quranref:${s}:${a})`)
        : children;

    const components = {
        ...baseComponents,
        a: ({ node, href, children: linkChildren, ...props }: any) => {
            if (typeof href === 'string' && href.startsWith('quranref:')) {
                const [, s, a] = href.split(':');
                const text = resolveAyahText?.(Number(s), Number(a));
                return (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.preventDefault(); onQuranRef?.(Number(s), Number(a)); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onQuranRef?.(Number(s), Number(a)); } }}
                        className="inline align-baseline mx-0.5 px-1.5 py-0.5 rounded-md text-[0.9em] font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[1em] align-[-0.15em] mr-0.5">menu_book</span>
                        {linkChildren}
                        {text ? <span className="opacity-80"> — {truncate(text, 140)}</span> : null}
                    </span>
                );
            }
            return <a className="text-primary underline underline-offset-2 break-words" href={href} {...props}>{linkChildren}</a>;
        },
    };

    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className ?? ''}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => (url.startsWith('quranref:') ? url : defaultUrlTransform(url))}
                components={components}
            >
                {src}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownContent;
