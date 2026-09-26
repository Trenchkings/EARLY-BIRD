"use client";

import Image from "next/image";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import LaunchForm from "../components/LaunchForm";

export default function Home() {
  return (
    <main className="eb-shell">
      <nav className="eb-nav">
        <div className="eb-brand">
          <Image src="/early-bird-logo.jpeg" alt="EARLY BIRD" width={42} height={42}/>
          <span>EARLY BIRD</span>
        </div>
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          <a className="btn btn-secondary" href="#launch">Launch</a>
          <a className="btn btn-secondary" href="/admin">Admin</a>
          <WalletMultiButton />
        </div>
      </nav>

      <div className="eb-container">
        <section className="hero">
          <div>
            <span className="badge">Solana launchpad • devnet first</span>
            <h1>Launch early.<br/><span style={{color:"#bfeaff"}}>Fly first.</span></h1>
            <p>EARLY BIRD is being built as a StonkFun-compatible launch interface: launch tokens, choose quote assets, and eventually use the same StonkFun/Raydium LaunchLab ecosystem. The current build is deliberately safe on devnet.</p>
            <div style={{display:"flex", gap:10, marginTop:24, flexWrap:"wrap"}}>
              <a className="btn btn-primary" href="#launch">Create a devnet token</a>
              <a className="btn btn-secondary" href="#how">How it works</a>
            </div>
          </div>
          <div className="card" style={{textAlign:"center"}}>
            <Image src="/early-bird-logo.jpeg" alt="EARLY BIRD logo" width={320} height={320} style={{width:"100%", maxWidth:320, height:"auto", borderRadius:"50%", margin:"0 auto"}}/>
          </div>
        </section>

        <section className="grid" id="how">
          <div className="card"><div className="small">01</div><h3>Connect</h3><p className="small">Use Phantom, Solflare or another Solana wallet.</p></div>
          <div className="card"><div className="small">02</div><h3>Create</h3><p className="small">Set the name, ticker, description and intended quote asset.</p></div>
          <div className="card"><div className="small">03</div><h3>Launch</h3><p className="small">Devnet creates a real SPL mint. Mainnet will use the reviewed StonkFun launch adapter.</p></div>
        </section>

        <section id="launch" style={{marginTop:50}}><LaunchForm /></section>

        <section className="grid" style={{marginTop:24}}>
          <div className="card"><div className="small">PLATFORM FEE</div><div className="stat">0.05%</div><div className="small">5 basis points • target EARLY BIRD development fee</div></div>
          <div className="card"><div className="small">ADMIN WALLET</div><div className="stat">Wallet</div><div className="small">Wallet-authenticated admin access; no private key stored by the site.</div></div>
          <div className="card"><div className="small">NETWORK</div><div className="stat">DEVNET</div><div className="small">Free test SOL. Switch to mainnet only after the launch/trade flow is verified.</div></div>
        </section>
      </div>
    </main>
  );
}