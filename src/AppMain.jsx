import { useState } from 'react'
import EwhaGrid from './components/EwhaGrid'
import Sidebar from './components/Sidebar'
import SatisfactionMatch from './components/SatisfactionMatch'
import ResultReportBuilder from './components/ResultReportBuilder'
import DataExtractionView from './components/DataExtractionView'

function AppMain() {
  const [activeMenu, setActiveMenu] = useState('진로개발')

  return (
    <div className="app-container">
      <Sidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />
      <main className="main-content">
        {activeMenu === '만족도 일치여부' ? (
          <SatisfactionMatch />
        ) : activeMenu === '결과 보고서용 데이터 추출' ? (
          <DataExtractionView />
        ) : activeMenu === '결과 보고서 작성' ? (
          <ResultReportBuilder />
        ) : (
          <EwhaGrid title={activeMenu} />
        )}
      </main>
    </div>
  )
}

export default AppMain
