import { CATEGORIES } from "../lib/engine.js";

// Weakness map: radar of recency-weighted strength per category (outer = strong). n = 0 means "no data yet".
export default function Radar({ map }) {
  const keys = Object.keys(CATEGORIES);
  const cx = 130, cy = 120, R = 84;
  const ang = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / keys.length;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  const poly = keys.map((k, i) => pt(i, (map[k].strength ?? 0) / 100).join(",")).join(" ");
  const any = keys.some((k) => map[k].n);
  return (
    <svg viewBox="0 0 260 245" className="radar" role="img" aria-label="Weakness map radar chart">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={keys.map((_, i) => pt(i, r).join(",")).join(" ")} className="radar-grid" />
      ))}
      {keys.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} className="radar-grid" />)}
      {any && <polygon points={poly} className="radar-shape" />}
      {keys.map((k, i) => {
        const [x, y] = pt(i, map[k].strength == null ? 0 : map[k].strength / 100);
        const [lx, ly] = pt(i, 1.28);
        return (
          <g key={k}>
            {map[k].n > 0 && <circle cx={x} cy={y} r="4" className="radar-dot" />}
            <text x={lx} y={ly} textAnchor="middle" className="radar-label">{CATEGORIES[k].label.replace("Sentence construction", "Construction")}</text>
            <text x={lx} y={ly + 12} textAnchor="middle" className="radar-val">{map[k].strength == null ? "no data" : `${map[k].strength}%`}</text>
          </g>
        );
      })}
    </svg>
  );
}
