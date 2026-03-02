import { useState, useEffect, useRef } from 'react'
import { useAppData } from './hooks/useAppData'
import { AppLog } from './env'

function App(): React.JSX.Element {
  const {
    settings,
    profiles,
    guilds,
    discordStatus,
    loading,
    connectDiscord,
    disconnectDiscord,
    updateSettings
  } = useAppData()

  const [tokenInput, setTokenInput] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [logUrlInput, setLogUrlInput] = useState<string | null>(null)

  const [logs, setLogs] = useState<AppLog[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.api && window.api.onAppLog) {
      window.api.onAppLog((newLog: AppLog) => {
        setLogs((prev) => [...prev, newLog])
      })
    }
  }, [])

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  if (loading || !settings) {
    return <div className="app-content">Loading...</div>
  }

  const handleConnect = () => {
    updateSettings({ discordToken: tokenInput || settings.discordToken })
    connectDiscord(tokenInput || settings.discordToken || '')
  }

  const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newKeyword.trim() !== '') {
      // Split by comma in case user pastes multiple products at once
      const addedKeywords = newKeyword.split(',').map(k => k.trim()).filter(k => k !== '')
      if (addedKeywords.length > 0) {
        // Filter out duplicates if any
        const currentKeywords = settings.keywords || []
        const uniqueNew = addedKeywords.filter(k => !currentKeywords.includes(k))

        const updated = [...currentKeywords, ...uniqueNew]
        updateSettings({ keywords: updated })
      }
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (index: number) => {
    const updated = settings.keywords.filter((_, i) => i !== index)
    updateSettings({ keywords: updated })
  }

  const handleTestLink = async () => {
    if (settings.targetProfileIds && settings.targetProfileIds.length > 0) {
      await Promise.all(settings.targetProfileIds.map(async (profileId) => {
        await window.electron.ipcRenderer.invoke('open-url-in-chrome', 'https://google.com', profileId)
      }))
    }
  }

  return (
    <div id="root">
      <header className="app-header">
        <h1>Discord Link Opener</h1>
        <div className={`status-badge ${discordStatus === 'CONNECTED' ? 'status-connected' : 'status-disconnected'}`}>
          {discordStatus}
        </div>
      </header>

      <main className="app-content">

        {/* Discord Config */}
        <section className="card">
          <h2 className="card-title">1. Discord Connection</h2>

          <div className="form-group">
            <label>Auto-Token (Self-Bot)</label>
            <div className="flex-row">
              <input
                type="password"
                placeholder="Paste your Discord token here"
                defaultValue={settings.discordToken || ''}
                onChange={e => setTokenInput(e.target.value)}
              />
              {discordStatus === 'CONNECTED' ? (
                <button className="btn-danger" onClick={disconnectDiscord}>Disconnect</button>
              ) : (
                <button className="btn-primary" onClick={handleConnect}>Connect</button>
              )}
            </div>
          </div>

          {discordStatus === 'CONNECTED' && guilds.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Select Server</label>
                <select
                  value={settings.selectedGuildId || ''}
                  onChange={(e) => updateSettings({ selectedGuildId: e.target.value })}
                >
                  <option value="">-- Choose Server --</option>
                  {guilds.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select Channel to Listen</label>
                <div className="flex-row" style={{ alignItems: 'center' }}>
                  <select
                    value={settings.selectedChannelId || ''}
                    onChange={(e) => updateSettings({ selectedChannelId: e.target.value })}
                    disabled={!settings.selectedGuildId}
                  >
                    <option value="">-- Choose Channel --</option>
                    {guilds.find(g => g.id === settings.selectedGuildId)?.channels.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn-outline"
                    onClick={async () => await window.api.testReadLatestMessage()}
                    disabled={!settings.selectedChannelId}
                  >
                    Opening
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Keyword Filter */}
        <section className="card">
          <h2 className="card-title">2. Notification Keywords Filter</h2>
          <div className="form-group">
            <label>Add Keyword (Press Enter)</label>
            <input
              type="text"
              placeholder="e.g. KHAÄN_CẤP, ALERT"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={handleAddKeyword}
            />
            <div className="tag-container">
              {settings.keywords?.map((kw, i) => (
                <span key={i} className="tag">
                  {kw}
                  <span className="tag-remove" onClick={() => handleRemoveKeyword(i)}>x</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Chrome Config */}
        <section className="card">
          <h2 className="card-title">3. Destination Google Profiles</h2>
          <div className="form-group">
            <label>Select Chrome Profiles to open links concurrently</label>
            <div className="flex-row" style={{ alignItems: 'flex-start' }}>
              <div
                className="profile-checkbox-list"
                style={{
                  flex: 1,
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  padding: '0.8rem',
                  borderRadius: '4px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.8rem'
                }}
              >
                {profiles.map(p => {
                  const isSelected = (settings.targetProfileIds || []).includes(p.id);
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const currentIds = settings.targetProfileIds || [];
                          const currentNames = settings.targetProfileNames || [];

                          if (e.target.checked) {
                            updateSettings({
                              targetProfileIds: [...currentIds, p.id],
                              targetProfileNames: [...currentNames, p.name]
                            });
                          } else {
                            const idx = currentIds.indexOf(p.id);
                            if (idx > -1) {
                              const newIds = [...currentIds];
                              const newNames = [...currentNames];
                              newIds.splice(idx, 1);
                              newNames.splice(idx, 1);
                              updateSettings({
                                targetProfileIds: newIds,
                                targetProfileNames: newNames
                              });
                            }
                          }
                        }}
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
              <button
                className="btn-outline"
                onClick={handleTestLink}
                disabled={!(settings.targetProfileIds && settings.targetProfileIds.length > 0)}
              >
                Test Open Link
              </button>
            </div>
            {settings.targetProfileNames && settings.targetProfileNames.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-color)' }}>
                <strong>Selected:</strong> {settings.targetProfileNames.join(', ')}
              </div>
            )}
          </div>
        </section>

        {/* Webhook Logging */}
        <section className="card">
          <h2 className="card-title">4. Optional: Logging Webhook URL</h2>
          <div className="form-group">
            <label>Auto-send POST request when a link is opened (e.g. personal server API)</label>
            <div className="flex-row">
              <input
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={logUrlInput !== null ? logUrlInput : (settings.logServerUrl || '')}
                onChange={e => setLogUrlInput(e.target.value)}
              />
              <button
                className="btn-primary"
                onClick={() => {
                  updateSettings({ logServerUrl: logUrlInput !== null ? logUrlInput : settings.logServerUrl })
                  alert('Webhook URL đã được lưu!')
                }}
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* Real-time Logs */}
        <section className="card log-viewer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <h2 className="card-title" style={{ margin: 0, border: 'none', padding: 0 }}>System Logs</h2>
            <button className="btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setLogs([])}>Clear Logs</button>
          </div>
          <div className="log-container">
            {logs.length === 0 ? (
              <div className="log-empty">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-entry log-${log.type}`}>
                  <span className="log-time">[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </section>

      </main>
    </div>
  )
}

export default App
