"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { CONFIG } from "../lib/config";

export default function LaunchForm() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(9);
  const [quote, setQuote] = useState("SOL (devnet test quote)");
  const [description, setDescription] = useState("");
  const [devBuy, setDevBuy] = useState("0");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{mint:string; sig:string}|null>(null);
  const [error, setError] = useState("");

  async function launchDevnetToken() {
    setError(""); setResult(null);
    if (!publicKey) return setError("Connect a Solana wallet first.");
    if (!name.trim() || !symbol.trim()) return setError("Enter a token name and ticker.");
    if (new TextEncoder().encode(name).length > 32) return setError("Name must be 32 bytes or fewer.");
    if (symbol.length > 10) return setError("Ticker must be 10 characters or fewer.");

    setBusy(true);
    try {
      // Devnet-only functional token creation. StonkFun itself is mainnet infrastructure;
      // this adapter deliberately does not pretend its mainnet launch API is devnet.
      const mint = Keypair.generate();
      const ata = await getAssociatedTokenAddress(mint.publicKey, publicKey);
      const rent = await getMinimumBalanceForRentExemptMint(connection);

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mint.publicKey,
          lamports: rent,
          space: 82,
          programId: TOKEN_PROGRAM_ID
        }),
        createInitializeMintInstruction(mint.publicKey, decimals, publicKey, publicKey),
        createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, mint.publicKey),
        createMintToInstruction(mint.publicKey, ata, publicKey, BigInt(1_000_000) * BigInt(10 ** decimals))
      );

      tx.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.partialSign(mint);

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

      const meta = {
        creator: publicKey.toBase58(),
        mint: mint.publicKey.toBase58(),
        name,
        symbol: symbol.toUpperCase(),
        description,
        quote,
        devBuy,
        network: "devnet",
        createdAt: new Date().toISOString(),
        platformFeeBps: CONFIG.platformFeeBps
      };
      localStorage.setItem(`early-bird:${mint.publicKey.toBase58()}`, JSON.stringify(meta));
      setResult({ mint: mint.publicKey.toBase58(), sig });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="card launch-card">
      <div className="badge">DEVNET BUILD</div>
      <h2 style={{fontSize:32, margin:"14px 0 8px"}}>Launch a token</h2>
      <p className="small" style={{marginBottom:22}}>This first build creates a real SPL token on Solana devnet. StonkFun mainnet launch wiring is kept separate until mainnet is enabled.</p>

      <div className="row">
        <div><label className="label">Token name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Early Bird Coin"/></div>
        <div><label className="label">Ticker</label><input className="input" value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="EBIRD" maxLength={10}/></div>
      </div>

      <div style={{marginTop:14}}><label className="label">Description</label><textarea className="input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this token?" rows={4}/></div>

      <div className="row" style={{marginTop:14}}>
        <div><label className="label">Pair / quote asset</label><select className="input" value={quote} onChange={e=>setQuote(e.target.value)}><option>SOL (devnet test quote)</option><option>Test xStock (placeholder)</option><option>Custom devnet mint (add later)</option></select></div>
        <div><label className="label">Dev buy</label><input className="input" value={devBuy} onChange={e=>setDevBuy(e.target.value)} placeholder="0"/></div>
      </div>

      <div className="notice" style={{marginTop:16}}>
        <strong>EARLY BIRD fee:</strong> 0.05% (5 bps). The devnet token-creation transaction does not collect this fee because there is no EARLY BIRD trading program yet. It will be enforced on-chain in the trade layer before mainnet.
      </div>

      <button className="btn btn-primary" style={{width:"100%", marginTop:18}} onClick={launchDevnetToken} disabled={!connected || busy}>
        {busy ? "Creating on devnet…" : connected ? "CREATE DEVNET TOKEN" : "CONNECT WALLET"}
      </button>

      {error && <div className="error" style={{marginTop:14}}>{error}</div>}
      {result && <div className="success" style={{marginTop:14}}>
        <div><strong>Token created.</strong></div>
        <div className="small" style={{marginTop:6}}>Mint: {result.mint}</div>
        <a className="small" href={`https://explorer.solana.com/address/${result.mint}?cluster=devnet`} target="_blank">View mint on Solana Explorer →</a>
        <div><a className="small" href={`https://explorer.solana.com/tx/${result.sig}?cluster=devnet`} target="_blank">View transaction →</a></div>
      </div>}
    </div>
  );
}