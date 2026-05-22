import { useState, useEffect } from 'react'
import { textToEmbedding } from '../utils'

export default function DocumentsTab({ ollamaStatus, isActive, onDocInserted, onDocDeleted }) {
  const [docTitle, setDocTitle]         = useState('')
  const [docText, setDocText]           = useState('')
  const [inserting, setInserting]       = useState(false)
  const [insertStatus, setInsertStatus] = useState('')
  const [docs, setDocs]                 = useState([])

  useEffect(() => {
    if (isActive) loadDocList()
  }, [isActive])

  async function loadDocList() {
    try {
      const r = await fetch('/doc/list')
      const data = await r.json()
      setDocs(data)
    } catch(_) {}
  }

  async function insertDocument() {
    const title = docTitle.trim(), text = docText.trim()
    if (!title || !text) { setInsertStatus('⚠ Need both a title and text.'); return }

    setInserting(true)
    setInsertStatus('<span style="color:var(--muted)">Calling Ollama nomic-embed-text…</span>')

    try {
      const r = await fetch('/doc/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text })
      })
      const d = await r.json()
      if (d.error) {
        setInsertStatus(`<span style="color:var(--red)">✗ ${d.error}</span>`)
      } else {
        setInsertStatus(`<span style="color:var(--green)">✓ Inserted ${d.chunks} chunk(s) · ${d.dims}D embeddings</span>`)
        setDocTitle('')
        setDocText('')
        const emb16 = textToEmbedding(title + ' ' + text)
        fetch('/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: title, category: 'doc', embedding: emb16 })
        }).then(() => onDocInserted()).catch(() => {})
        loadDocList()
      }
    } catch(_) {
      setInsertStatus('<span style="color:var(--red)">✗ Server error</span>')
    }
    setInserting(false)
  }

  async function deleteDoc(id) {
    try {
      await fetch(`/doc/delete/${id}`, { method: 'DELETE' })
      loadDocList()
      onDocDeleted()
    } catch(_) {}
  }

  return (
    <>
      <div>
        <div className="sec">Ollama Status</div>
        <div className={ollamaStatus.cls} dangerouslySetInnerHTML={{ __html: ollamaStatus.html }} />
      </div>

      <div>
        <div className="sec">Insert Document</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <input
            type="text"
            placeholder="Document title / topic…"
            value={docTitle}
            onChange={e => setDocTitle(e.target.value)}
          />
          <textarea
            placeholder={"Paste your notes, textbook excerpt, lecture content…\n\nLong text is automatically split into overlapping chunks and each chunk gets its own real embedding via Ollama's nomic-embed-text model."}
            value={docText}
            onChange={e => setDocText(e.target.value)}
          />
          <button className="btn-g" disabled={inserting} onClick={insertDocument}>
            {inserting ? 'Embedding…' : '⚡ EMBED & INSERT'}
          </button>
          <div style={{ fontSize:'11px', color:'var(--muted)' }} dangerouslySetInnerHTML={{ __html: insertStatus }} />
        </div>
      </div>

      <div>
        <div className="sec">Stored Documents (<span>{docs.length}</span>)</div>
        <div className="doc-list">
          {docs.length === 0
            ? <div style={{ color:'var(--muted)', fontSize:'11px' }}>No documents yet. Insert some above.</div>
            : docs.map(d => (
                <div key={d.id} className="dcard">
                  <div className="dcard-title">{d.title}</div>
                  <div className="dcard-preview">{d.preview}</div>
                  <div className="dcard-foot">
                    <span className="dcard-words">{d.words} words</span>
                    <button className="del" onClick={() => deleteDoc(d.id)}>✕</button>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </>
  )
}
