import { useState } from 'react'
import { MainMenu } from '@/components/MainMenu'
import { Battle } from '@/components/Battle'
import { Online } from '@/components/Online'

export type Screen = 'menu' | 'local' | 'online'

export function App() {
  const [screen, setScreen] = useState<Screen>('menu')

  return (
    <div className="arena-bg min-h-screen">
      {screen === 'menu' && <MainMenu onStartLocal={() => setScreen('local')} onStartOnline={() => setScreen('online')} />}
      {screen === 'local' && <Battle mode="local" onExit={() => setScreen('menu')} />}
      {screen === 'online' && <Online onExit={() => setScreen('menu')} />}
    </div>
  )
}
