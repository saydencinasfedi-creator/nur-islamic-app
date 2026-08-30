import React from 'react';

interface GoalIconProps {
    icon: string;
    iconImage?: string;
    className?: string;
}

// Renders either a user-uploaded photo or a Material Symbols icon for a Goal — used
// wherever a goal's icon is displayed (Dashboard tile, Daily Goals row, the edit form).
const GoalIcon: React.FC<GoalIconProps> = ({ icon, iconImage, className }) => {
    if (iconImage) {
        return <img src={iconImage} className={`object-cover rounded-full ${className ?? ''}`} />;
    }
    return <span className={`material-symbols-outlined flex items-center justify-center ${className ?? ''}`}>{icon}</span>;
};

export default GoalIcon;
