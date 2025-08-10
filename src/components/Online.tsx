import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { Battle } from './Battle'

let socket: Socket | null = null

export function Online({ onExit }: { onExit: () => void }) {
  const [roomId, setRoomId] = useState('')
  const [connected, setConnected] = useState(false)
  const [playerIndex, setPlayerIndex] = useState<0 | 1>(0)
  const [playersCount, setPlayersCount] = useState(1)

  function ensureSocket() {
    if (!socket) socket = io()
    return socket
  }

  function wirePlayerEvents(s: Socket) {
    s.off('player_joined')
    s.on('player_joined', (players: string[]) => {
      setPlayersCount(players.length)
      const myId = s.id ?? ''
      const idx = players.indexOf(myId)
      if (idx === 0 || idx === 1) setPlayerIndex(idx as 0 | 1)
    })
  }

  function createRoom() {
    const s = ensureSocket()
    wirePlayerEvents(s)
    const id = Math.random().toString(36).slice(2, 7)
    s.emit('create_room', id)
    setRoomId(id)
    setConnected(true)
  }

  function joinRoom() {
    if (!roomId) return
    const s = ensureSocket()
    wirePlayerEvents(s)
    s.emit('join_room', roomId)
    setConnected(true)
  }

  if (connected) return <Battle mode="online" roomId={roomId} playerIndex={playerIndex} onExit={onExit} />

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <input className="text-black px-2 py-1 rounded" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        <button className="px-4 py-2 bg-emerald-600 rounded" onClick={joinRoom}>Join</button>
        <button className="px-4 py-2 bg-blue-600 rounded" onClick={createRoom}>Create</button>
        <button className="px-4 py-2 bg-zinc-700 rounded" onClick={onExit}>Back</button>
      </div>
  <p className="opacity-70 text-sm">Start the server with npm run server, then use the same room ID on two devices.</p>
    </div>
  )
}
