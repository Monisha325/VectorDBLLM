export default function Header({ ollamaBadge, statsLabel }) {
  return (
    <header>
      <h1>VectorDBLLM</h1>
      <span className="badge hl">HNSW</span>
      <span className="badge">KD-TREE</span>
      <span className="badge">BRUTE FORCE</span>
      <span className={ollamaBadge.cls}>{ollamaBadge.text}</span>
      <span id="statsLabel">{statsLabel}</span>
    </header>
  )
}
