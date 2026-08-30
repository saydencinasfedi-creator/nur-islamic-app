import React from 'react';

interface AvatarProps {
    src?: string;
    className?: string; // sizing/rounding/border classes — no bg-* utilities needed
    iconClassName?: string;
}

// A stable placeholder (gray circle + person silhouette) instead of falling back to a
// random photo URL, which changes every time the page loads.
const Avatar: React.FC<AvatarProps> = ({ src, className, iconClassName }) => {
    if (src) {
        return <div className={`bg-center bg-no-repeat bg-cover ${className ?? ''}`} style={{ backgroundImage: `url("${src}")` }}></div>;
    }
    return (
        <div className={`bg-gray-300 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 ${className ?? ''}`}>
            <span className={`material-symbols-outlined ${iconClassName ?? 'text-3xl'}`}>person</span>
        </div>
    );
};

export default Avatar;
