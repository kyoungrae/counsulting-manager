import React, { useMemo, useRef, useState } from 'react';
import { Upload, FileText, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import { readExpenseFile } from '../utils/expenseExcelReader';
import { parseEmploymentBudgetFile } from '../utils/employmentBudgetParser';
import { parseCareerBudgetFile } from '../utils/careerBudgetParser';
import { BUDGET_TYPES, downloadExpenseWord } from '../utils/expenseWordBuilder';
import { formatWon } from '../utils/employmentRateCatalog';
import { buildEmploymentReceiptItems } from '../utils/employmentReceiptDoc';
import { buildCareerReceiptItems } from '../utils/careerReceiptDoc';
import ewhaCdcLogo from '../assets/ewha-cdc-logo.png';
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
    const [models, setModels] = useState({ career: null, employment: null });
    const [activeType, setActiveType] = useState('career');
    const [activeSheet, setActiveSheet] = useState(null);
    const [previewKind, setPreviewKind] = useState('detail'); // detail | receipt
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const currentWorkbook = workbooks[activeType];
    const currentModel = models[activeType];
    const currentSheet = useMemo(() => {
        if (!currentWorkbook?.sheets?.length) return null;
        const name = activeSheet || currentWorkbook.sheets[0].name;
        return currentWorkbook.sheets.find((s) => s.name === name) || currentWorkbook.sheets[0];
    }, [currentWorkbook, activeSheet]);

    const receiptItems = useMemo(() => {
        if (!currentModel) return [];
        if (activeType === 'employment') return buildEmploymentReceiptItems(currentModel);
        if (activeType === 'career') return buildCareerReceiptItems(currentModel);
        return [];
    }, [activeType, currentModel]);

    const handleFile = async (file, budgetType) => {
        if (!file) return;
        const lower = file.name.toLowerCase();
        if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
            setError('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.');
            return;
        }
        try {
            setError('');
            const preview = await readExpenseFile(file);
            const model = budgetType === 'employment'
                ? await parseEmploymentBudgetFile(file)
                : await parseCareerBudgetFile(file);

            setWorkbooks((prev) => ({ ...prev, [budgetType]: preview }));
            setModels((prev) => ({ ...prev, [budgetType]: model }));
            setActiveType(budgetType);
            setActiveSheet(preview.sheets[0]?.name || null);
            setPreviewKind('detail');
        } catch (err) {
            setError(`파일 읽기 실패: ${err.message || err}`);
        }
    };

    const handleDownload = async (budgetType, docKind = 'detail') => {
        const workbook = workbooks[budgetType];
        const model = models[budgetType];
        if (!workbook || !model) {
            setError(`${BUDGET_TYPES[budgetType].label} 엑셀을 먼저 업로드해 주세요.`);
            return;
        }
        try {
            setIsDownloading(true);
            setError('');
            await downloadExpenseWord({
                budgetType,
                workbook,
                employmentModel: budgetType === 'employment' ? model : null,
                careerModel: budgetType === 'career' ? model : null,
                docKind,
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
        setModels({ career: null, employment: null });
        setActiveSheet(null);
        setPreviewKind('detail');
        setError('');
        Object.values(inputRefs).forEach((ref) => {
            if (ref.current) ref.current.value = '';
        });
    };

    const summaryLabel = activeType === 'employment' ? '취업예산' : '진로예산';
    const mainSectionTitle = currentModel?.mainSectionTitle
        || (activeType === 'employment' ? '[서류면접 컨설팅]' : '[진로개발 컨설팅]');

    return (
        <div className="satisfaction-match-container expense-processing">
            <div className="expense-topbar">
                <div className="ewha-header" style={{ marginBottom: 0 }}>
                    <h1>지출처리</h1>
                </div>
                <button type="button" className="reset-btn" onClick={handleReset}>
                    <RotateCcw size={16} />
                    초기화
                </button>
            </div>
            <p className="expense-lead">
                진로예산 / 취업예산 출석부 엑셀을 각각 올리면 시트별로 집계하고, 지출결의 상세내용·영수증 양식의 워드(.docx)로 내려받습니다.
            </p>

            <div className="upload-section expense-upload-section">
                {ZONES.map((zone) => (
                    <div
                        key={zone.id}
                        className={`drop-zone expense-drop-zone ${isDragging[zone.id] ? 'drag-active' : ''} ${workbooks[zone.id] ? 'has-file' : ''}`}
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
                        <Upload size={22} className="upload-icon" />
                        <span className="zone-title">{zone.label}</span>
                        <span className="zone-desc">{zone.fileHint}</span>
                        {workbooks[zone.id] && (
                            <div className="file-info">
                                <FileText size={14} />
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

            {error && (
                <div className="expense-error">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {currentModel && (
                <div className="expense-summary-card">
                    <div className="expense-summary-title">
                        {summaryLabel} 분석 요약 ({currentModel.period.label})
                    </div>
                    <div className="expense-summary-grid">
                        <div>
                            <strong>{activeType === 'employment' ? '서류면접' : '진로개발'}</strong>{' '}
                            {currentModel.summary.interviewConsultants}명 / {currentModel.summary.interviewSessions}세션
                        </div>
                        <div>
                            <strong>서면첨삭</strong> 국문 {currentModel.summary.correctionKorean}명 · 영문 {currentModel.summary.correctionEnglish}명 / {currentModel.summary.correctionSessions}건
                        </div>
                        <div><strong>지급 합계</strong> {formatWon(currentModel.summary.totalAmount)}원</div>
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
                                            setPreviewKind('detail');
                                        }}
                                    >
                                        {zone.label}
                                        {workbooks[zone.id] ? ` (${workbooks[zone.id].sheets.length})` : ''}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="expense-download-group">
                            <button
                                type="button"
                                className="download-btn"
                                disabled={!models[activeType] || isDownloading}
                                onClick={() => handleDownload(activeType, 'detail')}
                            >
                                <Download size={16} />
                                지출결의 상세(워드)
                            </button>
                            <button
                                type="button"
                                className="download-btn"
                                disabled={!models[activeType] || isDownloading}
                                onClick={() => handleDownload(activeType, 'receipt')}
                            >
                                <Download size={16} />
                                영수증(워드)
                            </button>
                        </div>
                    </div>

                    {currentWorkbook ? (
                        <>
                            <div className="expense-sheet-tabs">
                                <button
                                    type="button"
                                    className={`sheet-tab ${previewKind === 'detail' ? 'active' : ''}`}
                                    onClick={() => setPreviewKind('detail')}
                                >
                                    지출결의 상세 미리보기
                                </button>
                                <button
                                    type="button"
                                    className={`sheet-tab ${previewKind === 'receipt' ? 'active' : ''}`}
                                    onClick={() => setPreviewKind('receipt')}
                                >
                                    영수증 미리보기
                                    <span className="sheet-meta">{receiptItems.length}장</span>
                                </button>
                            </div>

                            {currentModel ? (
                                previewKind === 'receipt' ? (
                                    <div className="table-container expense-receipt-preview">
                                        {receiptItems.length === 0 ? (
                                            <div className="empty-state">
                                                <FileText size={40} />
                                                <p>영수증으로 만들 집계가 없습니다.</p>
                                            </div>
                                        ) : (
                                            receiptItems.map((item) => (
                                                <div key={item.id} className="receipt-card">
                                                    <div className="receipt-card-kicker">
                                                        {item.kicker
                                                            || (activeType === 'career' ? '[진로컨설팅]' : '[취업컨설팅]')}
                                                    </div>
                                                    <div className="receipt-card-title">강사비 지급내역</div>
                                                    <table className="receipt-table">
                                                        <tbody>
                                                            <tr>
                                                                <th>내용</th>
                                                                <td>{item.contentLabel}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>지급액</th>
                                                                <td>{item.amountText}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>강의일시</th>
                                                                <td className="receipt-multiline">{item.dayText}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>장소</th>
                                                                <td>{item.place}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>성명 (고유번호)</th>
                                                                <td>
                                                                    {item.displayName}
                                                                    {item.profile?.code ? ` (${item.profile.code})` : ''}
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <th>생년월일</th>
                                                                <td>{item.profile?.birth || '-'}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>핸드폰번호</th>
                                                                <td>{item.profile?.phone || '-'}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>소속 및 주소</th>
                                                                <td className="receipt-multiline">{item.affiliationText || '-'}</td>
                                                            </tr>
                                                            <tr>
                                                                <th>통장번호</th>
                                                                <td className="receipt-multiline">{item.accountText || '-'}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    {item.missingProfile && (
                                                        <div className="receipt-missing">
                                                            강사 인적/계좌 정보가 등록되어 있지 않습니다.
                                                        </div>
                                                    )}
                                                    <div className="receipt-footer-logo">
                                                        <img
                                                            src={ewhaCdcLogo}
                                                            alt="이화여자대학교 인재개발원 EWHA CAREER DEVELOPMENT CENTER"
                                                        />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <div className="table-container expense-blocks-preview">
                                        <h3 className="expense-block-heading">{mainSectionTitle}</h3>
                                        {currentModel.interviewBlocks.map((block, idx) => (
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

                                        {(currentModel.correctionBlocks.korean.length > 0
                                            || currentModel.correctionBlocks.english.length > 0) && (
                                            <>
                                                <h3 className="expense-block-heading">[서면첨삭]</h3>
                                                <div className="expense-block">
                                                    {currentModel.correctionBlocks.korean.length > 0 && (
                                                        <>
                                                            <div className="expense-block-title">(국문)</div>
                                                            <ul>
                                                                {currentModel.correctionBlocks.korean.map((block, idx) => (
                                                                    <li key={`k-${block.consultant}`}>
                                                                        ({idx + 1}) {block.displayName} 강사= 총 {block.sessionCount}세션*세션당 {formatWon(block.rate)}원= {formatWon(block.amount)}원
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}
                                                    {currentModel.correctionBlocks.english.length > 0 && (
                                                        <>
                                                            <div className="expense-block-title" style={{ marginTop: 12 }}>(영문)</div>
                                                            <ul>
                                                                {currentModel.correctionBlocks.english.map((block, idx) => (
                                                                    <li key={`e-${block.consultant}`}>
                                                                        ({idx + 1}) {block.displayName} 강사= 총 {block.sessionCount}세션*세션당 {formatWon(block.rate)}원= {formatWon(block.amount)}원
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )
                            ) : (
                                <div className="empty-state">
                                    <FileText size={40} />
                                    <p>분석 결과를 준비하지 못했습니다. 출석부 양식 엑셀인지 확인해 주세요.</p>
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
