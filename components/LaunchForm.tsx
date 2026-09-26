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
import { CreatorTaxBps, TokenMetadata, validateTokenLogo, validateTokenMetadata } from "../lib/token-metadata";
import { estimateTokensReceived } from "../lib/launch-pricing";

export default function LaunchForm() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected, signMessage } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(9);
  const [description, setDescription] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("0");
  const [devBuyAmount, setDevBuyAmount] = useState("0");
  const [creatorTaxBps, setCreatorTaxBps] = useState<CreatorTaxBps>(100);
  const [creatorFeeDonationEnabled, setCreatorFeeDonationEnabled] = useState(false);
  const [feeRecipient, setFeeRecipient] = useState("");
  const [website, setWebsite] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{mint:string; sig:string}|null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  useEffect(() => {
    if (creatorFeeDonationEnabled && publicKey) setFeeRecipient(current => current || publicKey.toBase58());
  }, [creatorFeeDonationEnabled, publicKey]);

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
    const metadata: TokenMetadata = {
      name: name.trim(), symbol: symbol.trim().toUpperCase(), description: description.trim(), image: null,
      quoteAmount: quoteAmount.trim(), devBuyAmount: devBuyAmount.trim(), creatorTaxBps,
      creatorFeeDonationEnabled, feeRecipient: feeRecipient.trim(),
      website: website.trim(), xUrl: xUrl.trim(), telegramUrl: telegramUrl.trim()
    };
    const metadataError = validateTokenMetadata(metadata);
    if (metadataError) return setError(metadataError);

    const validation = await fetch("/api/launch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ metadata }) });
    const validationBody = await validation.json() as { error?: string };
    // A devnet launch deliberately continues after server validation: the mainnet adapter is disabled.
    if (validation.status !== 409 && !validation.ok) return setError(validationBody.error || "Launch configuration could not be validated.");
    if (!signMessage) return setError("This wallet must support message signing to authorize the launch configuration.");

    setBusy(true);
    try {
      const authorizationMessage = `EARLY BIRD launch configuration\nCreator: ${publicKey.toBase58()}\nConfiguration: ${JSON.stringify(metadata)}`;
      const configurationSignature = await signMessage(new TextEncoder().encode(authorizationMessage));
      const signatureBase64 = btoa(String.fromCharCode(...configurationSignature));
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
        creatorConfigurationSignature: string;
      } = { ...metadata, image: logo ? logo.name : null, creator: publicKey.toBase58(), mint: mint.publicKey.toBase58(), network: "devnet", createdAt: new Date().toISOString(), platformFeeBps: CONFIG.platformFeeBps, creatorConfigurationSignature: signatureBase64 };
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

      <section className="form-section">
        <h3>Launch settings</h3>
        <p className="small">These amounts are retained for the future bonding-curve launch flow. They do not execute a buy or establish a token price today.</p>
        <div className="row"><div><label className="label">Quote amount (SOL)</label><input className="input" inputMode="decimal" value={quoteAmount} onChange={e=>setQuoteAmount(e.target.value)} /></div><div><label className="label">Dev buy amount (SOL)</label><input className="input" inputMode="decimal" value={devBuyAmount} onChange={e=>setDevBuyAmount(e.target.value)} /></div></div>
        <div className="notice" style={{marginTop:14}}><strong>Estimated tokens received: {estimateTokensReceived({ quoteAmount, devBuyAmount }).estimatedTokens ?? "Not yet available"}.</strong><br/>A real bonding-curve pricing mechanism has not been implemented, so this is not an executable quote or a token-price estimate.</div>
      </section>

      <section className="form-section">
        <h3>Creator settings</h3>
        <div><label className="label">Creator tax</label><select className="input" value={creatorTaxBps} onChange={e=>setCreatorTaxBps(Number(e.target.value) as CreatorTaxBps)}><option value={100}>1%</option><option value={200}>2%</option><option value={300}>3%</option></select></div>
        <label className="checkbox-label"><input type="checkbox" checked={creatorFeeDonationEnabled} onChange={e => setCreatorFeeDonationEnabled(e.target.checked)} /> Donate creator fees</label>
        {creatorFeeDonationEnabled && <div style={{marginTop:14}}><label className="label">Creator fee recipient wallet</label><input className="input" value={feeRecipient} onChange={e=>setFeeRecipient(e.target.value)} placeholder="Connected wallet address" /><p className="small" style={{margin:"8px 0 0"}}>Defaults to your connected wallet. Enter only a Solana public address—never a private key, seed phrase, or secret key.</p><p className="small" style={{margin:"8px 0 0"}}>Creator fees will be directed to this wallet when creator-fee collection is enabled in the trading system.</p></div>}
        <div className="fee-summary"><strong>Fee summary</strong><span>Creator tax: {creatorTaxBps / 100}% (configuration only; not collected by current Devnet token creation).</span><span>Creator-fee donation: {creatorFeeDonationEnabled ? "enabled for the recipient wallet above" : "disabled"}.</span><span>EARLY BIRD platform fee: {CONFIG.platformFeeBps} bps (0.05%) to the configured development wallet (not editable, not collected by token creation).</span></div>
      </section>

      <section className="form-section">
        <h3>Optional links</h3><p className="small">Public token profile metadata. All links must use HTTPS.</p>
        <div className="row"><div><label className="label">Telegram</label><input className="input" value={telegramUrl} onChange={e=>setTelegramUrl(e.target.value)} placeholder="https://t.me/earlybird" /></div><div><label className="label">X</label><input className="input" value={xUrl} onChange={e=>setXUrl(e.target.value)} placeholder="https://x.com/earlybird" /></div></div>
        <div style={{marginTop:14}}><label className="label">Website</label><input className="input" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com" /></div>
      </section>

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
