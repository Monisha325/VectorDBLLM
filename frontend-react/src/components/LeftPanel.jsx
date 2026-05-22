import { useState } from 'react'

export default function LeftPanel({ onSearch, onBenchmark, onAddVector }) {
  const [queryText, setQueryText] = useState('')
  const [selAlgo, setSelAlgo] = useState('hnsw')
  const [metric, setMetric] = useState('cosine')
  const [k, setK] = useState(5)
  const [addMeta, setAddMeta] = useState('')
  const [addCat, setAddCat] = useState('cs')

  function handleSearch() {
    onSearch({ text: queryText, k, metric, algo: selAlgo })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSearch()
  }

  function handleAddVector() {
    if (!addMeta.trim()) return
    onAddVector({ meta: addMeta.trim(), cat: addCat })
    setAddMeta('')
  }

  return (
    <div className="left-panel">
      <div>
        <div className="sec">Query (Demo Vectors)</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          <input
            type="text"
            placeholder="binary tree, sushi, basketball…"
            value={queryText}
            onChange={e => setQueryText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn-p" onClick={handleSearch}>⚡ SEARCH</button>
        </div>
      </div>

      <div>
        <div className="sec">Algorithm</div>
        <div className="algo-row">
          {[['hnsw','HNSW'],['kdtree','KD-TREE'],['bruteforce','BRUTE']].map(([val,lbl]) => (
            <div
              key={val}
              className={`algo-btn${selAlgo === val ? ' on' : ''}`}
              onClick={() => setSelAlgo(val)}
            >{lbl}</div>
          ))}
        </div>
      </div>

      <div>
        <div className="sec">Distance Metric</div>
        <select value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="cosine">Cosine Similarity</option>
          <option value="euclidean">Euclidean Distance</option>
          <option value="manhattan">Manhattan Distance</option>
        </select>
      </div>

      <div>
        <div className="sec">Top-K: <span>{k}</span></div>
        <input
          type="range"
          min="1" max="10"
          value={k}
          onChange={e => setK(parseInt(e.target.value))}
        />
      </div>

      <div>
        <div className="sec">Category Legend</div>
        <div className="legend">
          <div className="leg-row"><div className="dot" style={{ background:'var(--cs)', boxShadow:'0 0 5px var(--cs)' }}></div>CS / Algorithms</div>
          <div className="leg-row"><div className="dot" style={{ background:'var(--math)', boxShadow:'0 0 5px var(--math)' }}></div>Mathematics</div>
          <div className="leg-row"><div className="dot" style={{ background:'var(--food)', boxShadow:'0 0 5px var(--food)' }}></div>Food &amp; Cooking</div>
          <div className="leg-row"><div className="dot" style={{ background:'var(--sports)', boxShadow:'0 0 5px var(--sports)' }}></div>Sports &amp; Games</div>
          <div className="leg-row"><div className="dot" style={{ background:'var(--green)', boxShadow:'0 0 5px var(--green)' }}></div>Documents (RAG)</div>
        </div>
      </div>

      <div>
        <div className="sec">Insert Demo Vector</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          <input
            type="text"
            placeholder="Description…"
            value={addMeta}
            onChange={e => setAddMeta(e.target.value)}
          />
          <select value={addCat} onChange={e => setAddCat(e.target.value)}>
            <option value="cs">CS / Algorithms</option>
            <option value="math">Mathematics</option>
            <option value="food">Food &amp; Cooking</option>
            <option value="sports">Sports &amp; Games</option>
          </select>
          <button className="btn-s" onClick={handleAddVector}>+ INSERT</button>
        </div>
      </div>

      <div>
        <div className="sec">Benchmark</div>
        <button className="btn-s" onClick={() => onBenchmark({ text: queryText, metric })}>▶ COMPARE ALL ALGOS</button>
      </div>
    </div>
  )
}
