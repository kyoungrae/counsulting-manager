import React from 'react';
import { Receipt } from 'lucide-react';
import './EwhaGrid.css';
import './SatisfactionMatch.css';

const ExpenseProcessingView = () => {
    return (
        <div className="ewha-container">
            <div className="ewha-header">
                <h1>지출처리</h1>
            </div>
            <div className="empty-state">
                <Receipt size={48} />
                <p>지출처리 기능을 준비 중입니다.</p>
            </div>
        </div>
    );
};

export default ExpenseProcessingView;
