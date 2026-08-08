// The signature element of the app: a match score reads like a radar/
// instrument dial, not a generic progress bar. Color-coded by band
// (green >= 75, amber 50-74, red < 50) with tick marks like a real gauge.
const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
// Gauge sweeps 270 degrees (like a real analog dial), starting at -225deg.
const SWEEP_DEG = 270;
const START_DEG = -225;

function bandFor(score) {
  if (score >= 75) return { color: 'var(--band-strong)', label: 'Strong signal' };
  if (score >= 50) return { color: 'var(--band-mid)', label: 'Partial signal' };
  return { color: 'var(--band-weak)', label: 'Weak signal' };
}

export default function ScoreGauge({ score, size = SIZE, label }) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const band = bandFor(clamped);
  const sweepLen = (clamped / 100) * SWEEP_DEG;
  const dashArray = `${(sweepLen / 360) * CIRC} ${CIRC}`;
  const trackDashArray = `${(SWEEP_DEG / 360) * CIRC} ${CIRC}`;

  return (
    <div className="score-gauge">
      <div
        role="img"
        aria-label={`${label ? label + ': ' : ''}match score ${clamped} out of 100, ${band.label}`}
        className="score-gauge-dial"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: `rotate(${START_DEG}deg)`, display: 'block' }}>
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="var(--line)" strokeWidth={STROKE}
            strokeDasharray={trackDashArray} strokeLinecap="round"
          />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke={band.color} strokeWidth={STROKE}
            strokeDasharray={dashArray} strokeLinecap="round"
            className="score-gauge-fill"
          />
          {Array.from({ length: 10 }).map((_, i) => {
            const angle = (i / 9) * SWEEP_DEG;
            const rad = (angle * Math.PI) / 180;
            const inner = RADIUS - STROKE / 2 - 2;
            const outer = RADIUS + STROKE / 2 + 2;
            const cx = SIZE / 2, cy = SIZE / 2;
            const x1 = cx + inner * Math.cos(rad), y1 = cy + inner * Math.sin(rad);
            const x2 = cx + outer * Math.cos(rad), y2 = cy + outer * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-strong)" strokeWidth="1" />;
          })}
        </svg>
        <div className="score-gauge-value mono" style={{ fontSize: size * 0.26, color: band.color }}>
          {Math.round(clamped)}
        </div>
      </div>
      <div className="score-gauge-label">{band.label}</div>
    </div>
  );
}
