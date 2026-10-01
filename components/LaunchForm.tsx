"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
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

type LaunchProvider = "stonk" | "pumpfun";

export default function LaunchForm() {
  const [launchProvider, setLaunchProvider] = useState<LaunchProvider>("stonk");
  const [redirectFees, setRedirectFees] = useState(false);
  const { connection } = useConnection();
  const {
    publicKey,
    sendTransaction,
    connected,
    signMessage,
    signTransaction,
    signAllTransactions
  } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState(9);
  const [description, setDescription] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("0");
  const [devBuyAmount, setDevBuyAmount] = useState("0");
  const [creatorTaxBps, setCreatorTaxBps] = useState<CreatorTaxBps>(100);
  const [rewardTaxBps, setRewardTaxBps] = useState<100 | 300>(100);
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
  const [pairs, setPairs] = useState<Array<{mint:string; symbol:string; name:string; category:string; logoUrl?:string}>>([]);
  const [quoteMint, setQuoteMint] = useState("");
  const [pairSearch, setPairSearch] = useState("");
  const [launchMode, setLaunchMode] = useState<"standard" | "rewards">("standard");
  const [pairsBusy, setPairsBusy] = useState(true);
  const [launchStatus, setLaunchStatus] = useState("");
  const [submittedSignature, setSubmittedSignature] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimStatus, setClaimStatus] = useState("");
  const [claimSignature, setClaimSignature] = useState("");

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  useEffect(() => {
    if (creatorFeeDonationEnabled && publicKey) setFeeRecipient(current => current || publicKey.toBase58());
  }, [creatorFeeDonationEnabled, publicKey]);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint =
      launchProvider === "stonk"
        ? "/api/stonkfun/pairs"
        : "/api/pumpfun/pairs";

    setPairsBusy(true);
    setPairs([]);
    setQuoteMint("");

    fetch(endpoint, { signal: controller.signal })
      .then(async response => {
        const body = await response.json() as { pairs?: typeof pairs; error?: string };
        if (!response.ok) {
          throw new Error(
            body.error ||
              (launchProvider === "stonk"
                ? "Unable to load StonkFun pairs."
                : "Unable to load Pump.fun pairs.")
          );
        }
        setPairs(body.pairs || []);
      })
      .catch(reason => {
        if (reason instanceof Error && reason.name !== "AbortError") {
          setError(reason.message);
        }
      })
      .finally(() => setPairsBusy(false));

    return () => controller.abort();
  }, [launchProvider]);

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
      const authorizationMessage = `MIDCURVE launch configuration\nCreator: ${publicKey.toBase58()}\nConfiguration: ${JSON.stringify(metadata)}`;
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

  async function launchStonkFunToken() {
    setError(""); setResult(null); setLaunchStatus(""); setSubmittedSignature("");
    if (!publicKey) return setError("Connect a Solana wallet first.");
    if (!signTransaction) return setError("This wallet must support transaction signing.");
    if (launchMode === "rewards" && !quoteMint) return setError("Select a StonkFun quote pair.");
    const metadata: TokenMetadata = {
      name: name.trim(), symbol: symbol.trim().toUpperCase(), description: description.trim(), image: null,
      quoteAmount: quoteAmount.trim(), devBuyAmount: devBuyAmount.trim(), creatorTaxBps,
      creatorFeeDonationEnabled, feeRecipient: feeRecipient.trim(), website: website.trim(), xUrl: xUrl.trim(), telegramUrl: telegramUrl.trim()
    };
    const metadataError = validateTokenMetadata(metadata);
    if (metadataError) return setError(metadataError);
    if (!logo) return setError("A token logo is required.");

    const logoError = validateTokenLogo(logo);
    if (logoError) return setError(logoError);

    setBusy(true);
    try {
      const logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read token logo."));
        reader.onerror = () => reject(new Error("Unable to read token logo."));
        reader.readAsDataURL(logo);
      });

      const requestFingerprint = JSON.stringify({ creator: publicKey.toBase58(), quoteMint, metadata, logo: logoDataUrl });
      const fingerprintBytes = new TextEncoder().encode(requestFingerprint);
      const requestHash = await crypto.subtle.digest("SHA-256", fingerprintBytes.buffer as ArrayBuffer);
      const requestId = Array.from(new Uint8Array(requestHash), byte => byte.toString(16).padStart(2, "0")).join("");
      setLaunchStatus("Preparing launchâ€¦");
      const preparedResponse = await fetch("/api/stonkfun/prepare", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, metadata, launch: {
          publicKey: publicKey.toBase58(), quoteMint, name: metadata.name, symbol: metadata.symbol,
          description: metadata.description, devBuyAmount: metadata.devBuyAmount, creatorTaxBps: metadata.creatorTaxBps,
          ...(launchMode === "rewards"
            ? {
                mode: "reward" as const,
                rewardTaxBps
              }
            : {}),
          logo: logoDataUrl,
          website: metadata.website, twitter: metadata.xUrl, telegram: metadata.telegramUrl
        } })
      });
      const prepared = await preparedResponse.json() as {
        launchId?: string;
        transaction?: string;
        fundingTransaction?: string;
        error?: string;
      };

      if (!preparedResponse.ok || !prepared.launchId || !prepared.transaction) {
        throw new Error(prepared.error || "Unable to prepare launch.");
      }

      function decodeTransaction(
        encoded: string
      ): Transaction | VersionedTransaction {
        const bytes = Uint8Array.from(
          atob(encoded),
          character => character.charCodeAt(0)
        );

        try {
          return VersionedTransaction.deserialize(bytes);
        } catch {
          return Transaction.from(bytes);
        }
      }

      function encodeTransaction(
        transaction: Transaction | VersionedTransaction
      ): string {
        const bytes = transaction.serialize();

        return btoa(
          Array.from(
            bytes,
            byte => String.fromCharCode(byte)
          ).join("")
        );
      }

      const launchTransaction = decodeTransaction(
        prepared.transaction
      );

      let signedTransaction: string;
      let signedFundingTransaction: string | undefined;

      if (prepared.fundingTransaction) {
        if (!signAllTransactions) {
          throw new Error(
            "This launch requires a wallet that supports signing multiple transactions."
          );
        }

        setLaunchStatus("Approve the funding and launch transactions...");

        const fundingTransaction = decodeTransaction(
          prepared.fundingTransaction
        );

        const signedTransactions = await signAllTransactions([
          fundingTransaction,
          launchTransaction
        ]);

        if (signedTransactions.length !== 2) {
          throw new Error(
            "Wallet did not return both signed transactions."
          );
        }

        signedFundingTransaction = encodeTransaction(
          signedTransactions[0]
        );

        signedTransaction = encodeTransaction(
          signedTransactions[1]
        );
      } else {
        setLaunchStatus("Approve the launch transaction...");

        const signed = await signTransaction(
          launchTransaction
        );

        signedTransaction = encodeTransaction(signed);
      }

      setLaunchStatus("Submitting signed transaction...");

      const submitResponse = await fetch("/api/stonkfun/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          launchId: prepared.launchId,
          transaction: signedTransaction,
          ...(signedFundingTransaction
            ? { fundingTransaction: signedFundingTransaction }
            : {})
        })
      });
      const submitted = await submitResponse.json() as { signature?: string; error?: string };
      if (!submitResponse.ok || !submitted.signature) throw new Error(submitted.error || "Unable to submit launch.");
      setSubmittedSignature(submitted.signature);
      setLaunchStatus("Waiting for confirmationâ€¦");
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 2_000));
        const response = await fetch(
          `/api/stonkfun/status?launchId=${encodeURIComponent(prepared.launchId)}&signature=${encodeURIComponent(submitted.signature)}`
        );
        const status = await response.json() as { state?: string; signature?: string; mint?: string; error?: string };
        if (!response.ok) throw new Error(status.error || "Unable to check launch status.");
        if (status.state === "failed") throw new Error(status.error || "StonkFun launch failed.");
        if (status.state === "confirmed" && status.mint) {
          if (
            launchMode === "standard" &&
            redirectFees &&
            feeRecipient.trim()
          ) {
            setLaunchStatus("Registering creator fee recipient...");

            const redirectResponse = await fetch(
              "/api/creator-fees/redirect",
              {
                method: "POST",
                headers: {
                  "content-type": "application/json"
                },
                body: JSON.stringify({
                  creator: publicKey.toBase58(),
                  tokenMint: status.mint,
                  recipient: feeRecipient.trim()
                })
              }
            );

            const redirectResult =
              await redirectResponse.json() as {
                ok?: boolean;
                error?: string;
              };

            if (!redirectResponse.ok || !redirectResult.ok) {
              throw new Error(
                redirectResult.error ||
                  "Launch succeeded, but the fee recipient could not be registered."
              );
            }
          }

          setResult({
            mint: status.mint,
            sig: status.signature || submitted.signature
          });

          setLaunchStatus(
            launchMode === "standard" &&
            redirectFees &&
            feeRecipient.trim()
              ? "Launch confirmed. Fee recipient registered."
              : "Launch confirmed."
          );

          return;
        }
      }
      throw new Error("Launch confirmation timed out. Keep the transaction signature and check it in Solana Explorer.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Launch failed.");
    } finally {
      setBusy(false);
    }
  }

  async function claimCreatorRewards() {
    setError("");
    setClaimStatus("");
    setClaimSignature("");

    if (!publicKey) {
      setError("Connect the creator wallet first.");
      return;
    }

    if (!signTransaction) {
      setError(
        "This wallet does not support transaction signing."
      );
      return;
    }

    if (!result?.mint) {
      setError("No confirmed token launch was found.");
      return;
    }

    if (
      launchMode !== "standard" ||
      !redirectFees ||
      !feeRecipient.trim()
    ) {
      setError(
        "Creator reward redirection is not enabled for this launch."
      );
      return;
    }

    setClaimBusy(true);

    try {
      setClaimStatus("Preparing creator reward claim...");

      const response = await fetch(
        "/api/creator-fees/claim",
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            creator: publicKey.toBase58(),
            recipient: feeRecipient.trim(),
            tokenMint: result.mint
          })
        }
      );

      const prepared = await response.json() as {
        transaction?: string;
        error?: string;
      };

      if (!response.ok || !prepared.transaction) {
        throw new Error(
          prepared.error ||
            "Unable to prepare creator reward claim."
        );
      }

      const bytes = Uint8Array.from(
        atob(prepared.transaction),
        character => character.charCodeAt(0)
      );

      const transaction = Transaction.from(bytes);

      setClaimStatus(
        "Approve the creator reward claim in your wallet..."
      );

      const signed = await signTransaction(transaction);

      setClaimStatus("Submitting creator reward claim...");

      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        {
          skipPreflight: false,
          maxRetries: 3
        }
      );

      setClaimSignature(signature);
      setClaimStatus("Confirming creator reward claim...");

      const confirmation =
        await connection.confirmTransaction(
          signature,
          "confirmed"
        );

      if (confirmation.value.err) {
        throw new Error(
          "Creator reward claim failed on-chain."
        );
      }

      setClaimStatus(
        "Creator rewards sent to the nominated wallet."
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to claim creator rewards."
      );

      setClaimStatus("");
    } finally {
      setClaimBusy(false);
    }
  }
  const normalizedPairSearch = pairSearch.trim().toLowerCase();

  const visiblePairs = pairs.filter(pair => {
    if (!normalizedPairSearch) return true;

    return (
      pair.symbol.toLowerCase().includes(normalizedPairSearch) ||
      pair.name.toLowerCase().includes(normalizedPairSearch)
    );
  });
  const isMainnet = CONFIG.network === "mainnet-beta";

  return (
    <div className="card launch-card">
      <div className="badge">TOKEN CREATION</div>
      <h2 style={{fontSize:32, margin:"14px 0 8px"}}>Launch a token</h2>
      <p className="small" style={{marginBottom:22}}>Add the essentials, then approve token creation with your connected wallet.</p>

      <div className="row">
        <div><label className="label">Token name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="MidCurve Coin"/></div>
        <div><label className="label">Ticker</label><input className="input" value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="MID" maxLength={10}/></div>
      </div>

      <div style={{marginTop:14}}><label className="label">Description</label><textarea className="input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this token?" rows={4} maxLength={500}/></div>

      <section className="form-section">
        <h3>Launch via</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14
          }}
        >
          {([
            {
              id: "stonk" as const,
              name: "STONK",
              logo: "/launchpads/stonk-logo.jpg"
            },
            {
              id: "pumpfun" as const,
              name: "PUMP.FUN",
              logo: "/launchpads/pump-logo.jpg"
            }
          ]).map(provider => {
            const selected = launchProvider === provider.id;

            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  setLaunchProvider(provider.id);
                  setError("");
                  setResult(null);
                  setLaunchStatus("");
                  setSubmittedSignature("");
                  setPairSearch("");

                  if (provider.id === "pumpfun") {
                    setLaunchMode("standard");
                    setRedirectFees(false);
                    setFeeRecipient("");
                  }
                }}
                aria-pressed={selected}
                style={{
                  borderRadius: 18,
                  border: selected
                    ? "2px solid #ffffff"
                    : "1px solid rgba(255,255,255,0.16)",
                  background: selected
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.035)",
                  color: "inherit",
                  padding: "18px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  minHeight: 88,
                  boxShadow: selected
                    ? "0 0 0 3px rgba(255,255,255,0.04)"
                    : "none"
                }}
              >
                <img
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  width={48}
                  height={48}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    objectFit: "cover"
                  }}
                />
                <strong style={{ fontSize: 18 }}>
                  {provider.name}
                </strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="form-section">
        <h3>Launch settings</h3>

        {launchProvider === "stonk" && launchMode === "standard" && (
          <div
            className="card"
            style={{
              marginTop: 20,
              marginBottom: 20,
              padding: 20
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
                alignItems: "center"
              }}
            >
              <div>
                <div className="badge">CREATOR REWARDS</div>

                <h3 style={{ marginTop: 10, marginBottom: 6 }}>
                  Redirect Your Fees
                </h3>

                <p className="small" style={{ margin: 0 }}>
                  Send creator rewards from this launch to another
                  Solana wallet.
                </p>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                <input
                  type="checkbox"
                  checked={redirectFees}
                  onChange={(e) => {
                    setRedirectFees(e.target.checked);

                    if (!e.target.checked) {
                      setFeeRecipient("");
                    }
                  }}
                />

                Enable
              </label>
            </div>

            {redirectFees && (
              <div style={{ marginTop: 18 }}>
                <label className="label">
                  Rewards recipient wallet
                </label>

                <input
                  className="input"
                  value={feeRecipient}
                  onChange={(e) =>
                    setFeeRecipient(e.target.value.trim())
                  }
                  placeholder="Enter Solana wallet address"
                  autoComplete="off"
                  spellCheck={false}
                />

                <p
                  className="small"
                  style={{
                    marginTop: 8,
                    marginBottom: 0
                  }}
                >
                  Creator rewards will be redirected to this wallet
                  once the payout method has been connected.
                </p>
              </div>
            )}

            <p
              className="small"
              style={{
                marginTop: 14,
                marginBottom: 0,
                opacity: 0.75
              }}
            >
              Available for Standard SOL launches only.
            </p>
          </div>
        )}

        {launchProvider === "stonk" && (
          <>
        <label className="label">Launch type</label>
        <select
          className="input"
          value={launchMode}
          onChange={event => {
            const mode = event.target.value as "standard" | "rewards";
            setLaunchMode(mode);
            if (mode === "standard") setQuoteMint("");
          }}
        >
          <option value="standard">Standard SOL launch</option>
          <option value="rewards">Rewards pair launch</option>
        </select>
          </>
        )}

        {launchProvider === "stonk" && launchMode === "standard" && (
          <div className="notice" style={{marginTop:14}}>
            <strong>Standard SOL launch</strong><br/>
            Launch against SOL. Creator fee routing will be configurable for the
            creator wallet, token holders, or a nominated wallet.
          </div>
        )}

        {launchProvider === "stonk" && launchMode === "rewards" && (
          <div className="pair-selector" style={{marginTop:14}}>
            <label className="label">Rewards pair</label>

            {pairsBusy ? (
              <div className="notice">
                Loading reward pairs...
              </div>
            ) : (
              <>
                <input
                  className="input"
                  type="search"
                  value={pairSearch}
                  onChange={event => setPairSearch(event.target.value)}
                  placeholder="Search by ticker or pair name..."
                  autoComplete="off"
                  style={{
                    marginBottom: 12
                  }}
                />

                <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 10,
                  maxHeight: 340,
                  overflowY: "auto",
                  padding: 4
                }}
              >
                {visiblePairs.map(pair => {
                  const selected = quoteMint === pair.mint;

                  return (
                    <button
                      key={pair.mint}
                      type="button"
                      onClick={() => setQuoteMint(pair.mint)}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: selected
                          ? "2px solid #ffffff"
                          : "1px solid rgba(255,255,255,0.16)",
                        background: selected
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        color: "inherit",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        minHeight: 112
                      }}
                    >
                      {pair.logoUrl ? (
                        <img
                          src={pair.logoUrl}
                          alt={`${pair.symbol} logo`}
                          width={48}
                          height={48}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            objectFit: "cover"
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.08)",
                            fontWeight: 800
                          }}
                        >
                          {pair.symbol.slice(0, 2)}
                        </div>
                      )}

                      <strong>{pair.symbol}</strong>

                      <span
                        style={{
                          fontSize: 11,
                          opacity: 0.65,
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          width: "100%"
                        }}
                      >
                        {pair.name}
                      </span>
                    </button>
                  );
                })}

                {visiblePairs.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      padding: 24,
                      textAlign: "center",
                      opacity: 0.65
                    }}
                  >
                    No reward pairs found for "{pairSearch}".
                  </div>
                )}
                </div>
              </>
            )}

            <div style={{marginTop:14}}>
              <label className="label">Reward tax</label>

              <select
                className="input"
                value={rewardTaxBps}
                onChange={event =>
                  setRewardTaxBps(Number(event.target.value) as 100 | 300)
                }
              >
                <option value={100}>1%</option>
                <option value={300}>3%</option>
              </select>

              <p className="small" style={{marginTop:6}}>
                Select the StonkFun reward tax for this rewards launch.
              </p>
            </div>

            <div className="notice" style={{marginTop:14}}>
              Rewards launches use the selected supported asset as their pair.
              Reward/fee distribution to holders will be connected to the
              supported StonkFun launch configuration.
            </div>
          </div>
        )}

        {launchProvider === "pumpfun" && (
          <div className="pair-selector" style={{marginTop:14}}>
            <label className="label">Pump.fun pair</label>

            {pairsBusy ? (
              <div className="notice">Loading Pump.fun pairs...</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 10
                }}
              >
                {pairs.map(pair => {
                  const selected = quoteMint === pair.mint;

                  return (
                    <button
                      key={pair.mint}
                      type="button"
                      onClick={() => setQuoteMint(pair.mint)}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        border: selected
                          ? "2px solid #ffffff"
                          : "1px solid rgba(255,255,255,0.16)",
                        background: selected
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        color: "inherit",
                        minHeight: 78
                      }}
                    >
                      <strong>{pair.symbol}</strong>
                      <div className="small" style={{marginTop:6}}>
                        {pair.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="notice" style={{marginTop:14}}>
              Pump.fun launch transaction wiring is the next integration step.
            </div>
          </div>
        )}

        <div className="row" style={{marginTop:14}}>
          <div>
            <label className="label">Launch amount (SOL)</label>
            <input
              className="input"
              inputMode="decimal"
              value={quoteAmount}
              onChange={e => setQuoteAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Dev buy amount (SOL)</label>
            <input
              className="input"
              inputMode="decimal"
              value={devBuyAmount}
              onChange={e => setDevBuyAmount(e.target.value)}
            />
          </div>
        </div>
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

      <button
        className="btn btn-primary"
        style={{width:"100%", marginTop:18}}
        onClick={() => {
          if (launchProvider === "pumpfun") {
            setError("Pump.fun transaction creation is not enabled yet.");
            return;
          }

          if (isMainnet) {
            void launchStonkFunToken();
          } else {
            void launchDevnetToken();
          }
        }}
        disabled={
          !connected ||
          busy ||
          (launchProvider === "stonk" &&
            isMainnet &&
            launchMode === "rewards" &&
            (!quoteMint || pairsBusy))
        }
      >
        {busy
          ? (launchStatus || "Creating token...")
          : !connected
            ? "CONNECT WALLET"
            : launchProvider === "pumpfun"
              ? "LAUNCH WITH PUMP.FUN"
              : isMainnet
                ? "LAUNCH WITH STONK"
                : "CREATE TOKEN"}
      </button>

      {error && <div className="error" style={{marginTop:14}}>{error}</div>}
      {submittedSignature && !result && <div className="notice" style={{marginTop:14}}><strong>Transaction submitted.</strong><div className="small">Signature: {submittedSignature}</div><a className="small" href={`https://explorer.solana.com/tx/${submittedSignature}`} target="_blank" rel="noreferrer">View transaction â†’</a></div>}
      {result && <div className="success" style={{marginTop:14}}>
        <div><strong>Token created.</strong></div>
        <div className="small" style={{marginTop:6}}>Mint: {result.mint}</div>
        <div className="small" style={{marginTop:6}}>Transaction: {result.sig}</div>
        <a className="small" href={`https://explorer.solana.com/address/${result.mint}${isMainnet ? "" : "?cluster=devnet"}`} target="_blank" rel="noreferrer">View mint on Solana Explorer â†’</a>
        <div><a className="small" href={`https://explorer.solana.com/tx/${result.sig}${isMainnet ? "" : "?cluster=devnet"}`} target="_blank" rel="noreferrer">View transaction â†’</a></div>
      </div>}
      {result &&
        launchProvider === "stonk" &&
        isMainnet &&
        launchMode === "standard" &&
        redirectFees &&
        feeRecipient.trim() && (
          <div
            className="card"
            style={{
              marginTop: 14,
              padding: 18
            }}
          >
            <div className="badge">
              CREATOR REWARDS
            </div>

            <h3 style={{ marginTop: 10, marginBottom: 6 }}>
              Redirected creator fees
            </h3>

            <p className="small" style={{ marginBottom: 14 }}>
              Claim available creator rewards and send them to:
            </p>

            <div
              className="small"
              style={{
                wordBreak: "break-all",
                marginBottom: 14
              }}
            >
              {feeRecipient}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={claimBusy}
              onClick={claimCreatorRewards}
            >
              {claimBusy
                ? claimStatus || "CLAIMING..."
                : "CLAIM CREATOR REWARDS"}
            </button>

            {claimStatus && (
              <div
                className="notice"
                style={{ marginTop: 12 }}
              >
                {claimStatus}
              </div>
            )}

            {claimSignature && (
              <div
                className="success"
                style={{ marginTop: 12 }}
              >
                <strong>
                  Creator rewards claimed.
                </strong>

                <div
                  className="small"
                  style={{ marginTop: 6 }}
                >
                  Transaction: {claimSignature}
                </div>

                <a
                  className="small"
                  href={`https://explorer.solana.com/tx/${claimSignature}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View claim on Solana Explorer →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
  );
}



























