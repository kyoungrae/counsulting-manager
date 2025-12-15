import { useState } from 'react'
import EwhaGrid from './components/EwhaGrid'
import Sidebar from './components/Sidebar'
import './App.css'

function App() {
  const [activeMenu, setActiveMenu] = useState('진로개발');

  return (
    <div className="app-container">
      <Sidebar activeMenu={activeMenu} onMenuClick={setActiveMenu} />
      <main className="main-content">
        <EwhaGrid title={activeMenu} />
      </main>
    </div>
  )
}

export default App
