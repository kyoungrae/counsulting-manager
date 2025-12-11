import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, GraduationCap, Briefcase } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ activeMenu, onMenuClick }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const menuItems = [
        { id: 'jinro', label: '진로', icon: <GraduationCap size={20} /> },
        { id: 'job', label: '취업', icon: <Briefcase size={20} /> }
    ];

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''} `}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    {isCollapsed ? 'E' : 'EWHA'}
                </div>
                <button className="toggle-btn" onClick={toggleSidebar}>
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            <ul className="menu-list">
                {menuItems.map((item) => (
                    <li
                        key={item.id}
                        className={`menu-item ${activeMenu === item.label ? 'active' : ''}`}
                        onClick={() => onMenuClick(item.label)}
                        title={isCollapsed ? item.label : ''}
                    >
                        <span className="menu-icon">{item.icon}</span>
                        {!isCollapsed && <span className="menu-item-text">{item.label}</span>}
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Sidebar;
