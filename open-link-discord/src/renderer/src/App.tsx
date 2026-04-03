import { useState, useEffect, useRef, useMemo } from 'react'
import { useAppData } from './hooks/useAppData'
import type { AppLog } from './env'
import './assets/main.css'

/* Custom UI Icons for a Synchronized Feel */
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
)

const FallbackIcon = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#ff3131" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3" fill="#ff3131" opacity="0.6"/>
  </svg>
)

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

  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [logs, setLogs] = useState<AppLog[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [iconError, setIconError] = useState(false)

  // System State
  const [tokenInput, setTokenInput] = useState('')
  const [webhookInput, setWebhookInput] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [newBlacklistKeyword, setNewBlacklistKeyword] = useState('')
  const [profileSearch, setProfileSearch] = useState('')
  const [linkSearch, setLinkSearch] = useState('')
  const [newLinkProduct, setNewLinkProduct] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [isAddingLink, setIsAddingLink] = useState(false)

  // Timer State
  const [timerInput, setTimerInput] = useState<string>('300')
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null)
  const timerIntervalRef = useRef<any>(null)
  const hasAutoStartedRef = useRef(false)

  // 7net Zaiko State
  const [zaikoUrl, setZaikoUrl] = useState('')
  const [zaikoEmail, setZaikoEmail] = useState('')
  const [zaikoPassword, setZaikoPassword] = useState('')
  const [zaikoCookie, setZaikoCookie] = useState('')
  const [zaikoDiscord, setZaikoDiscord] = useState('')
  const [isZaikoMonitoring, setIsZaikoMonitoring] = useState(false)

  // Initial Sync from settings
  useEffect(() => {
    if (settings && !loading) {
      setWebhookInput(prev => prev || settings.logServerUrl || '')
      setTokenInput(prev => prev || settings.discordToken || '')
      // Sync 7net config only if local state is empty to prevent overwriting active typing
      setZaikoUrl(prev => prev || settings.zaikoUrl || '')
      setZaikoEmail(prev => prev || settings.zaikoEmail || '')
      setZaikoPassword(prev => prev || settings.zaikoPassword || '')
      setZaikoCookie(prev => prev || settings.zaikoCookie || '')
      setZaikoDiscord(prev => prev || settings.zaikoDiscord || '')
    }
  }, [loading]) // Only sync once on load

  // IPC Listeners for 7net
  useEffect(() => {
    const handleLog = (_event: any, msg: string) => addLocalLog(msg, msg.includes('✅') || msg.includes('🎉') ? 'success' : msg.includes('❌') ? 'error' : 'info')
    const handleStatus = (_event: any, status: string) => setIsZaikoMonitoring(status === 'running')
    const handleCookie = (_event: any, cookie: string) => {
      setZaikoCookie(cookie)
      updateSettings({ zaikoCookie: cookie })
    }

    if (window.api.onLogMessage) window.api.onLogMessage(handleLog)
    if (window.api.onStatusChange) window.api.onStatusChange(handleStatus)
    if (window.api.onCookieUpdated) window.api.onCookieUpdated(handleCookie)
  }, [])

  const filteredProfiles = useMemo(() => {
    if (!profiles) return []
    return profiles.filter(p => 
      p.name.toLowerCase().includes(profileSearch.toLowerCase()) || 
      p.id.toLowerCase().includes(profileSearch.toLowerCase())
    )
  }, [profiles, profileSearch])

  const filteredLinks = useMemo(() => {
    if (!settings?.testLinks) return []
    return settings.testLinks.filter(l => 
      l.product.toLowerCase().includes(linkSearch.toLowerCase()) || 
      l.url.toLowerCase().includes(linkSearch.toLowerCase())
    )
  }, [settings?.testLinks, linkSearch])

  const addLocalLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toISOString(), message, type }].slice(-100))
  }

  // Latest logs stay at the top naturally by removing automatic bottom-alignment scrolling.

  useEffect(() => {
    if (!loading && settings && !hasAutoStartedRef.current) {
      const minutes = parseFloat(timerInput || '300')
      if (!isNaN(minutes) && minutes > 0) {
        handleStartTimer(minutes)
        hasAutoStartedRef.current = true
      }
    }
  }, [loading, settings])

  useEffect(() => {
    if (timerRemaining !== null && timerRemaining <= 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      window.api.closeApp()
    }
  }, [timerRemaining])

  const handleConnect = () => {
    if (!settings) return
    const token = tokenInput.trim() || settings.discordToken
    if (!token) {
      addLocalLog('FAILED: Please enter an Access Token.', 'error')
      return
    }
    updateSettings({ discordToken: token })
    connectDiscord(token)
    addLocalLog(`INITIATING_CONNECTION: ${token.substring(0, 8)}***`, 'info')
  }

  const handleDisconnect = () => {
    disconnectDiscord()
    addLocalLog('SHUTDOWN: Uchiha Neural Link Terminated.', 'info')
  }

  const handleStartTimer = (customMinutes?: number) => {
    const minutes = customMinutes ?? parseFloat(timerInput)
    if (isNaN(minutes) || minutes <= 0) return
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    const totalSeconds = Math.floor(minutes * 60)
    setTimerRemaining(totalSeconds)
    timerIntervalRef.current = setInterval(() => {
      setTimerRemaining(prev => prev !== null ? prev - 1 : null)
    }, 1000)
    addLocalLog(`TIMER_ARMED: Purge set to ${minutes}m.`, 'success')
  }

  const handleAddKeyword = () => {
    if (!settings || !newKeyword.trim()) return
    const added = newKeyword.split(',').map(k => k.trim()).filter(k => k !== '')
    const updated = Array.from(new Set([...(settings.keywords || []), ...added]))
    updateSettings({ keywords: updated })
    setNewKeyword('')
    addLocalLog(`WHITELIST_UPDATED: Added ${added.length} object(s).`, 'success')
  }

  const handleAddBlacklist = () => {
    if (!settings || !newBlacklistKeyword.trim()) return
    const added = newBlacklistKeyword.split(',').map(k => k.trim()).filter(k => k !== '')
    const updated = Array.from(new Set([...(settings.blacklistKeywords || []), ...added]))
    updateSettings({ blacklistKeywords: updated })
    setNewBlacklistKeyword('')
    addLocalLog(`BLACKLIST_UPDATED: Blocked ${added.length} object(s).`, 'error')
  }

  const handleAddTestLink = () => {
    if (!settings || !newLinkProduct || !newLinkUrl) return
    updateSettings({ testLinks: [...(settings.testLinks || []), { product: newLinkProduct, url: newLinkUrl }] })
    setNewLinkProduct('')
    setNewLinkUrl('')
    setIsAddingLink(false)
    addLocalLog(`TEMPLATE_REGISTERED: ${newLinkProduct.toUpperCase()}`, 'success')
  }

  const handlePlayLink = async (url: string, product: string) => {
    if (!settings) return
    const selectedIds = settings.targetProfileIds || []
    if (selectedIds.length === 0) {
      addLocalLog('ERROR: No active nodes selected.', 'error')
      return
    }
    addLocalLog(`INJECTING_RESOURCE: ${product.toUpperCase()}...`, 'info')
    try {
      const results = await Promise.all(selectedIds.map(pId => window.api.openUrlInChrome(url, pId)))
      addLocalLog(`INJECTION_COMPLETE: ${results.filter(r => r.success).length}/${selectedIds.length} successful.`, 'success')
    } catch (err: any) {
      addLocalLog(`SYSTEM_FAILURE: ${err.message}`, 'error')
    }
  }

  // 7net Handlers
  const handleSaveZaikoConfig = () => {
    updateSettings({
      zaikoUrl, zaikoEmail, zaikoPassword, zaikoCookie, zaikoDiscord
    })
    addLocalLog('7NET_ARCHIVE_SECURED: Config updated.', 'success')
  }

  const handleStartZaikoManual = () => {
    if (!zaikoUrl) return addLocalLog('ERROR: 7net URL Required.', 'error')
    handleSaveZaikoConfig()
    window.api.startMonitoring({ url: zaikoUrl, email: zaikoEmail, password: zaikoPassword, cookie: zaikoCookie, discord: zaikoDiscord })
    setIsZaikoMonitoring(true)
    addLocalLog('7NET_ANALYSIS_ACTIVE: Initiating stock scan...', 'info')
  }

  const handleStopZaikoManual = () => {
    window.api.stopMonitoring()
    setIsZaikoMonitoring(false)
    addLocalLog('7NET_OPERATION_HALTED: User manual stop.', 'info')
  }

  const handleZaikoLogin = async () => {
    addLocalLog('7NET_LOGIN_WINDOW_OPENED: Intercepting session...', 'info')
    const result = await window.api.login7net({ email: zaikoEmail, password: zaikoPassword })
    if (result.success) {
      const cookie = result.cookie || ''
      setZaikoCookie(cookie)
      updateSettings({ zaikoCookie: cookie })
      addLocalLog('7NET_SESSION_CAPTURED: User identity verified.', 'success')
    } else {
      addLocalLog(`7NET_LOGIN_ABORTED: ${result.error}`, 'error')
    }
  }

  if (loading || !settings) return (
    <div className="app-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: 'var(--primary)', letterSpacing: '4px', fontWeight: '800' }}>[ SYNCHRONIZING_UCHIHA_ARCHIVE ]</div>
    </div>
  )

  const SidebarItem = ({ id, label, icon }: { id: string, label: string, icon: string }) => (
    <div className={`sidebar-item ${activeScreen === id ? 'active' : ''}`} onClick={() => setActiveScreen(id)}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <span>{label}</span>
      {activeScreen === id && <div className="active-indicator" />}
    </div>
  )

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {!iconError ? (
            <img 
              src="/app_icon.png?v=2" 
              width="45" height="45" 
              style={{ borderRadius: '12px', boxShadow: '0 0 15px rgba(255, 49, 49, 0.4)' }} 
              onError={() => setIconError(true)}
              alt="Uchiha" 
            />
          ) : <FallbackIcon />}
          <h1>UCHIHA.<span style={{ color: '#fff' }}>ARC</span></h1>
        </div>
        <nav className="sidebar-nav">
          <SidebarItem id="dashboard" label="DASHBOARD" icon="⌘" />
          <SidebarItem id="keywords" label="IDENTIFIERS" icon="⌥" />
          <SidebarItem id="profiles" label="SYSTEM_OP" icon="⚡" />
          <SidebarItem id="7net" label="7NET_ZAIKO" icon="◈" />
        </nav>
        
        {/* SHUTDOWN Section at the Bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--outline-variant)' }}>
             <button 
                className="btn btn-danger" 
                onClick={() => window.api.closeApp()} 
                style={{ width: '100%', height: '54px', borderRadius: '16px', background: 'linear-gradient(135deg, #ff3131, #b91c1c) !important', color: '#fff !important' }}
             >
                SHUTDOWN_NOW
             </button>
        </div>
      </aside>

      <main className="main-content">
        {activeScreen === 'dashboard' && (
          <div className="screen-fade-in">
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">:: Neural Link</span>
                <span className="stat-value" style={{ color: discordStatus === 'CONNECTED' ? '#4ade80' : 'var(--primary)' }}>
                  {discordStatus === 'CONNECTED' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">:: Active Node</span>
                <span className="stat-value">{settings.selectedGuildId ? guilds?.find(g => g.id === settings.selectedGuildId)?.name.toUpperCase() : 'NONE'}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">:: Purge Timer</span>
                <span className="stat-value" style={{ color: timerRemaining !== null && timerRemaining < 60 ? 'var(--primary)' : '#fff' }}>
                  {timerRemaining !== null ? `${Math.floor(timerRemaining / 60)}m ${timerRemaining % 60}s` : '-- : --'}
                </span>
              </div>
            </div>

            <div className="editorial-grid">
              <div className="card">
                <h2>[ Authentication ]</h2>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', width: '100%' }}>
                  <input 
                    type="password" 
                    value={tokenInput} 
                    onChange={e => setTokenInput(e.target.value)} 
                    placeholder="ENTER_ACCESS_TOKEN" 
                    style={{ flex: 1 }}
                    onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  />
                  <button 
                    className={`btn ${discordStatus === 'CONNECTED' ? 'btn-danger' : 'btn-primary'}`} 
                    onClick={discordStatus === 'CONNECTED' ? handleDisconnect : handleConnect}
                    style={{ minWidth: '160px' }}
                  >
                    {discordStatus === 'CONNECTED' ? 'TERMINATE' : 'INITIALIZE'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <select value={settings.selectedGuildId || ''} onChange={e => updateSettings({ selectedGuildId: e.target.value })}>
                    <option value="">SCAN_SERVERS</option>
                    {guilds?.map(g => <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>)}
                  </select>
                  <select value={settings.selectedChannelId || ''} onChange={e => updateSettings({ selectedChannelId: e.target.value })}>
                    <option value="">SELECT_ALL_STREAMS</option>
                    {guilds?.find(g => g.id === settings.selectedGuildId)?.channels.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <span className="label-style">:: System Auto-Purge (Minutes)</span>
                    <input type="number" value={timerInput} onChange={e => setTimerInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStartTimer()} />
                  </div>
                  <button className="btn btn-outline" onClick={() => handleStartTimer()} style={{ height: '54px', minWidth: '160px' }}>RESET_TIMER</button>
                </div>
              </div>
              <div className="card">
                <h2>[ Master Stream Logic ]</h2>
                <div className="log-container">
                  {[...logs].reverse().map((l, i) => (
                    <div key={i} className="log-entry">
                      <span className="log-time">{new Date(l.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className={l.type === 'error' ? 'log-error' : l.type === 'success' ? 'log-success' : 'log-info'}>{l.message.toUpperCase()}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeScreen === '7net' && (
          <div className="screen-fade-in editorial-grid">
            <div className="card">
              <h2>[ 7net Resource Configuration ]</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <span className="label-style">:: Production Target URL</span>
                  <input value={zaikoUrl} onChange={e => setZaikoUrl(e.target.value)} placeholder="https://7net.omni7.jp/detail/..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <span className="label-style">:: Account Email</span>
                    <input value={zaikoEmail} onChange={e => setZaikoEmail(e.target.value)} placeholder="uchihasharingan@gmail.com" />
                  </div>
                  <div>
                    <span className="label-style">:: Password</span>
                    <input type="password" value={zaikoPassword} onChange={e => setZaikoPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                <div>
                  <span className="label-style">:: Active Session Cookie</span>
                  <input value={zaikoCookie} onChange={e => setZaikoCookie(e.target.value)} placeholder="CAPTURED_DATA_SESSION..." />
                </div>
                <div>
                  <span className="label-style">:: Alert Webhook</span>
                  <input value={zaikoDiscord} onChange={e => setZaikoDiscord(e.target.value)} placeholder="DISCORD_WEBHOOK_URL" />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleZaikoLogin}>INITIALIZE_AUTH</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveZaikoConfig}>SECURE_ARCHIVE</button>
                </div>
              </div>
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>[ 7net Operation Terminal ]</h2>
                <button 
                  className={`btn ${isZaikoMonitoring ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={isZaikoMonitoring ? handleStopZaikoManual : handleStartZaikoManual}
                >
                  {isZaikoMonitoring ? 'ABORT_SCAN' : 'START_MONITORING'}
                </button>
              </div>
              <div className="log-container">
                  {[...logs].reverse().map((l, i) => (
                    <div key={i} className="log-entry">
                      <span className="log-time">{new Date(l.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className={l.type === 'error' ? 'log-error' : l.type === 'success' ? 'log-success' : 'log-info'}>{l.message.toUpperCase()}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {activeScreen === 'keywords' && (
          <div className="screen-fade-in editorial-grid">
            <div className="card">
              <h2>[ Whitelist Identifiers ]</h2>
              <input 
                value={newKeyword} 
                onChange={e => setNewKeyword(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddKeyword()} 
                placeholder="+ INPUT_SEQUENCES_TO_FOLLOW..." 
                style={{ width: '100%' }}
              />
              <div className="tag-container">
                {settings.keywords?.map((k, i) => (
                  <div key={i} className="tag tag-whitelist">{k.toUpperCase()} <span className="tag-remove" onClick={() => updateSettings({ keywords: settings.keywords.filter((_, idx) => idx !== i) })}>✕</span></div>
                ))}
              </div>
            </div>
            <div className="card">
              <h2>[ Forbidden Sequences ]</h2>
              <input 
                value={newBlacklistKeyword} 
                onChange={e => setNewBlacklistKeyword(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddBlacklist()} 
                placeholder="+ INPUT_SEQUENCES_TO_BLOCK..." 
                style={{ width: '100%' }}
              />
              <div className="tag-container">
                {settings.blacklistKeywords?.map((k, i) => (
                  <div key={i} className="tag tag-blacklist">{k.toUpperCase()} <span className="tag-remove" onClick={() => updateSettings({ blacklistKeywords: settings.blacklistKeywords.filter((_, idx) => idx !== i) })}>✕</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeScreen === 'profiles' && (
          <div className="screen-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
              <h1 style={{ color: 'var(--primary)', letterSpacing: '2px' }}>UCHIHA_SYSTEM_CONTROL</h1>
              <div className="search-bar" style={{ width: '400px' }}><input placeholder="SEARCH_RESOURCE_NODES..." value={profileSearch} onChange={e => setProfileSearch(e.target.value)} /></div>
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>[ Deployment Nodes ]</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-outline" style={{ padding: '0.6rem 1.25rem', fontSize: '0.7rem' }} onClick={() => updateSettings({ targetProfileIds: profiles.map(p => p.id) })}>ACTIVATE_ALL</button>
                  <button className="btn btn-outline" style={{ padding: '0.6rem 1.25rem', fontSize: '0.7rem' }} onClick={() => updateSettings({ targetProfileIds: [] })}>SILENCE_ALL</button>
                </div>
              </div>
              <div className="profile-selection-grid">
                {filteredProfiles.map(p => {
                   const isSelected = settings.targetProfileIds?.includes(p.id)
                   return (
                    <div key={p.id} className={`profile-card ${isSelected ? 'selected' : ''}`} onClick={() => updateSettings({ targetProfileIds: isSelected ? settings.targetProfileIds.filter(id => id !== p.id) : [...(settings.targetProfileIds || []), p.id] })}>
                      <div className="profile-avatar">
                        {!iconError ? (
                          <img src="/app_icon.png?v=2" width="36" height="36" style={{ borderRadius: '8px' }} onError={() => setIconError(true)} alt="Node" />
                        ) : <FallbackIcon />}
                      </div>
                      <div className="profile-info">
                        <div className="profile-name">{p.name || `PROFILE_${p.id}`}</div>
                        <div className="profile-id">NODE_ID: {p.id}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card" style={{ marginTop: '3rem' }}>
              <h2>[ Link Deployment Templates ]</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div className="search-bar" style={{ width: '320px', height: '48px' }}>
                  <input placeholder="FILTER_LOG..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} />
                </div>
              </div>
              <div className="links-table-container">
                <table className="links-table">
                  <thead><tr><th>PRODUCT_RESOURCE</th><th>SOURCE_URI</th><th style={{ textAlign: 'right' }}>OPERATIONS</th></tr></thead>
                  <tbody>
                    {filteredLinks.map((link, idx) => (
                      <tr key={idx} className="link-row">
                        <td style={{ fontWeight: 800 }}>{link.product.toUpperCase()}</td>
                        <td style={{ opacity: 0.4, fontSize: '0.8rem' }}>{link.url}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="action-btn" onClick={() => handlePlayLink(link.url, link.product)}><PlayIcon /></button>
                            <button className="action-btn delete" onClick={() => updateSettings({ testLinks: settings.testLinks.filter(l => l.url !== link.url) })}><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '2rem', borderTop: '1px solid var(--outline-variant)' }}>
                  {isAddingLink ? (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <input placeholder="NAME" value={newLinkProduct} onChange={e => setNewLinkProduct(e.target.value)} />
                      <input placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                      <button className="btn btn-primary" onClick={handleAddTestLink}>DEPLOY</button>
                      <button className="btn btn-outline" onClick={() => setIsAddingLink(false)}>ABORT</button>
                    </div>
                  ) : <button className="btn btn-outline" style={{ width: '100%', borderStyle: 'dashed' }} onClick={() => setIsAddingLink(true)}>[ + REGISTER_NEW_OBJECT ]</button>}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: '3rem' }}>
              <h2>[ Notification Webhook ]</h2>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input value={webhookInput} onChange={e => setWebhookInput(e.target.value)} placeholder="WEBHOOK_URL" style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={() => updateSettings({ logServerUrl: webhookInput })}>SECURE</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
