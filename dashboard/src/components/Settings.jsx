import { useState, useEffect } from 'react'
import axios from 'axios'

function Settings() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/config')
      setConfig(res.data)
    } catch (err) {
      console.error('Failed to fetch config', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await axios.post('/api/config', config)
      setMessage('Settings saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      console.error('Failed to save config', err)
      setMessage('Error saving settings.')
    } finally {
      setSaving(false)
    }
  }

  const updateBotField = (field, value) => {
    setConfig({
      ...config,
      bot: {
        ...config.bot,
        [field]: value
      }
    })
  }

  const updateReplyField = (field, value) => {
    setConfig({
      ...config,
      replyBehavior: {
        ...config.replyBehavior,
        [field]: value
      }
    })
  }

  const handleArrayChange = (section, field, index, value) => {
    const newArray = [...config[section][field]]
    newArray[index] = value
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: newArray
      }
    })
  }

  const addArrayItem = (section, field) => {
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: [...config[section][field], '']
      }
    })
  }

  const removeArrayItem = (section, field, index) => {
    const newArray = config[section][field].filter((_, i) => i !== index)
    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: newArray
      }
    })
  }

  if (loading) return <div className="text-slate-500">Loading configuration...</div>
  if (!config) return <div className="text-red-500">Error loading configuration.</div>

  return (
    <div className="w-full max-w-4xl space-y-8 pb-12">
      {/* Bot Persona */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
        <h2 className="text-xl font-semibold mb-6 border-b border-slate-800 pb-2 text-indigo-400 flex items-center">
          <span className="mr-2">👤</span> Bot Persona
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                value={config.bot.name}
                onChange={(e) => updateBotField('name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
              <input
                type="text"
                value={config.bot.username}
                onChange={(e) => updateBotField('username', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea
                value={config.bot.description}
                onChange={(e) => updateBotField('description', e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Speaking Style</label>
              <div className="space-y-2">
                {config.bot.speakingStyle.map((style, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      value={style}
                      onChange={(e) => handleArrayChange('bot', 'speakingStyle', index, e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button onClick={() => removeArrayItem('bot', 'speakingStyle', index)} className="text-red-400 hover:text-red-300 px-2">×</button>
                  </div>
                ))}
                <button onClick={() => addArrayItem('bot', 'speakingStyle')} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">+ Add Style</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reply Behavior */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
        <h2 className="text-xl font-semibold mb-6 border-b border-slate-800 pb-2 text-indigo-400 flex items-center">
          <span className="mr-2">🤖</span> Reply Behavior
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Mode</label>
            <select
              value={config.replyBehavior.mode}
              onChange={(e) => updateReplyField('mode', e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="mention-only">Mention Only</option>
              <option value="active">Active</option>
              <option value="passive">Passive</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Reply Probability</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={config.replyBehavior.replyProbability}
              onChange={(e) => updateReplyField('replyProbability', parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.replyBehavior.requireMention}
                onChange={(e) => updateReplyField('requireMention', e.target.checked)}
                className="w-4 h-4 bg-slate-950 border-slate-700 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm font-medium text-slate-400">Require Mention</span>
            </label>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className="sticky bottom-8 bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-8 py-2.5 rounded-xl font-bold transition-all transform active:scale-95 ${
              saving ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
          {message && (
            <span className={`text-sm font-medium animate-in fade-in slide-in-from-left-2 ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </span>
          )}
        </div>
        <button 
          onClick={fetchConfig}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Discard Changes
        </button>
      </div>
    </div>
  )
}

export default Settings
