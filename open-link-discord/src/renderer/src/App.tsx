import { useState, useEffect, useRef } from 'react'
import { useAppData } from './hooks/useAppData'
import type { AppLog } from './env'

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
  const [newBlacklistKeyword, setNewBlacklistKeyword] = useState('')
  const [logUrlInput, setLogUrlInput] = useState<string | null>(null)

  const [newTestLinkProduct, setNewTestLinkProduct] = useState('')
  const [newTestLinkUrl, setNewTestLinkUrl] = useState('')
  const [selectedTestLinks, setSelectedTestLinks] = useState<number[]>([])

  const [logs, setLogs] = useState<AppLog[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  const [timerInput, setTimerInput] = useState<string>('')
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)
  const timerIntervalRef = useRef<any>(null)

  // Opened Profiles State
  const [openedProfiles, setOpenedProfiles] = useState<any[]>([])

  useEffect(() => {
    let cleanupAppLog: (() => void) | undefined;
    let cleanupProfileOpened: (() => void) | undefined;

    if (window.api && window.api.onAppLog) {
      cleanupAppLog = window.api.onAppLog((newLog: AppLog) => {
        setLogs((prev) => [...prev, newLog])
      })
    }
    if (window.api && window.api.onProfileOpened) {
      cleanupProfileOpened = window.api.onProfileOpened((info: any) => {
        setOpenedProfiles(prev => {
          // Prevent duplicates if same windowId comes in
          if (prev.find(p => p.windowId === info.windowId)) return prev;
          return [...prev, info];
        });
      });
    }

    return () => {
      if (cleanupAppLog) cleanupAppLog();
      if (cleanupProfileOpened) cleanupProfileOpened();
    };
  }, [])

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Timer Effects
  useEffect(() => {
    if (timerRemaining !== null && timerRemaining <= 0) {
      // Timer finished, close app
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      window.api.closeApp()
    }
  }, [timerRemaining])

  const handleCloseProfileWindow = async (windowId: number) => {
    if (window.api && window.api.closeChromeWindow) {
      try {
        const success = await window.api.closeChromeWindow(windowId);
        if (success) {
          setOpenedProfiles(prev => prev.filter(p => p.windowId !== windowId));
        } else {
          alert(`Failed to close window ${windowId} (success=false)`);
        }
      } catch (e: any) {
        alert("IPC error: " + e.message);
      }
    } else {
      alert('window.api.closeChromeWindow not found');
    }
  };

  const handleCloseAllProfiles = async () => {
    if (window.api && window.api.closeAllChromeWindows) {
      const windowIds = openedProfiles.map(p => p.windowId);
      const success = await window.api.closeAllChromeWindows(windowIds);
      if (success) {
        setOpenedProfiles([]);
      }
    }
  };

  if (loading || !settings) {
    return <div className="app-content">Loading...</div>
  }

  const handleConnect = () => {
    updateSettings({ discordToken: tokenInput || settings.discordToken })
    connectDiscord(tokenInput || settings.discordToken || '')
  }

  const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newKeyword.trim() !== '') {
      const addedKeywords = newKeyword.split(',').map(k => k.trim()).filter(k => k !== '')
      if (addedKeywords.length > 0) {
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

  const handleAddBlacklistKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newBlacklistKeyword.trim() !== '') {
      const addedKeywords = newBlacklistKeyword.split(',').map(k => k.trim()).filter(k => k !== '')
      if (addedKeywords.length > 0) {
        const currentKeywords = settings.blacklistKeywords || []
        const uniqueNew = addedKeywords.filter(k => !currentKeywords.includes(k))
        const updated = [...currentKeywords, ...uniqueNew]
        updateSettings({ blacklistKeywords: updated })
      }
      setNewBlacklistKeyword('')
    }
  }

  const handleRemoveBlacklistKeyword = (index: number) => {
    const updated = (settings.blacklistKeywords || []).filter((_, i) => i !== index)
    updateSettings({ blacklistKeywords: updated })
  }

  const handleTestLink = async () => {
    const urlsToOpen = selectedTestLinks.map(idx => (settings.testLinks || [])[idx]?.url).filter(Boolean)
    const finalUrls = urlsToOpen.length > 0 ? urlsToOpen : ['https://google.com']

    if (settings.targetProfileIds && settings.targetProfileIds.length > 0) {
      const screenW = window.screen.availWidth || window.innerWidth
      const screenH = window.screen.availHeight || window.innerHeight
      const total = settings.targetProfileIds.length
      const windowWidth = Math.floor(screenW / total)

      for (let index = 0; index < settings.targetProfileIds.length; index++) {
        const profileId = settings.targetProfileIds[index];
        const bounds = total > 1 ? {
          x: index * windowWidth,
          y: 0,
          width: windowWidth,
          height: screenH
        } : undefined

        for (const url of finalUrls) {
          const result = await window.electron.ipcRenderer.invoke('open-url-in-chrome', url, profileId, bounds)
          if (result && result.success && result.windowId) {
            const profileName = (settings.targetProfileNames?.[index]) || profileId;
            setOpenedProfiles(prev => {
              const info = {
                url,
                profileId,
                profileName,
                windowId: result.windowId,
                timestamp: Date.now()
              }
              if (prev.find(p => p.windowId === info.windowId)) return prev;
              return [...prev, info];
            });
          }
        }
      }
    }
  }

  const handleAddTestLink = () => {
    if (newTestLinkProduct.trim() && newTestLinkUrl.trim()) {
      const updated = [...(settings.testLinks || []), { product: newTestLinkProduct.trim(), url: newTestLinkUrl.trim() }]
      updateSettings({ testLinks: updated })
      setNewTestLinkProduct('')
      setNewTestLinkUrl('')
    }
  }

  const handleRemoveTestLink = (index: number) => {
    const updated = (settings.testLinks || []).filter((_, i) => i !== index)
    updateSettings({ testLinks: updated })
    setSelectedTestLinks(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i))
  }

  const handleToggleTestLink = (index: number) => {
    setSelectedTestLinks(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }



  const handleStartTimer = () => {
    const minutes = parseFloat(timerInput)
    if (isNaN(minutes) || minutes <= 0) return

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setTimerRemaining(Math.floor(minutes * 60))

    timerIntervalRef.current = setInterval(() => {
      setTimerRemaining(prev => prev !== null ? prev - 1 : null)
    }, 1000)
  }

  const handleCancelTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setTimerRemaining(null)
  }

  const handleCloseNow = () => {
    window.api.closeApp()
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">2. Notification Keywords Filter (Whitelist)</h2>
            <div className="form-group">
              <label>Add Keyword (Press Enter)</label>
              <input
                type="text"
                placeholder="e.g. BUY, ALERT"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={handleAddKeyword}
              />
              <div className="tag-container">
                {settings.keywords?.map((kw, i) => (
                  <span key={i} className="tag tag-whitelist">
                    {kw}
                    <span className="tag-remove" onClick={() => handleRemoveKeyword(i)}>x</span>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="card-title">2.1. Blocked Keywords (Blacklist)</h2>
            <div className="form-group">
              <label>Add Keyword (Press Enter)</label>
              <input
                type="text"
                placeholder="e.g. SKIP, TEST"
                value={newBlacklistKeyword}
                onChange={e => setNewBlacklistKeyword(e.target.value)}
                onKeyDown={handleAddBlacklistKeyword}
              />
              <div className="tag-container">
                {(settings.blacklistKeywords || []).map((kw, i) => (
                  <span key={i} className="tag tag-blacklist" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger)' }}>
                    {kw}
                    <span className="tag-remove" onClick={() => handleRemoveBlacklistKeyword(i)}>x</span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Chrome Config */}
        <section className="card">
          <h2 className="card-title">3. Destination Google Profiles</h2>
          <div className="form-group">
            <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
              <label style={{ margin: 0 }}>Select Chrome Profiles to open links concurrently</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-outline"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    updateSettings({
                      targetProfileIds: profiles.map(p => p.id),
                      targetProfileNames: profiles.map(p => p.name)
                    })
                  }}
                >
                  Select All
                </button>
                <button
                  className="btn-outline"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    updateSettings({
                      targetProfileIds: [],
                      targetProfileNames: []
                    })
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>
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
            </div>
            {settings.targetProfileNames && settings.targetProfileNames.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-color)' }}>
                <strong>Selected:</strong> {settings.targetProfileNames.join(', ')}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.8rem' }}>Test Links Management</h3>

            <div className="flex-row" style={{ marginBottom: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Product Name"
                value={newTestLinkProduct}
                onChange={e => setNewTestLinkProduct(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Product Link (https://...)"
                value={newTestLinkUrl}
                onChange={e => setNewTestLinkUrl(e.target.value)}
                style={{ flex: 2 }}
                onKeyDown={e => e.key === 'Enter' && handleAddTestLink()}
              />
              <button className="btn-primary" onClick={handleAddTestLink}>Save Link</button>
            </div>

            {settings.testLinks && settings.testLinks.length > 0 && (
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.5rem',
                marginBottom: '1rem',
                backgroundColor: 'var(--bg-card)'
              }}>
                {(settings.testLinks || []).map((link, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.8rem 0.5rem',
                    borderBottom: idx === settings.testLinks.length - 1 ? 'none' : '1px solid var(--border-color)',
                  }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      flex: 1,
                      minWidth: 0,
                      margin: 0,
                    }}>
                      <div style={{ width: '40px', display: 'flex', justifyContent: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={selectedTestLinks.includes(idx)}
                          onChange={() => handleToggleTestLink(idx)}
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', flex: 1, overflow: 'hidden', paddingRight: '1rem' }}>
                        <strong style={{ whiteSpace: 'nowrap', fontSize: '0.95rem', color: 'var(--text-color)' }}>
                          {link.product || 'Link'}
                        </strong>
                        <span style={{ color: 'var(--text-color)', fontSize: '0.85rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          ({link.url})
                        </span>
                      </div>
                    </label>
                    <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                      <button
                        className="btn-danger"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', width: '100%' }}
                        onClick={() => handleRemoveTestLink(idx)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn-outline"
              onClick={handleTestLink}
              disabled={!(settings.targetProfileIds && settings.targetProfileIds.length > 0)}
              style={{ width: '100%', padding: '0.75rem' }}
            >
              {selectedTestLinks.length > 0 ? `Test Selected Links (${selectedTestLinks.length})` : 'Test Open Link (Fallback to Google)'}
            </button>
          </div>
        </section>

        {/* Webhook Logging & Timer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">4. Optional: Logging Webhook URL</h2>
            <div className="form-group">
              <label>Auto-send POST request when a link is opened</label>
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

          <section className="card">
            <h2 className="card-title">5. Auto-Shutdown Timer</h2>
            <div className="form-group">
              <label>Set Timer (minutes)</label>
              <div className="flex-row" style={{ alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="e.g. 60"
                  value={timerInput}
                  onChange={e => setTimerInput(e.target.value)}
                  disabled={timerRemaining !== null}
                />
                {timerRemaining === null ? (
                  <button className="btn-primary" onClick={handleStartTimer} disabled={!timerInput}>
                    Start Timer
                  </button>
                ) : (
                  <button className="btn-outline" onClick={handleCancelTimer}>
                    Cancel ({formatTimer(timerRemaining)})
                  </button>
                )}
                <button className="btn-danger" onClick={handleCloseNow}>
                  Close Now
                </button>
              </div>
            </div>
          </section>
        </div>

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

        {/* Floating Opened Profiles UI */}
        {openedProfiles.length > 0 && (
          <div className="floating-profiles-container">
            <div className="floating-profiles-header">
              <span>Opened Profiles ({openedProfiles.length})</span>
              <button className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={handleCloseAllProfiles}>
                Close All
              </button>
            </div>
            <div className="floating-profiles-list">
              {openedProfiles.map((p, idx) => (
                <div key={`${p.windowId}-${idx}`} className="floating-profile-item">
                  <div className="floating-profile-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="10" r="3"></circle>
                      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"></path>
                    </svg>
                  </div>
                  <div className="floating-profile-info">
                    <div className="floating-profile-name">{p.profileName}</div>
                    <div className="floating-profile-time">{new Date(p.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <button className="floating-profile-close" onClick={() => handleCloseProfileWindow(p.windowId)}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default App
