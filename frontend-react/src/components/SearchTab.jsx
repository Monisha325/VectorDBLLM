import { useRef, useEffect } from 'react'
import { COL, DIMS, DIM_COL } from '../utils'

export default function SearchTab({ latency, searchResults, queryEmb, benchData, hnswLayers, onDeleteItem, onHoverItem }) {
  const vecCvsRef = useRef(null)

  useEffect(() => {
    if (!queryEmb || !vecCvsRef.current) return
    const vc = vecCvsRef.current
    const W = vc.parentElement.clientWidth
    vc.width = W
    const vx = vc.getContext('2d')
    vx.clearRect(0, 0, W, 76)
    vx.fillStyle = '#07070f'; vx.fillRect(0, 0, W, 76)
    const bw = (W-4) / DIMS
    for (let i = 0; i < DIMS; i++) {
      const h = queryEmb[i]*58, x = 2+i*bw, col = DIM_COL[i]
      vx.shadowColor = col; vx.shadowBlur = 5
      vx.fillStyle = col+'aa'; vx.fillRect(x+1, 63-h, bw-2, h)
    }
    vx.shadowBlur = 0; vx.font = '8px monospace'; vx.textAlign = 'center'
    ;[['CS',0],['MATH',4],['FOOD',8],['SPORT',12]].forEach(([lbl, gi], i) => {
      vx.fillStyle = Object.values(COL)[i]+'77'
      vx.fillText(lbl, 2+(gi+1.5)*bw, 74)
    })
    vx.textAlign = 'left'
  }, [queryEmb])

  const maxBench = benchData ? Math.max(benchData.bruteforceUs, benchData.kdtreeUs, benchData.hnswUs, 1) : 1

  return (
    <>
      <div>
        <div className="sec">Search Latency</div>
        <div className="lat-big">{latency.big}</div>
        <div className="lat-sub">{latency.sub}</div>
      </div>

      <div>
        <div className="sec">Top Matches</div>
        <div className="results">
          {(!searchResults || !searchResults.length)
            ? <div style={{ color:'var(--muted)', fontSize:'11px' }}>Run a search to see results…</div>
            : searchResults.map((r, i) => {
                const col = COL[r.category] || COL.default
                return (
                  <div
                    key={r.id}
                    className="rcard"
                    onMouseEnter={() => onHoverItem({ id: r.id })}
                    onMouseLeave={() => onHoverItem(null)}
                  >
                    <div className="rrank">#{i+1} NEAREST</div>
                    <div className="rmeta">{r.metadata}</div>
                    <div className="rfoot">
                      <span className="rcat" style={{ background:`${col}18`, color:col, border:`1px solid ${col}44` }}>
                        {r.category.toUpperCase()}
                      </span>
                      <span className="rdist">dist: {r.distance.toFixed(5)}</span>
                      <button className="del" onClick={() => onDeleteItem(r.id)}>✕</button>
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>

      <div>
        <div className="sec">Query Embedding (16D)</div>
        <canvas ref={vecCvsRef} id="vecCvs" height="76"></canvas>
      </div>

      {benchData && (
        <div>
          <div className="sec">Algorithm Comparison</div>
          <div className="bench">
            {[
              { lbl:'Brute Force', us:benchData.bruteforceUs, col:'#f38ba8' },
              { lbl:'KD-Tree',     us:benchData.kdtreeUs,     col:'#89dceb' },
              { lbl:'HNSW',        us:benchData.hnswUs,        col:'#b388ff' },
            ].map(({ lbl, us, col }) => {
              const pct  = Math.max((us/maxBench)*100, 2)
              const disp = us < 1000 ? us+' μs' : (us/1000).toFixed(2)+' ms'
              return (
                <div key={lbl} className="brow">
                  <div className="blabel">
                    <span style={{ color:col }}>{lbl}</span>
                    <span style={{ color:'var(--muted)' }}>{disp}</span>
                  </div>
                  <div className="btrack">
                    <div className="bfill" style={{ width:`${pct}%`, background:col }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div className="sec">HNSW Graph Layers</div>
        <div className="layers">
          {(!hnswLayers || !hnswLayers.length)
            ? <div style={{ color:'var(--muted)', fontSize:'11px' }}>Loading…</div>
            : hnswLayers.map(({ cnt, lyr, edg, maxN }) => {
                const pct = Math.max((cnt/maxN)*100, 2)
                return (
                  <div key={lyr} className="lrow">
                    <div className="lnum">L{lyr}</div>
                    <div className="ltrack"><div className="lfill" style={{ width:`${pct}%` }}></div></div>
                    <div className="lcount">{cnt}n · {edg}e</div>
                  </div>
                )
              })
          }
        </div>
      </div>
    </>
  )
}
