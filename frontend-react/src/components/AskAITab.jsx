import { useState, useRef, useEffect } from 'react'
import { textToEmbedding } from '../utils'

export default function AskAITab({ pcaPoints, onScatterUpdate }) {
  const [question, setQuestion]   = useState('')
  const [ragK, setRagK]           = useState(3)
  const [busy, setBusy]           = useState(false)
  const [chatItems, setChatItems] = useState([])
  const historyRef = useRef(null)
  const pcaRef     = useRef(pcaPoints)

  useEffect(() => { pcaRef.current = pcaPoints }, [pcaPoints])

  function scrollToBottom() {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && e.ctrlKey) askAI()
  }

  async function askAI() {
    const q = question.trim()
    if (!q) return
    setBusy(true)
    setQuestion('')

    const thinkId = Date.now()
    setChatItems([
      { type: 'q', id: thinkId + '_q', text: q },
      { type: 'thinking', id: thinkId }
    ])
    setTimeout(scrollToBottom, 0)

    fetch('/doc/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, k: ragK })
    })
    .then(res => res.json())
    .then(data => {
      const pts = pcaRef.current
      if (data.contexts && data.contexts.length > 0) {
        const newHits = new Set()
        let sx=0, sy=0, sw=0
        data.contexts.forEach((ctx, i) => {
          const pt = pts.find(p => p.item.category === 'doc' && ctx.title.startsWith(p.item.metadata))
          if (pt) {
            newHits.add(pt.item.id)
            const w = 1/(i+1); sx += pt.x*w; sy += pt.y*w; sw += w
          }
        })
        onScatterUpdate({
          hitIds: newHits,
          queryPt: sw > 0 ? { x: sx/sw+(Math.random()-.5)*.015, y: sy/sw+(Math.random()-.5)*.015 } : null
        })
      } else {
        onScatterUpdate({ hitIds: new Set(), queryPt: null })
        const emb16 = textToEmbedding(q)
        fetch(`/search?v=${emb16.join(',')}&k=3&metric=cosine&algo=hnsw`)
          .then(res2 => res2.json())
          .then(data2 => {
            if (data2.results && data2.results.length > 0) {
              let sx=0, sy=0, sw=0
              for (let i=0; i<Math.min(3,data2.results.length); i++) {
                const pt = pts.find(p => p.item.id === data2.results[i].id)
                if (pt) { const w=1/(i+1); sx+=pt.x*w; sy+=pt.y*w; sw+=w }
              }
              if (sw > 0) onScatterUpdate({ hitIds: new Set(), queryPt: { x: sx/sw+(Math.random()-.5)*.015, y: sy/sw+(Math.random()-.5)*.015 } })
            }
          }).catch(() => {})
      }
    }).catch(() => {})

    try {
      const r = await fetch('/doc/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, k: ragK })
      })
      const d = await r.json()

      if (d.error) {
        setChatItems(prev => [
          ...prev.filter(c => c.id !== thinkId),
          { type: 'error', id: thinkId + '_a', text: d.error }
        ])
      } else {
        const ansId = thinkId + '_a'
        setChatItems(prev => [
          ...prev.filter(c => c.id !== thinkId),
          { type: 'answer', id: ansId, model: d.model||'llm', text: '', fullText: d.answer, contexts: d.contexts, ctxOpen: {} }
        ])
        let i = 0
        const full = d.answer
        const timer = setInterval(() => {
          if (i >= full.length) { clearInterval(timer); return }
          const chunk = full.slice(i, i+3); i += 3
          setChatItems(prev => prev.map(c =>
            c.id === ansId ? { ...c, text: c.text + chunk, typing: i < full.length } : c
          ))
          setTimeout(scrollToBottom, 0)
        }, 18)
      }
    } catch(_) {
      setChatItems(prev => [
        ...prev.filter(c => c.id !== thinkId),
        { type: 'error', id: thinkId + '_a', text: 'Server error — is the backend running?' }
      ])
    }

    setBusy(false)
    setTimeout(scrollToBottom, 0)
  }

  function toggleCtx(chatId, ctxIdx) {
    setChatItems(prev => prev.map(c =>
      c.id === chatId ? { ...c, ctxOpen: { ...c.ctxOpen, [ctxIdx]: !c.ctxOpen?.[ctxIdx] } } : c
    ))
  }

  return (
    <>
      <div>
        <div className="sec">Ask a Question</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <textarea
            rows="3"
            placeholder={"What is dynamic programming?\nExplain the main idea of HNSW.\nHow does the recipe differ from…"}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div style={{ display:'flex', gap:'6px' }}>
            <select style={{ width:'auto', flexShrink:0 }} value={ragK} onChange={e => setRagK(parseInt(e.target.value))}>
              <option value={2}>Top 2</option>
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
            </select>
            <button className="btn-g" disabled={busy} onClick={askAI} style={{ flex:1 }}>
              {busy ? 'Thinking…' : '🤖 ASK AI'}
            </button>
          </div>
          <div style={{ fontSize:'10px', color:'var(--muted)' }}>
            Uses your inserted documents as context. Answers come from the local LLM.
          </div>
        </div>
      </div>

      <div>
        <div className="sec">Conversation</div>
        <div className="chat-history" ref={historyRef}>
          {chatItems.length === 0 && (
            <div style={{ color:'var(--muted)', fontSize:'11px' }}>Ask a question about your inserted documents…</div>
          )}
          {chatItems.map(item => {
            if (item.type === 'q') return (
              <div key={item.id} className="chat-q">{item.text}</div>
            )
            if (item.type === 'thinking') return (
              <div key={item.id} className="thinking">
                <div className="spinner"></div>Retrieving context &amp; generating answer…
              </div>
            )
            if (item.type === 'error') return (
              <div key={item.id} className="chat-a">
                <div className="chat-a-label">ERROR</div>
                <div className="chat-a-text" style={{ color:'var(--red)' }}>{item.text}</div>
              </div>
            )
            if (item.type === 'answer') return (
              <div key={item.id} className="chat-a">
                <div className="chat-a-label">🤖 {item.model}</div>
                <div className={`chat-a-text${item.typing ? ' typing' : ''}`}>{item.text}</div>
                <div className="chat-ctx">
                  <div className="chat-ctx-label">RETRIEVED CONTEXT ({item.contexts.length} chunks)</div>
                  {item.contexts.map((c, ci) => (
                    <span key={ci}>
                      <span className="ctx-chip" onClick={() => toggleCtx(item.id, ci)}>
                        #{ci+1} {c.title} · {c.distance.toFixed(3)}
                      </span>
                      <div className="ctx-expand" style={{ display: item.ctxOpen?.[ci] ? 'block' : 'none' }}>
                        {c.text}
                      </div>
                    </span>
                  ))}
                </div>
              </div>
            )
            return null
          })}
        </div>
      </div>
    </>
  )
}
