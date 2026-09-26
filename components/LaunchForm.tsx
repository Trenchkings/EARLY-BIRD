"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  createMintToInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { CONFIG } from "../lib/config";
import { TokenMetadata, validateTokenLogo, validateTokenMetadata } from "../lib/token-metadata";

export default function LaunchForm() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(9);
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{mint:string; sig:string}|null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  function onLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const logoError = validateTokenLogo(file);
    if (logoError) {
      setError(logoError);
      event.target.value = "";
      return;
    }
    setError("");
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function launchDevnetToken() {
    setError(""); setResult(null);
    if (!publicKey) return setError("Connect a Solana wallet first.");
    const metadata: TokenMetadata = { name: name.trim(), symbol: symbol.trim().toUpperCase(), description: description.trim(), image: null };
    const metadataError = validateTokenMetadata(metadata);
    if (metadataError) return setError(metadataError);

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

      const meta: TokenMetadata & {
        creator: string;
        mint: string;
        network: "devnet";
        createdAt: string;
        platformFeeBps: number;
      } = { ...metadata, image: logo ? logo.name : null, creator: publicKey.toBase58(), mint: mint.publicKey.toBase58(), network: "devnet", createdAt: new Date().toISOString(), platformFeeBps: CONFIG.platformFeeBps };
      localStorage.setItem(`early-bird:${mint.publicKey.toBase58()}`, JSON.stringify(meta));
      setResult({ mint: mint.publicKey.toBase58(), sig });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="card launch-card">
      <div className="badge">TOKEN CREATION</div>
      <h2 style={{fontSize:32, margin:"14px 0 8px"}}>Launch a token</h2>
      <p className="small" style={{marginBottom:22}}>Add the essentials, then approve token creation with your connected wallet.</p>

      <div className="row">
        <div><label className="label">Token name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Early Bird Coin"/></div>
        <div><label className="label">Ticker</label><input className="input" value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="EBIRD" maxLength={10}/></div>
      </div>

      <div style={{marginTop:14}}><label className="label">Description</label><textarea className="input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this token?" rows={4} maxLength={500}/></div>

      <div style={{marginTop:14}}>
        <label className="label" htmlFor="token-logo">Token logo <span className="small">(optional, image, max 2 MB)</span></label>
        <div className="logo-picker">
          {logoPreview ? <img className="logo-preview" src={logoPreview} alt="Selected token logo preview" /> : <div className="logo-placeholder">Logo preview</div>}
          <input id="token-logo" className="input" type="file" accept="image/*" onChange={onLogoChange}/>
        </div>
      </div>

      <button className="btn btn-primary" style={{width:"100%", marginTop:18}} onClick={launchDevnetToken} disabled={!connected || busy}>
        {busy ? "Creating token…" : connected ? "CREATE TOKEN" : "CONNECT WALLET"}
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
