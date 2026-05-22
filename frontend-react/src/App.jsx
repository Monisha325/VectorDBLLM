import { useState, useEffect, useCallback, useRef } from 'react'
import Header from './components/Header'
import LeftPanel from './components/LeftPanel'
import ScatterPlot from './components/ScatterPlot'
import SearchTab from './components/SearchTab'
import DocumentsTab from './components/DocumentsTab'
import AskAITab from './components/AskAITab'
import { DIMS, COL, textToEmbedding, pca2D } from './utils'

export default function App() {
  const [activeTab,     setActiveTab]     = useState('search')
  const [allItems,      setAllItems]      = useState([])
  const [pcaPoints,     setPcaPoints]     = useState([])
  const [bounds,        setBounds]        = useState({ minX:-1, maxX:1, minY:-1, maxY:1 })
  const [hitIds,        setHitIds]        = useState(new Set())
  const [queryPt,       setQueryPt]       = useState(null)
  const [hoverItem,     setHoverItem]     = useState(null)
  const [tooltip,       setTooltip]       = useState({ visible:false, x:0, y:0, item:null })
  const [statsLabel,    setStatsLabel]    = useState('loading…')
  const [ollamaBadge,   setOllamaBadge]   = useState({ cls:'badge', text:'OLLAMA…' })
  const [ollamaStatus,  setOllamaStatus]  = useState({ cls:'ollama-status', html:'Checking…' })
  const [searchResults, setSearchResults] = useState([])
  const [latency,       setLatency]       = useState({ big:'—', sub:'No query yet' })
  const [benchData,     setBenchData]     = useState(null)
  const [hnswLayers,    setHnswLayers]    = useState([])
  const [queryEmb,      setQueryEmb]      = useState(null)

  const pcaPointsRef = useRef([])
  useEffect(() => { pcaPointsRef.current = pcaPoints }, [pcaPoints])

  const loadItems = useCallback(async () => {
    try {
      const r = await fetch('/items')
      const items = await r.json()
      setAllItems(items)
      if (items.length >= 2) {
        const coords = pca2D(items.map(v => v.embedding))
        const pts = items.map((item, i) => ({ x: coords[i][0], y: coords[i][1], item }))
        setPcaPoints(pts)
        let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity
        for (const p of pts) { x0=Math.min(x0,p.x); x1=Math.max(x1,p.x); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y) }
        const px=(x1-x0)*.18||.1, py=(y1-y0)*.18||.1
        setBounds({ minX:x0-px, maxX:x1+px, minY:y0-py, maxY:y1+py })
      }
      setStatsLabel(items.length + ' vectors · ' + DIMS + ' dims')
    } catch(_) {}
  }, [])

  const loadHNSW = useCallback(async () => {
    try {
      const r = await fetch('/hnsw-info')
      const d = await r.json()
      const maxN = d.nodesPerLayer[0] || 1
      setHnswLayers(d.nodesPerLayer.map((cnt, lyr) => ({
        cnt, lyr, edg: d.edgesPerLayer[lyr] || 0, maxN
      })))
    } catch(_) {}
  }, [])

  const checkOllamaStatus = useCallback(async () => {
    try {
      const r = await fetch('/status')
      const d = await r.json()
      if (d.ollamaAvailable) {
        setOllamaBadge({ cls:'badge ok', text:'OLLAMA ✓' })
        setOllamaStatus({ cls:'ollama-status ok', html:
          `<span style="color:var(--green)">● Online</span><br>` +
          `Embed: <span style="color:var(--accent)">${d.embedModel}</span><br>` +
          `Generate: <span style="color:var(--accent)">${d.genModel}</span><br>` +
          `Dims: <span style="color:var(--muted)">${d.docDims||'(first insert sets this)'}</span><br>` +
          `Documents: <span style="color:var(--text)">${d.docCount}</span>`
        })
      } else {
        setOllamaBadge({ cls:'badge err', text:'OLLAMA ✗' })
        setOllamaStatus({ cls:'ollama-status err', html:
          `<span style="color:var(--red)">● Offline</span><br><br>` +
          `To enable RAG features:<br>` +
          `<span style="color:var(--muted)">1. Install from ollama.com<br>` +
          `2. ollama pull nomic-embed-text<br>` +
          `3. ollama pull llama3.2</span>`
        })
      }
    } catch(_) {}
  }, [])

  useEffect(() => {
    loadItems().then(() => loadHNSW())
    checkOllamaStatus()
  }, [loadItems, loadHNSW, checkOllamaStatus])

  const runSearch = useCallback(async ({ text, k, metric, algo }) => {
    if (!text) return
    const emb = textToEmbedding(text)
    try {
      const r = await fetch(`/search?v=${emb.join(',')}&k=${k}&metric=${metric}&algo=${algo}`)
      const data = await r.json()
      const results = data.results || []
      setSearchResults(results)
      setHitIds(new Set(results.map(r => r.id)))
      const us = data.latencyUs || 0
      setLatency({
        big: us < 1000 ? us+' μs' : (us/1000).toFixed(2)+' ms',
        sub: algo.toUpperCase() + '  ·  ' + metric + '  ·  k=' + k
      })
      if (results.length > 0) {
        const pts = pcaPointsRef.current
        let sx=0, sy=0, sw=0
        for (let i=0; i<Math.min(3,results.length); i++) {
          const pt = pts.find(p => p.item.id === results[i].id)
          if (pt) { const w=1/(i+1); sx+=pt.x*w; sy+=pt.y*w; sw+=w }
        }
        if (sw > 0) setQueryPt({ x: sx/sw+(Math.random()-.5)*.015, y: sy/sw+(Math.random()-.5)*.015 })
      }
      setQueryEmb(emb)
    } catch(_) { alert('Cannot reach server — is it running on :8080?') }
  }, [])

  const runBenchmark = useCallback(async ({ text, metric }) => {
    const emb = textToEmbedding(text || 'binary tree algorithm')
    try {
      const r = await fetch(`/benchmark?v=${emb.join(',')}&k=5&metric=${metric}`)
      const d = await r.json()
      setBenchData(d)
    } catch(_) {}
  }, [])

  const addVector = useCallback(async ({ meta, cat }) => {
    if (!meta) return
    const emb = textToEmbedding(meta + ' ' + cat)
    try {
      await fetch('/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: meta, category: cat, embedding: emb })
      })
      await loadItems()
      loadHNSW()
    } catch(_) {}
  }, [loadItems, loadHNSW])

  const deleteItem = useCallback(async (id) => {
    try {
      await fetch(`/delete/${id}`, { method: 'DELETE' })
      setSearchResults(prev => prev.filter(r => r.id !== id))
      setHitIds(prev => { const s = new Set(prev); s.delete(id); return s })
      await loadItems()
      loadHNSW()
    } catch(_) {}
  }, [loadItems, loadHNSW])

  const handleScatterUpdate = useCallback(({ hitIds: h, queryPt: q }) => {
    if (h !== undefined) setHitIds(h)
    if (q !== undefined) setQueryPt(q)
  }, [])

  return (
    <>
      <Header ollamaBadge={ollamaBadge} statsLabel={statsLabel} />
      <div className="layout">
        <LeftPanel onSearch={runSearch} onBenchmark={runBenchmark} onAddVector={addVector} />

        <div className="center-panel">
          <ScatterPlot
            pcaPoints={pcaPoints}
            bounds={bounds}
            hitIds={hitIds}
            queryPt={queryPt}
            hoverItem={hoverItem}
            onHoverChange={setHoverItem}
            onTooltipChange={setTooltip}
          />
        </div>

        <div className="right-panel">
          <div className="tabs">
            <div className={`tab${activeTab==='search'?' on':''}`} onClick={() => setActiveTab('search')}>SEARCH</div>
            <div className={`tab${activeTab==='docs'?' on':''}`}   onClick={() => setActiveTab('docs')}>DOCUMENTS</div>
            <div className={`tab${activeTab==='rag'?' on':''}`}     onClick={() => setActiveTab('rag')}>ASK AI</div>
          </div>

          <div className={`tab-content${activeTab==='search'?' on':''}`}>
            <SearchTab
              latency={latency}
              searchResults={searchResults}
              queryEmb={queryEmb}
              benchData={benchData}
              hnswLayers={hnswLayers}
              onDeleteItem={deleteItem}
              onHoverItem={setHoverItem}
            />
          </div>

          <div className={`tab-content${activeTab==='docs'?' on':''}`}>
            <DocumentsTab
              ollamaStatus={ollamaStatus}
              isActive={activeTab === 'docs'}
              onDocInserted={() => { loadItems().then(loadHNSW); checkOllamaStatus() }}
              onDocDeleted={checkOllamaStatus}
            />
          </div>

          <div className={`tab-content${activeTab==='rag'?' on':''}`}>
            <AskAITab
              pcaPoints={pcaPoints}
              onScatterUpdate={handleScatterUpdate}
            />
          </div>
        </div>
      </div>

      <div
        id="tip"
        style={{ display: tooltip.visible ? 'block' : 'none', left: tooltip.x+'px', top: tooltip.y+'px' }}
      >
        {tooltip.item && (
          <>
            <span style={{ color: COL[tooltip.item.category] || COL.default }}>[{tooltip.item.category}]</span>
            <br />{tooltip.item.metadata}
          </>
        )}
      </div>
    </>
  )
}
