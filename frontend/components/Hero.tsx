export default function Hero() {
  return (
    <section>
      {/* ── ROW A: "Parlay" + halftone ─────────────────── */}
      <div className="page-grid" style={{ borderBottom: "none" }}>
        <div
          className="gc-1-2 bg-white flex flex-col justify-end cell-pad-lg"
          style={{ minHeight: "clamp(320px, 42vh, 580px)" }}
        >
          <h1 className="text-display text-charcoal">Parlay</h1>
        </div>
        <div
          className="gc-3-4 halftone"
          style={{ minHeight: "clamp(320px, 42vh, 580px)" }}
        />
      </div>

      {/* ── ROW B: halftone | description | mint ─────── */}
      <div className="page-grid" style={{ borderTop: "1px solid var(--border)", borderBottom: "none" }}>
        <div
          className="gc-1-2 halftone"
          style={{ minHeight: "clamp(260px, 36vh, 480px)" }}
        />

        {/* Description — dark */}
        <div
          className="gc-3 flex flex-col justify-between cell-pad"
          style={{ background: "var(--black)", minHeight: "clamp(260px, 36vh, 480px)" }}
        >
          <p className="text-body text-white leading-relaxed">
            The first on-chain parlay. Pick up to 5 live outcomes across sports,
            politics, and crypto — buy one ticket, win big. Chainlink CRE settles
            results trustlessly. LP capital never leaves your wallet.
          </p>
          <a href="#how-it-works" className="arrow-btn mt-8">
            <span className="tracking-widest uppercase text-xs font-semibold">
              See How It Works
            </span>
            <span
              className="inline-flex items-center justify-center rounded-sm text-charcoal"
              style={{ width: 28, height: 28, background: "var(--white)", flexShrink: 0 }}
            >
              →
            </span>
          </a>
        </div>

        {/* Mint panel */}
        <div
          className="gc-4 flex flex-col justify-between cell-pad"
          style={{ background: "var(--mint)", minHeight: "clamp(260px, 36vh, 480px)" }}
        >
          <p className="text-body text-charcoal leading-relaxed">
            Prices are powered by LMSR — a constant-sum market maker where every
            outcome&apos;s probability sums to exactly 100%, always.
          </p>
          <div>
            <p className="text-label text-charcoal mb-4">Powered by:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {["1inch Aqua", "Chainlink CRE"].map((name) => (
                <span key={name} className="text-sm font-semibold text-charcoal">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW C: halftone | "Markets" ───────────────── */}
      <div className="page-grid" style={{ borderTop: "1px solid var(--border)", borderBottom: "none" }}>
        <div
          className="gc-1-2 halftone-dark"
          style={{ minHeight: "clamp(240px, 36vh, 480px)" }}
        />
        <div
          className="gc-3-4 flex flex-col justify-end cell-pad-lg"
          style={{ background: "var(--light-gray)", minHeight: "clamp(240px, 36vh, 480px)" }}
        >
          <h2 className="text-display text-charcoal">Markets</h2>
        </div>
      </div>

      {/* ── ROW D: "THE FIRST PARLAY. ON CHAIN." | halftone */}
      <div className="page-grid" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="gc-1-2 flex flex-col justify-center cell-pad-lg"
          style={{ background: "var(--black)", minHeight: "clamp(260px, 38vh, 500px)" }}
        >
          <h2
            className="text-display-sm text-white uppercase"
            style={{ letterSpacing: "-0.02em" }}
          >
            The First
            <br />
            Parlay.
            <br />
            On Chain.
          </h2>
        </div>
        <div
          className="gc-3-4 halftone"
          style={{ minHeight: "clamp(260px, 38vh, 500px)" }}
        />
      </div>
    </section>
  );
}
