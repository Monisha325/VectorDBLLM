import { useRef, useEffect } from 'react'
import { COL } from '../utils'

export default function ScatterPlot({ pcaPoints, bounds, hitIds, queryPt, hoverItem, onHoverChange, onTooltipChange }) {
  const canvasRef  = useRef(null)
  const pcaRef     = useRef(pcaPoints)
  const boundsRef  = useRef(bounds)
  const hitIdsRef  = useRef(hitIds)
  const queryPtRef = useRef(queryPt)
  const hovRef     = useRef(hoverItem)
  const pulseRef   = useRef(0)

  useEffect(() => { pcaRef.current     = pcaPoints }, [pcaPoints])
  useEffect(() => { boundsRef.current  = bounds    }, [bounds])
  useEffect(() => { hitIdsRef.current  = hitIds    }, [hitIds])
  useEffect(() => { queryPtRef.current = queryPt   }, [queryPt])
  useEffect(() => { hovRef.current     = hoverItem  }, [hoverItem])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let rafId

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect()
      canvas.width  = r.width  || 400
      canvas.height = r.height || 400
    }

    function w2c(wx, wy) {
      const b = boundsRef.current
      const P = 70, W = canvas.width, H = canvas.height
      const rx = b.maxX - b.minX || 1, ry = b.maxY - b.minY || 1
      return [P + ((wx - b.minX) / rx) * (W - 2*P), H - P - ((wy - b.minY) / ry) * (H - 2*P)]
    }

    function drawFrame() {
      const pts   = pcaRef.current
      const hits  = hitIdsRef.current
      const qp    = queryPtRef.current
      const hov   = hovRef.current
      const pulse = pulseRef.current

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#0e0e1e'; ctx.lineWidth = 1
      for (let i = 0; i <= 8; i++) {
        const tx = 70 + (i/8)*(canvas.width-140), ty = 70 + (i/8)*(canvas.height-140)
        ctx.beginPath(); ctx.moveTo(tx, 70); ctx.lineTo(tx, canvas.height-70); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(70, ty); ctx.lineTo(canvas.width-70, ty); ctx.stroke()
      }
      ctx.fillStyle = '#1a1a38'; ctx.font = '11px Fira Code,monospace'
      ctx.fillText('PC₁ →', canvas.width/2-40, canvas.height-18)
      ctx.save(); ctx.translate(18, canvas.height/2+50); ctx.rotate(-Math.PI/2); ctx.fillText('PC₂ →', 0, 0); ctx.restore()
      ctx.fillStyle = '#151530'; ctx.font = '12px Fira Code,monospace'
      ctx.fillText('2D PCA Projection  ·  Semantic Space', 80, 28)

      if (qp && hits.size > 0) {
        const [qx, qy] = w2c(qp.x, qp.y)
        for (const pt of pts) {
          if (!hits.has(pt.item.id)) continue
          const [px, py] = w2c(pt.x, pt.y)
          ctx.strokeStyle = 'rgba(108,99,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke()
          ctx.setLineDash([])
        }
      }

      for (const pt of pts) {
        const [cx, cy] = w2c(pt.x, pt.y)
        const col = COL[pt.item.category] || COL.default
        const isHit = hits.has(pt.item.id), r = isHit ? 10 : 7
        if (isHit) {
          const pr = r + 7 + Math.sin(pulse)*3.5
          ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 2*Math.PI)
          ctx.strokeStyle = col+'55'; ctx.lineWidth = 1.5; ctx.stroke()
        }
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r*3)
        grd.addColorStop(0, col + (isHit ? 'bb' : '88')); grd.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(cx, cy, r*3, 0, 2*Math.PI); ctx.fillStyle = grd; ctx.fill()
        ctx.beginPath(); ctx.arc(cx, cy, r,   0, 2*Math.PI); ctx.fillStyle = col; ctx.fill()
        if (hov && hov.id === pt.item.id) {
          ctx.beginPath(); ctx.arc(cx, cy, r+5, 0, 2*Math.PI); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke()
        }
      }

      if (qp) {
        const [qx, qy] = w2c(qp.x, qp.y)
        ctx.save(); ctx.translate(qx, qy)
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 18
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i*Math.PI/5) - Math.PI/2, rr = i%2===0 ? 13 : 5
          if (i === 0) ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr)
          else ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr)
        }
        ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill()
        ctx.shadowBlur = 0; ctx.restore()
        ctx.fillStyle = '#aaaacc'; ctx.font = '10px Fira Code,monospace'
        ctx.fillText('query', qx+16, qy+4)
      }

      if (!pts.length) {
        ctx.fillStyle = '#1a1a38'; ctx.font = '13px Fira Code,monospace'; ctx.textAlign = 'center'
        ctx.fillText('Connecting to VectorDB…', canvas.width/2, canvas.height/2); ctx.textAlign = 'left'
      }

      pulseRef.current += 0.05
      rafId = requestAnimationFrame(drawFrame)
    }

    resize()
    window.addEventListener('resize', resize)
    drawFrame()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafId)
    }
  }, [])

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    const b = boundsRef.current
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const P = 70, W = canvas.width, H = canvas.height
    const rx = b.maxX - b.minX || 1, ry = b.maxY - b.minY || 1

    function w2c(wx, wy) {
      return [P + ((wx-b.minX)/rx)*(W-2*P), H-P-((wy-b.minY)/ry)*(H-2*P)]
    }

    let found = null, best = 18
    for (const pt of pcaRef.current) {
      const [cx, cy] = w2c(pt.x, pt.y)
      const d = Math.hypot(mx-cx, my-cy)
      if (d < best) { best = d; found = pt.item }
    }

    onHoverChange(found)
    if (found) {
      onTooltipChange({ visible: true, x: e.clientX+14, y: e.clientY-8, item: found })
    } else {
      onTooltipChange({ visible: false, x: 0, y: 0, item: null })
    }
  }

  function handleMouseLeave() {
    onHoverChange(null)
    onTooltipChange({ visible: false, x: 0, y: 0, item: null })
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display:'block', width:'100%', height:'100%' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  )
}
