import React, { useMemo, useRef, useState } from 'react';
import { Upload, FileText, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import { readExpenseFile } from '../utils/expenseExcelReader';
import { parseEmploymentBudgetFile } from '../utils/employmentBudgetParser';
import { BUDGET_TYPES, downloadExpenseWord } from '../utils/expenseWordBuilder';
import { formatWon } from '../utils/employmentRateCatalog';
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
    const [employmentModel, setEmploymentModel] = useState(null);
    const [activeType, setActiveType] = useState('employment');
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
            if (budgetType === 'employment') {
                const model = await parseEmploymentBudgetFile(file);
                const preview = await readExpenseFile(file);
                setEmploymentModel(model);
                setWorkbooks((prev) => ({ ...prev, employment: preview }));
                setActiveType('employment');
                setActiveSheet(preview.sheets[0]?.name || null);
            } else {
                const parsed = await readExpenseFile(file);
                setWorkbooks((prev) => ({ ...prev, career: parsed }));
                setActiveType('career');
                setActiveSheet(parsed.sheets[0]?.name || null);
            }
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
        if (budgetType === 'employment' && !employmentModel) {
            setError('취업예산 출석부 분석 결과가 없습니다. 양식 파일을 다시 업로드해 주세요.');
            return;
        }
        try {
            setIsDownloading(true);
            setError('');
            await downloadExpenseWord({
                budgetType,
                workbook,
                employmentModel: budgetType === 'employment' ? employmentModel : null,
            });
        } catch (err) {
            setError(`워드 생성 실패: ${err.message || err}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleReset = () => {
        if (!window.confirm('업로드한 진로예산/취업예산 파일을 모두 초기화할까요?')) return;
        setWorkbooks({ career: null, employment: null });
        setEmploymentModel(null);
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
                취업예산은 출석부 엑셀을 올리면 지출결의 상세내용 양식의 워드(.docx)로 내려받습니다.
                진로예산 양식은 별도 제공 후 연결됩니다.
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
                        <span className="zone-desc">{zone.fileHint}</span>
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
                            disabled={!workbooks[zone.id] || isDownloading || (zone.id === 'employment' && !employmentModel)}
                            onClick={() => handleDownload(zone.id)}
                            title={workbooks[zone.id] ? `${zone.label} 결과 다운로드` : `${zone.label} 파일을 먼저 업로드하세요`}
                        >
                            <Download size={16} />
                            {zone.id === 'employment' ? '지출결의 상세(워드)' : `${zone.label} 워드`}
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

            {employmentModel && activeType === 'employment' && (
                <div className="expense-summary-card">
                    <div className="expense-summary-title">
                        취업예산 분석 요약 ({employmentModel.period.label})
                    </div>
                    <div className="expense-summary-grid">
                        <div><strong>서류면접</strong> {employmentModel.summary.interviewConsultants}명 / {employmentModel.summary.interviewSessions}세션</div>
                        <div><strong>서면첨삭</strong> 국문 {employmentModel.summary.correctionKorean}명 · 영문 {employmentModel.summary.correctionEnglish}명 / {employmentModel.summary.correctionSessions}건</div>
                        <div><strong>지급 합계</strong> {formatWon(employmentModel.summary.totalAmount)}원</div>
                    </div>
                    <div className="expense-summary-note">
                        결과 문서는 제공하신 HWP 양식과 같은 구조로 워드(.docx) 파일을 생성합니다. (웹에서 HWP 직접 생성은 지원하지 않습니다)
                    </div>
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

                            {activeType === 'employment' && employmentModel ? (
                                <div className="table-container expense-blocks-preview">
                                    <h3 className="expense-block-heading">[서류면접 컨설팅]</h3>
                                    {employmentModel.interviewBlocks.map((block, idx) => (
                                        <div key={block.consultant} className="expense-block">
                                            <div className="expense-block-title">
                                                ({idx + 1}) {block.displayName} 강사= 총 {block.sessionCount}세션*세션당 {formatWon(block.rate)}원= {formatWon(block.amount)}원
                                            </div>
                                            <ul>
                                                {block.days.map((day) => (
                                                    <li key={`${block.consultant}-${day.dayKey}`}>
                                                        {day.dayKey} – {day.times.join(', ')} ({day.count}세션)
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                    <h3 className="expense-block-heading">[서면첨삭]</h3>
                                    <div className="expense-block">
                                        <div className="expense-block-title">(국문)</div>
                                        <ul>
                                            {employmentModel.correctionBlocks.korean.map((block, idx) => (
                                                <li key={`k-${block.consultant}`}>
                                                    ({idx + 1}) {block.displayName} 강사= 총 {block.sessionCount}세션*세션당 {formatWon(block.rate)}원= {formatWon(block.amount)}원
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="expense-block-title" style={{ marginTop: 12 }}>(영문)</div>
                                        <ul>
                                            {employmentModel.correctionBlocks.english.map((block, idx) => (
                                                <li key={`e-${block.consultant}`}>
                                                    ({idx + 1}) {block.displayName} 강사= 총 {block.sessionCount}세션*세션당 {formatWon(block.rate)}원= {formatWon(block.amount)}원
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
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
                                                            {(currentSheet.header.length ? currentSheet.header : row).map((_, cIdx) => (
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
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <FileText size={40} />
                            <p>선택한 유형의 엑셀을 업로드하면 미리보기가 표시됩니다.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExpenseProcessingView;
