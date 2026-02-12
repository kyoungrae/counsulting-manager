import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, GraduationCap, Users, FileText, BarChart2, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = ({ activeMenu, onMenuClick }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { logout } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        { id: 'career-dev', label: '진로개발', icon: <GraduationCap size={20} /> },
        { id: 'interview', label: '서류면접', icon: <Users size={20} /> },
        { id: 'correction', label: '서면첨삭', icon: <FileText size={20} /> },
        { id: 'stats', label: '통합통계', icon: <BarChart2 size={20} /> },
        { id: 'pre-survey', label: '사전 설문', icon: <FileText size={20} /> },
        { id: 'satisfaction-match', label: '만족도 일치여부', icon: <FileText size={20} /> },
        { id: 'restriction', label: '신청 제한', icon: <AlertCircle size={20} /> }
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
            <div className="sidebar-footer">
                <button
                    type="button"
                    className="sidebar-logout"
                    onClick={() => { logout(); navigate('/login'); }}
                    title="로그아웃"
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span>로그아웃</span>}
                </button>
            </div>
        </nav>
    );
};

export default Sidebar;
