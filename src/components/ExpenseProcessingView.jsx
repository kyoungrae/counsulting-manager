import React, { useMemo, useRef, useState } from 'react';
import { Upload, FileText, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import { readExpenseFile } from '../utils/expenseExcelReader';
import { BUDGET_TYPES, downloadExpenseWord } from '../utils/expenseWordBuilder';
import './EwhaGrid.css';
import './SatisfactionMatch.css';
import './ExpenseProcessingView.css';

const ZONES = [BUDGET_TYPES.career, BUDGET_TYPES.employment];

const emptyDrag = { career: false, employment: false };

const ExpenseProcessingView = () => {
    const inputRefs = {
        career: useRef(null),
        employment: useRef(null),
    };
    const [isDragging, setIsDragging] = useState(emptyDrag);
    const [workbooks, setWorkbooks] = useState({ career: null, employment: null });
    const [activeType, setActiveType] = useState('career');
    const [activeSheet, setActiveSheet] = useState(null);
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const currentWorkbook = workbooks[activeType];
    const currentSheet = useMemo(() => {
        if (!currentWorkbook?.sheets?.length) return null;
        const name = activeSheet || currentWorkbook.sheets[0].name;
        return currentWorkbook.sheets.find((s) => s.name === name) || currentWorkbook.sheets[0];
    }, [currentWorkbook, activeSheet]);

    const handleFile = async (file, budgetType) => {
        if (!file) return;
        const lower = file.name.toLowerCase();
        if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
            setError('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
            return;
        }
        try {
            setError('');
            const parsed = await readExpenseFile(file);
            setWorkbooks((prev) => ({ ...prev, [budgetType]: parsed }));
            setActiveType(budgetType);
            setActiveSheet(parsed.sheets[0]?.name || null);
        } catch (err) {
            setError(`파일 읽기 실패: ${err.message || err}`);
        }
    };

    const handleDownload = async (budgetType) => {
        const workbook = workbooks[budgetType];
        if (!workbook) {
            setError(`${BUDGET_TYPES[budgetType].label} 엑셀을 먼저 업로드해 주세요.`);
            return;
        }
        try {
            setIsDownloading(true);
            setError('');
            await downloadExpenseWord({ budgetType, workbook });
        } catch (err) {
            setError(`워드 생성 실패: ${err.message || err}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleReset = () => {
        if (!window.confirm('업로드한 진로예산/취업예산 파일을 모두 초기화할까요?')) return;
        setWorkbooks({ career: null, employment: null });
        setActiveSheet(null);
        setError('');
        Object.values(inputRefs).forEach((ref) => {
            if (ref.current) ref.current.value = '';
        });
    };

    return (
        <div className="satisfaction-match-container expense-processing">
            <div className="ewha-header" style={{ marginBottom: 4 }}>
                <h1>지출처리</h1>
            </div>
            <p className="expense-lead">
                진로예산 / 취업예산 엑셀을 각각 올리면 시트별로 읽고, 유형별 결과 워드 파일로 내려받을 수 있습니다.
            </p>

            <div className="upload-section">
                {ZONES.map((zone) => (
                    <div
                        key={zone.id}
                        className={`drop-zone ${isDragging[zone.id] ? 'drag-active' : ''} ${workbooks[zone.id] ? 'has-file' : ''}`}
                        onClick={() => inputRefs[zone.id]?.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging((p) => ({ ...p, [zone.id]: true }));
                        }}
                        onDragLeave={() => setIsDragging((p) => ({ ...p, [zone.id]: false }))}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging((p) => ({ ...p, [zone.id]: false }));
                            const file = e.dataTransfer.files?.[0];
                            handleFile(file, zone.id);
                        }}
                    >
                        <Upload size={32} className="upload-icon" />
                        <span className="zone-title">{zone.label}</span>
                        <span className="zone-desc">{zone.fileHint} 파일을 업로드하세요</span>
                        {workbooks[zone.id] && (
                            <div className="file-info">
                                <FileText size={16} />
                                {workbooks[zone.id].fileName}
                                <span className="sheet-count">{workbooks[zone.id].sheets.length}개 시트</span>
                            </div>
                        )}
                        <input
                            ref={inputRefs[zone.id]}
                            type="file"
                            accept=".xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                handleFile(file, zone.id);
                            }}
                        />
                    </div>
                ))}
            </div>

            <div className="expense-toolbar">
                <button type="button" className="reset-btn" onClick={handleReset}>
                    <RotateCcw size={16} />
                    초기화
                </button>
                <div className="expense-download-group">
                    {ZONES.map((zone) => (
                        <button
                            key={zone.id}
                            type="button"
                            className="download-btn"
                            disabled={!workbooks[zone.id] || isDownloading}
                            onClick={() => handleDownload(zone.id)}
                            title={workbooks[zone.id] ? `${zone.label} 워드 다운로드` : `${zone.label} 파일을 먼저 업로드하세요`}
                        >
                            <Download size={16} />
                            {zone.label} 워드
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="expense-error">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {(workbooks.career || workbooks.employment) && (
                <div className="comparison-results">
                    <div className="results-header">
                        <div className="results-header-left">
                            <div className="main-tabs">
                                {ZONES.map((zone) => (
                                    <button
                                        key={zone.id}
                                        type="button"
                                        className={`main-tab ${activeType === zone.id ? 'active' : ''}`}
                                        disabled={!workbooks[zone.id]}
                                        onClick={() => {
                                            setActiveType(zone.id);
                                            setActiveSheet(workbooks[zone.id]?.sheets?.[0]?.name || null);
                                        }}
                                    >
                                        {zone.label}
                                        {workbooks[zone.id] ? ` (${workbooks[zone.id].sheets.length})` : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {currentWorkbook ? (
                        <>
                            <div className="expense-sheet-tabs">
                                {currentWorkbook.sheets.map((sheet) => (
                                    <button
                                        key={sheet.name}
                                        type="button"
                                        className={`sheet-tab ${currentSheet?.name === sheet.name ? 'active' : ''}`}
                                        onClick={() => setActiveSheet(sheet.name)}
                                    >
                                        {sheet.name}
                                        <span className="sheet-meta">{sheet.rowCount}행</span>
                                    </button>
                                ))}
                            </div>

                            <div className="table-container">
                                {currentSheet ? (
                                    <table className="comparison-table expense-preview-table">
                                        <thead>
                                            <tr>
                                                {(currentSheet.header.length
                                                    ? currentSheet.header
                                                    : Array.from({ length: currentSheet.colCount }, (_, i) => `열 ${i + 1}`)
                                                ).map((h, idx) => (
                                                    <th key={`${currentSheet.name}-h-${idx}`}>{h || `열 ${idx + 1}`}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentSheet.rows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={Math.max(currentSheet.colCount, 1)}>데이터가 없습니다.</td>
                                                </tr>
                                            ) : (
                                                currentSheet.rows.map((row, rIdx) => (
                                                    <tr key={`${currentSheet.name}-r-${rIdx}`}>
                                                        {(currentSheet.header.length
                                                            ? currentSheet.header
                                                            : row
                                                        ).map((_, cIdx) => (
                                                            <td key={`${currentSheet.name}-c-${rIdx}-${cIdx}`}>
                                                                {row[cIdx] ?? ''}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <FileText size={40} />
                            <p>선택한 유형의 엑셀을 업로드하면 시트 미리보기가 표시됩니다.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExpenseProcessingView;
