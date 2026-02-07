import { useState, useEffect } from 'react'
import axios from 'axios'

function Relationships() {
  const [guilds, setGuilds] = useState([])
  const [selectedGuild, setSelectedGuild] = useState('')
  const [relationships, setRelationships] = useState({})
  const [loading, setLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editData, setEditData] = useState(null)

  useEffect(() => {
    fetchGuilds()
  }, [])

  useEffect(() => {
    if (selectedGuild) {
      fetchRelationships(selectedGuild)
    }
  }, [selectedGuild])

  const fetchGuilds = async () => {
    try {
      const res = await axios.get('/api/guilds')
      setGuilds(res.data)
      if (res.data.length > 0) setSelectedGuild(res.data[0])
    } catch (err) {
      console.error('Failed to fetch guilds', err)
    }
  }

  const fetchRelationships = async (guildId) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/guilds/${guildId}/relationships`)
      setRelationships(res.data)
    } catch (err) {
      console.error('Failed to fetch relationships', err)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (userId, data) => {
    setEditingUser(userId)
    setEditData({ ...data })
  }

  const handleSave = async () => {
    try {
      await axios.post(`/api/guilds/${selectedGuild}/relationships/${editingUser}`, editData)
      fetchRelationships(selectedGuild)
      setEditingUser(null)
    } catch (err) {
      console.error('Failed to save relationship', err)
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
        <h2 className="text-xl font-semibold text-indigo-400">User Relationships</h2>
        <select 
          value={selectedGuild} 
          onChange={(e) => setSelectedGuild(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded px-3 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          {guilds.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 animate-pulse">Loading relationships...</div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Attitude</th>
                <th className="px-6 py-4 font-medium">Behaviors</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {Object.entries(relationships).map(([userId, data]) => (
                <tr key={userId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-200">{data.displayName || userId}</div>
                    <div className="text-xs text-slate-500 font-mono">{data.username || userId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20">
                      {data.attitude}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-400 max-w-xs truncate">
                      {data.behavior.join(', ') || 'None'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => startEdit(userId, data)}
                      className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal (Simple Overlay) */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Edit Relationship</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Attitude</label>
                <input
                  type="text"
                  value={editData.attitude}
                  onChange={(e) => setEditData({ ...editData, attitude: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Behaviors (comma separated)</label>
                <textarea
                  value={editData.behavior.join(', ')}
                  onChange={(e) => setEditData({ ...editData, behavior: e.target.value.split(',').map(s => s.trim()) })}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-950/50 flex justify-end space-x-3">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Relationships
