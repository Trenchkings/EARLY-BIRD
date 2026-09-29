"use client";

import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { CONFIG } from "../../lib/config";

export default function Admin() {
  const { publicKey, signMessage } = useWallet();
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState("");

  async function authenticate() {
    if (!publicKey || !signMessage) return setStatus("Connect the development wallet first.");
    if (publicKey.toBase58() !== CONFIG.devWallet) return setStatus("This wallet is not the configured administrator.");
    const nonce = `MIDCURVE admin login ${Date.now()}`;
    const sig = await signMessage(new TextEncoder().encode(nonce));
    const res = await fetch("/api/admin/verify", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ wallet: publicKey.toBase58(), message: nonce, signature: Buffer.from(sig).toString("base64") })
    });
    if (!res.ok) return setStatus("Admin verification failed.");
    setAuthed(true); setStatus("Authenticated.");
  }

  return <main className="eb-shell">
    <nav className="eb-nav"><div className="eb-brand"><img src="/midcurve-logo.jpg" alt="MIDCURVE"/><span>MIDCURVE ADMIN</span></div><WalletMultiButton/></nav>
    <div className="eb-container">
      <div className="card" style={{maxWidth:900, margin:"0 auto"}}>
        <span className="badge">ADMIN</span>
        <h1 style={{fontSize:42, margin:"14px 0"}}>Control centre</h1>
        {!authed ? <>
          <p className="small">Administrator wallet: {CONFIG.devWallet}</p>
          <button className="btn btn-primary" onClick={authenticate} style={{marginTop:15}}>SIGN ADMIN LOGIN</button>
        </> : <>
          <div className="success">Admin wallet verified.</div>
          <div className="grid" style={{marginTop:18}}>
            <div className="card"><div className="small">NETWORK</div><div className="stat">DEVNET</div></div>
            <div className="card"><div className="small">PLATFORM FEE</div><div className="stat">0.05%</div></div>
            <div className="card"><div className="small">STATUS</div><div className="stat">BUILD</div></div>
          </div>
          <h2 style={{marginTop:30}}>Development wallet</h2>
          <p className="small">{CONFIG.devWallet}</p>
          <p className="small" style={{marginTop:12}}>Mainnet fee collection and StonkFun launch configuration are intentionally disabled until the on-chain fee/trade program and permitted integration have been verified.</p>
        </>}
        {status && <div className="notice" style={{marginTop:16}}>{status}</div>}
      </div>
    </div>
  </main>
}
