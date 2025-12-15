import React, { useMemo, useState, useRef } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
    PieChart, Pie, Cell, Sector
} from 'recharts';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';

const COLORS = ['#00462A', '#0D5F34', '#1A7A40', '#2E934E', '#4CAF60', '#81C784', '#A5D6A7', '#C8E6C9'];
const NO_SHOW_COLOR = '#E74C3C';
const ACTUAL_COLOR = '#00462A';

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
    if (percent < 0.005) return null;

    const radius = outerRadius * 1.05;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 0) * cos;
    const sy = cy + (outerRadius + 0) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#333" fill="none" opacity={0.5} />
            <circle cx={sx} cy={sy} r={2} fill="#333" fillOpacity={0.5} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 6} y={ey} dy={4} textAnchor={textAnchor} fill="#333" fontSize={11} fontWeight="bold">
                {`${name} ${(percent * 100).toFixed(0)}%`}
            </text>
        </g>
    );
};

const EwhaChart = ({ data }) => {
    const [chartType, setChartType] = useState('all'); // all, monthly, actual, frequency, college, consultant

    // Helper for College Percent
    const getTotalCount = (dataset) => dataset.reduce((acc, curr) => acc + (curr.value || curr.count || 0), 0);

    // Aggregation Logic (Similar to MonthlyStatsView)
    const statsData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const monthlyCounts = {};
        data.forEach(item => {
            let dateStr = item.date;
            let monthKey = 'Unknown';
            if (dateStr) {
                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    monthKey = dateStr.substring(0, 7);
                } else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthKey = `${y}-${m}`;
                }
            }
            if (!monthlyCounts[monthKey]) monthlyCounts[monthKey] = 0;
            monthlyCounts[monthKey]++;
        });
        return Object.entries(monthlyCounts)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [data]);

    const actualStatsData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const monthlyCounts = {};
        data.forEach(item => {
            let dateStr = item.consultDate || item.date;
            let monthKey = 'Unknown';
            if (dateStr) {
                const dateString = String(dateStr).trim();
                // Check if YYYY-MM format
                if (dateString.match(/^\d{4}-\d{2}/)) {
                    monthKey = dateString.substring(0, 7);
                }
                // Check if YYYY.MM.DD format (without spaces)
                else if (dateString.match(/^\d{4}\.\d{2}\.\d{2}/)) {
                    monthKey = dateString.substring(0, 7).replace('.', '-');
                }
                // Check if YYYY. MM. DD format (with spaces)
                else if (dateString.match(/^\d{4}\.\s*\d{2}\.\s*\d{2}/)) {
                    const parts = dateString.split('.');
                    const y = parts[0].trim();
                    const m = parts[1].trim();
                    monthKey = `${y}-${m}`;
                }
                // Excel serial date
                else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthKey = `${y}-${m}`;
                }
            }
            if (!monthlyCounts[monthKey]) monthlyCounts[monthKey] = { actual: 0, noShow: 0 };
            const attendStatus = String(item.attend || '').trim();
            if (attendStatus === '불참' || attendStatus === '노쇼' || attendStatus === '결석') {
                monthlyCounts[monthKey].noShow++;
            } else {
                monthlyCounts[monthKey].actual++;
            }
        });
        return Object.entries(monthlyCounts)
            .map(([month, c]) => ({
                month,
                actual: c.actual,
                noShow: c.noShow
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [data]);



    const frequencyData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const monthlyStudentCounts = {};
        data.forEach(item => {
            const studentIdStr = String(item.studentId).trim();
            let dateStr = item.date;
            let monthKey = 'Unknown';
            if (dateStr) {
                if (typeof dateStr === 'string' && dateStr.includes('-')) monthKey = dateStr.substring(0, 7);
                else if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    monthKey = `${y}-${m}`;
                }
            }
            if (!monthlyStudentCounts[monthKey]) monthlyStudentCounts[monthKey] = {};
            if (!monthlyStudentCounts[monthKey][studentIdStr]) monthlyStudentCounts[monthKey][studentIdStr] = 0;
            monthlyStudentCounts[monthKey][studentIdStr]++;
        });

        return Object.entries(monthlyStudentCounts).map(([month, studentMap]) => {
            let count1 = 0, count2 = 0, count3 = 0;
            Object.values(studentMap).forEach(freq => {
                if (freq === 1) count1++;
                else if (freq === 2) count2++;
                else if (freq >= 3) count3++;
            });
            return { month, count1, count2, count3 };
        }).sort((a, b) => a.month.localeCompare(b.month));
    }, [data]);

    const collegeData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const counts = {};
        data.forEach(item => {
            const college = String(item.college || '기타').trim();
            if (!counts[college]) counts[college] = 0;
            counts[college]++;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    const consultantData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const counts = {};
        data.forEach(item => {
            const consultant = String(item.consultant || '미지정').trim();
            if (!counts[consultant]) counts[consultant] = { actual: 0, noShow: 0 };
            const attendStatus = String(item.attend || '').trim();
            if (attendStatus === '불참' || attendStatus === '노쇼' || attendStatus === '결석') {
                counts[consultant].noShow++;
            } else {
                counts[consultant].actual++;
            }
        });
        return Object.entries(counts)
            .map(([name, c]) => ({
                name,
                actual: c.actual,
                noShow: c.noShow,
                total: c.actual + c.noShow
            }))
            .sort((a, b) => b.total - a.total);
    }, [data]);

    const chartRef = useRef(null);

    const handleDownloadImage = async () => {
        if (!chartRef.current) return;

        try {
            const canvas = await html2canvas(chartRef.current, {
                scale: 2, // Higher resolution
                backgroundColor: '#f5f7fa', // Match your app background or white
                logging: false
            });
            const image = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = image;
            link.download = `consulting_charts_overview_${new Date().toISOString().split('T')[0]}.png`;
            link.click();
        } catch (err) {
            console.error("Failed to capture image:", err);
            alert("이미지 저장 중 오류가 발생했습니다.");
        }
    };





    if (!data || data.length === 0) {
        return (
            <div className="chart-container" style={{ textAlign: 'center', padding: '50px' }}>
                <h2>데이터 없음</h2>
                <p>엑셀 파일을 업로드하면 차트가 표시됩니다.</p>
            </div>
        );
    }

    return (
        <div className="chart-dashboard">
            <div className="content-tabs" style={{ marginBottom: '20px' }}>
                <button className={`tab-btn ${chartType === 'all' ? 'active' : ''}`} onClick={() => setChartType('all')}>전체 보기</button>
                <button className={`tab-btn ${chartType === 'monthly' ? 'active' : ''}`} onClick={() => setChartType('monthly')}>월별 신청</button>
                <button className={`tab-btn ${chartType === 'actual' ? 'active' : ''}`} onClick={() => setChartType('actual')}>실제 진행/노쇼</button>
                <button className={`tab-btn ${chartType === 'frequency' ? 'active' : ''}`} onClick={() => setChartType('frequency')}>학생 빈도</button>
                <button className={`tab-btn ${chartType === 'college' ? 'active' : ''}`} onClick={() => setChartType('college')}>단과대 신청 비율</button>
                <button className={`tab-btn ${chartType === 'consultant' ? 'active' : ''}`} onClick={() => setChartType('consultant')}>컨설턴트 실적</button>
            </div>

            {chartType === 'all' ? (
                <>
                    <div ref={chartRef} className="all-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '10px' }}>
                        {/* 1. Monthly */}
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>월별 신청 건수</h4>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={statsData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                        <Legend />
                                        <Bar dataKey="count" name="신청 건수" fill={COLORS[0]} radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="count" position="top" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. Actual vs NoShow */}
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>실제 진행 및 불참/노쇼(컨설팅일자 기준)</h4>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={actualStatsData} margin={{ top: 40, right: 30, left: 20, bottom: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                        <Legend />
                                        <Bar dataKey="actual" name="실제 진행" stackId="a" fill={ACTUAL_COLOR}>
                                            <LabelList dataKey="actual" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                        <Bar dataKey="noShow" name="불참/노쇼" stackId="a" fill={NO_SHOW_COLOR} radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="noShow" position="top" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>



                        {/* 3. Frequency */}
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>학생별 빈도 분포</h4>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={frequencyData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                        <Legend />
                                        <Bar dataKey="count1" name="1회 이용" stackId="a" fill="#81C784">
                                            <LabelList dataKey="count1" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                        <Bar dataKey="count2" name="2회 이용" stackId="a" fill="#4CAF60">
                                            <LabelList dataKey="count2" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                        <Bar dataKey="count3" name="3회 이상" stackId="a" fill="#0D5F34" radius={[4, 4, 0, 0]}>
                                            <LabelList dataKey="count3" position="top" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 4. College */}
                        <div style={{ background: '#fff', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>단과대별 비율</h4>
                            <div style={{ height: '300px', display: 'flex' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={collegeData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={renderCustomizedLabel}
                                                outerRadius={70}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {collegeData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ width: '160px', paddingLeft: '10px', fontSize: '11px' }}>
                                    {collegeData.map((entry, index) => (
                                        <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                            <div style={{ width: '10px', height: '10px', backgroundColor: COLORS[index % COLORS.length], marginRight: '6px', borderRadius: '2px', flexShrink: 0 }}></div>
                                            <div style={{ color: '#333' }}>
                                                {entry.name} <span style={{ fontWeight: 'bold' }}>{entry.value}건</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #eee', fontWeight: 'bold', color: '#333' }}>
                                        합계: {getTotalCount(collegeData)}건 (100%)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 5. Consultant (Full Width) */}
                        <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: '12px', padding: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>컨설턴트별 실적</h4>
                            <div style={{ height: '600px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={consultantData} layout="vertical" margin={{ left: 50, right: 30, top: 10, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} interval={0} />
                                        <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                        <Legend />
                                        <Bar dataKey="actual" name="실제 진행" stackId="a" fill={ACTUAL_COLOR}>
                                            <LabelList dataKey="actual" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                        <Bar dataKey="noShow" name="불참/노쇼" stackId="a" fill={NO_SHOW_COLOR} radius={[0, 4, 4, 0]}>
                                            <LabelList dataKey="noShow" position="right" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>


                </>
            ) : (
                <div className="chart-display-area" style={{ height: '700px', minHeight: '700px', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    {chartType === 'actual' ? (
                        <div style={{ height: '100%' }}>
                            <h4 style={{ textAlign: 'center', marginBottom: '10px', color: '#333' }}>실제 진행 및 불참/노쇼(컨설팅일자 기준)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={actualStatsData} margin={{ top: 40, right: 30, left: 20, bottom: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                    <Legend />
                                    <Bar dataKey="actual" name="실제 진행" stackId="a" fill={ACTUAL_COLOR}>
                                        <LabelList dataKey="actual" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                    <Bar dataKey="noShow" name="불참/노쇼" stackId="a" fill={NO_SHOW_COLOR} radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="noShow" position="top" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'monthly' && (
                                <BarChart data={statsData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                    <Legend />
                                    <Bar dataKey="count" name="신청 건수" fill={COLORS[0]} radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="count" position="top" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                </BarChart>
                            )}
                            {chartType === 'frequency' && (
                                <BarChart data={frequencyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                    <Legend />
                                    <Bar dataKey="count1" name="1회 이용" stackId="a" fill="#81C784">
                                        <LabelList dataKey="count1" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                    <Bar dataKey="count2" name="2회 이용" stackId="a" fill="#4CAF60">
                                        <LabelList dataKey="count2" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                    <Bar dataKey="count3" name="3회 이상" stackId="a" fill="#0D5F34" radius={[4, 4, 0, 0]}>
                                        <LabelList dataKey="count3" position="top" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                </BarChart>
                            )}
                            {chartType === 'college' && (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                                    <div style={{ flex: 1, height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={collegeData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={renderCustomizedLabel}
                                                    outerRadius={130}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {collegeData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ width: '280px', height: '95%', borderLeft: '1px solid #eee', paddingLeft: '20px', marginLeft: '10px' }}>
                                        <h5 style={{ marginBottom: '15px', paddingTop: '10px', color: '#333' }}>상세 데이터 목록</h5>
                                        {collegeData.map((entry, index) => {
                                            const total = getTotalCount(collegeData);
                                            const percent = total > 0 ? (entry.value / total * 100).toFixed(1) : 0;
                                            return (
                                                <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontSize: '0.9rem' }}>
                                                    <div style={{ width: '12px', height: '12px', backgroundColor: COLORS[index % COLORS.length], marginRight: '10px', borderRadius: '2px', flexShrink: 0 }}></div>
                                                    <div style={{ flex: 1, marginRight: '10px', wordBreak: 'keep-all' }}>{entry.name}</div>
                                                    <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>{entry.value}건 <span style={{ color: '#666', fontWeight: 'normal' }}>({percent}%)</span></div>
                                                </div>
                                            );
                                        })}
                                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>
                                            <div style={{ width: '18px', marginRight: '12px' }}></div>
                                            <div style={{ flex: 1 }}>총계</div>
                                            <div>{getTotalCount(collegeData)}건 (100%)</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {chartType === 'consultant' && (
                                <BarChart data={consultantData} layout="vertical" margin={{ left: 50, right: 30, top: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} interval={0} />
                                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                                    <Legend />
                                    <Bar dataKey="actual" name="실제 진행" stackId="a" fill={ACTUAL_COLOR}>
                                        <LabelList dataKey="actual" position="inside" fill="#fff" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                    <Bar dataKey="noShow" name="불참/노쇼" stackId="a" fill={NO_SHOW_COLOR} radius={[0, 4, 4, 0]}>
                                        <LabelList dataKey="noShow" position="right" fill="#333" fontSize={11} fontWeight="bold" formatter={(val) => val > 0 ? val : ''} />
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>
            )
            }

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button className="ewha-btn" onClick={handleDownloadImage}>
                    <Download size={16} />
                    이미지 다운로드
                </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '10px', color: '#666', fontSize: '0.9rem' }}>
                * 차트에 마우스를 올리면 상세 수치를 확인할 수 있습니다.
            </div>
        </div >
    );
};

export default EwhaChart;
