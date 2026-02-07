import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

function Logs() {
  const [logs, setLogs] = useState([])
  const scrollRef = useRef(null)

  useEffect(() => {
    const socket = io()

    socket.on('logs:init', (initialLogs) => {
      setLogs(initialLogs.filter(l => l.trim()))
    })

    socket.on('log', (line) => {
      setLogs(prev => [...prev.slice(-99), line])
    })

    return () => socket.disconnect()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const getLevelColor = (line) => {
    if (line.includes('[ERROR]')) return 'text-red-400'
    if (line.includes('[WARN]')) return 'text-yellow-400'
    if (line.includes('[API]')) return 'text-indigo-400'
    if (line.includes('[MESSAGE]')) return 'text-green-400'
    return 'text-slate-300'
  }

  return (
    <div className="w-full max-w-5xl space-y-4">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h2 className="text-xl font-semibold text-indigo-400">System Logs</h2>
        <button 
          onClick={() => setLogs([])}
          className="text-xs text-slate-500 hover:text-slate-300 uppercase font-bold tracking-wider"
        >
          Clear View
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-[600px] overflow-y-auto font-mono text-sm shadow-inner"
      >
        {logs.length === 0 ? (
          <div className="text-slate-700 italic">Waiting for logs...</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={`${getLevelColor(log)} break-all`}>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Logs
