import { useState } from 'react'
import EwhaGrid from './components/EwhaGrid'
import Sidebar from './components/Sidebar'
import SatisfactionMatch from './components/SatisfactionMatch'

function AppMain() {
  const [activeMenu, setActiveMenu] = useState('진로개발')

  return (
    <div className="app-container">
      <Sidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />
      <main className="main-content">
        {activeMenu === '만족도 일치여부' ? (
          <SatisfactionMatch />
        ) : (
          <EwhaGrid title={activeMenu} />
        )}
      </main>
    </div>
  )
}

export default AppMain
