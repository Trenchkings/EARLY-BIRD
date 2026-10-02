"use client";

import Image from "next/image";
import LaunchForm from "../components/LaunchForm";
import SiteNav from "../components/SiteNav";
import MidcurveLaunches from "../components/MidcurveLaunches";

export default function Home() {
  return (
    <main className="eb-shell">
      <SiteNav />

      <div className="eb-container">
        <section className="hero">
          <div>
            <span className="badge">Solana token launchpad</span>
            <h1>
              Launch tokens.<br />
              <span style={{ color: "#bfeaff" }}>Find the curve.</span>
            </h1>
            <p>
              Launch, discover and track tokens from one place. Follow the market,
              find opportunities on the curve and launch directly from MIDCURVE.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 24,
                flexWrap: "wrap"
              }}
            >
              <a className="btn btn-primary" href="#launch">
                Create a token
              </a>

              <a className="btn btn-secondary" href="#how">
                How it works
              </a>
            </div>
          </div>

          <div className="card" style={{ textAlign: "center" }}>
            <Image
              src="/midcurve-logo.jpg"
              alt="MIDCURVE logo"
              width={320}
              height={320}
              style={{
                width: "100%",
                maxWidth: 320,
                height: "auto",
                borderRadius: "50%",
                margin: "0 auto"
              }}
            />
          </div>
        </section>

        <section className="grid" id="how">
          <div className="card">
            <div className="small">01</div>
            <h3>Connect</h3>
            <p className="small">
              Use Phantom, Solflare or another Solana wallet.
            </p>
          </div>

          <div className="card">
            <div className="small">02</div>
            <h3>Create</h3>
            <p className="small">
              Set the name, ticker, description, and logo for your token.
            </p>
          </div>

          <div className="card">
            <div className="small">03</div>
            <h3>Launch</h3>
            <p className="small">
              Approve the token creation transaction from your connected wallet.
            </p>
          </div>
        </section>

        <section id="launch" style={{ marginTop: 50 }}>
          <div style={{ marginBottom: 18 }}>
            <span className="badge">LAUNCH NOW</span>
            <h2 style={{ marginTop: 12 }}>Launch your token</h2>
            <p className="small">
              Create your token, choose your pair and configure your launch.
            </p>
          </div>

          <LaunchForm />
        </section>

        <MidcurveLaunches />
      </div>
    </main>
  );
}
