// Ambient, decorative echo of the ScoreGauge dial - ties the auth hero
// back to the product's central "signal" concept. Purely visual: hidden
// from assistive tech, and hidden entirely below the breakpoint where the
// hero and form stack (see tokens.css .signal-rings media query).
export default function SignalRings() {
  return (
    <div className="signal-rings" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="90" strokeWidth="1" />
        <circle cx="100" cy="100" r="66" strokeWidth="1" />
        <circle cx="100" cy="100" r="42" strokeWidth="1" />
        <g className="ring-sweep">
          <path d="M100 100 L100 10" strokeWidth="1.6" />
        </g>
        <circle className="ring-dot" cx="100" cy="10" r="3" />
      </svg>
    </div>
  );
}
