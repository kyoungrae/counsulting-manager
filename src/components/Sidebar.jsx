import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, GraduationCap, Users, FileText, BarChart2, AlertCircle, LogOut, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ewhaLogo from '../assets/symbol-mark.png';
import './Sidebar.css';

const Sidebar = ({ activeMenu, onMenuClick }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const { logout } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        { id: 'career-dev', label: '진로개발', icon: <GraduationCap size={20} /> },
        { id: 'interview', label: '서류면접', icon: <Users size={20} /> },
        { id: 'correction', label: '서면첨삭', icon: <FileText size={20} /> },
        { id: 'stats', label: '통합통계', icon: <BarChart2 size={20} /> },
        { id: 'satisfaction-match', label: '만족도 일치여부', icon: <FileText size={20} /> },
        { id: 'data-extraction', label: '결과보고서', icon: <BarChart2 size={20} /> },
        { id: 'expense-processing', label: '지출처리', icon: <Receipt size={20} /> },
        // { id: 'result-report-builder', label: '결과 보고서 작성', icon: <FileText size={20} /> },
        { id: 'restriction', label: '신청 제한', icon: <AlertCircle size={20} /> }
    ];

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        setLogoutError('');
        try {
            await logout();
            navigate('/login', { replace: true });
        } catch (error) {
            setLogoutError(error.message || '로그아웃에 실패했습니다. 다시 시도해주세요.');
            setLoggingOut(false);
        }
    };

    return (
        <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''} `}>
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <div className="sidebar-logo-box">
                        <img src={ewhaLogo} alt="이화 로고" className="sidebar-logo-image" />
                    </div>
                    {!isCollapsed && <span className="sidebar-brand-title">월간 컨설팅</span>}
                </div>
                <button
                    type="button"
                    className="toggle-btn"
                    onClick={toggleSidebar}
                    aria-label={isCollapsed ? '메뉴 열기' : '메뉴 닫기'}
                    title={isCollapsed ? '메뉴 열기' : '메뉴 닫기'}
                >
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
                {logoutError && <p role="alert" style={{ fontSize: 12, padding: '0 12px' }}>{logoutError}</p>}
                <button
                    type="button"
                    className="sidebar-logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    title="로그아웃"
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span>{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>}
                </button>
            </div>
        </nav>
    );
};

export default Sidebar;
