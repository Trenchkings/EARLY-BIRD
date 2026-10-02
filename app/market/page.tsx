"use client";

import SiteNav from "../../components/SiteNav";
import MarketSections from "../../components/MarketSections";

export default function MarketPage() {
  return (
    <main className="eb-shell">
      <SiteNav />

      <div className="eb-container">
        <section style={{ marginTop: 44, marginBottom: 30 }}>
          <span className="badge">MIDCURVE MARKET</span>

          <h1 style={{ marginTop: 12 }}>
            Explore the market
          </h1>

          <p className="small">
            Discover new launches, find tokens approaching graduation
            and track graduated tokens.
          </p>
        </section>

        <MarketSections />
      </div>
    </main>
  );
}
