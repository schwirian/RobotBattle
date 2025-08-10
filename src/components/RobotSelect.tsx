import { defaultRobots } from '@/game/core'

export function RobotSelect({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {defaultRobots.map(r => (
        <button key={r.id} onClick={() => onSelect(r.id)} className="p-3 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-600">
          <div className="text-lg font-semibold" style={{ color: r.color }}>{r.name}</div>
          <div className="text-xs opacity-70">Special ready at 50 power</div>
        </button>
      ))}
    </div>
  )
}
