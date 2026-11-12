import { useState } from 'react'
import EwhaGrid from './components/EwhaGrid'
import Sidebar from './components/Sidebar'
import SatisfactionMatch from './components/SatisfactionMatch'
import ResultReportBuilder from './components/ResultReportBuilder'
import DataExtractionView from './components/DataExtractionView'
import ewhaCdcLogo from './assets/ewha-cdc-logo.png'

function AppMain() {
  const [activeMenu, setActiveMenu] = useState('진로개발')

  return (
    <div className="app-container">
      <Sidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />
      <main className="main-content">
        <div className="main-content-body">
          {activeMenu === '만족도 일치여부' ? (
            <SatisfactionMatch />
          ) : activeMenu === '결과보고서' ? (
            <DataExtractionView />
          ) : activeMenu === '결과 보고서 작성' ? (
            <ResultReportBuilder />
          ) : (
            <EwhaGrid title={activeMenu} />
          )}
        </div>
        <footer className="app-brand-footer">
          <img
            src={ewhaCdcLogo}
            alt="이화여자대학교 인재개발원 EWHA CAREER DEVELOPMENT CENTER"
            className="app-brand-footer-logo"
          />
        </footer>
      </main>
    </div>
  )
}

export default AppMain
