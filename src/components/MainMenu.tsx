type Props = {
  onStartLocal: () => void
  onStartOnline: () => void
}

export function MainMenu({ onStartLocal, onStartOnline }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-wider">Robot Battle</h1>
      <p className="opacity-80">Streetfighter-inspired robot duel</p>
      <div className="flex gap-4">
        <button className="px-6 py-3 rounded bg-blue-600 hover:bg-blue-500" onClick={onStartLocal}>Local Versus</button>
        <button className="px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-500" onClick={onStartOnline}>Online</button>
      </div>
      <p className="text-sm opacity-70">Controls: P1 WASD + F/G/H (light/medium/special), P2 Arrows + 1/2/3</p>
    </div>
  )
}
