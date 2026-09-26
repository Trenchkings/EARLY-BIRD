# EARLY BIRD — Solana launchpad MVP

This is a Devnet SPL-token creator and a mainnet-only StonkFun / Raydium LaunchLab client.

## What works now

- EARLY BIRD branding using the supplied logo.
- Solana wallet connection.
- Real SPL token creation on Solana devnet.
- Token name/ticker/description form.
- Intended quote-asset selector.
- Admin page with wallet-signature authentication.
- Development wallet configured:
  `CuvMFjMtApH6DWHUmnutHF5kk5Q18BXZ4jUDKTG6Z3pH3`
- Target platform fee configured as 5 bps / 0.05%.
- Creator tax configuration selectable at 1%, 2%, or 3%.
- Optional creator-fee donation configuration with a validated Solana public recipient wallet.
- Optional public token profile links for Telegram, X, and Website.
- Live StonkFun quote-pair discovery, search, and category filtering.
- Server-side launch preparation/submission/status adapters with timeouts, response validation, and duplicate-request protection.
- Connected-wallet signing of prepared transactions; no private key or seed phrase is requested or handled.

## Fees and public profile metadata

Creator tax (1–3%) and the fixed EARLY BIRD platform fee (5 bps / 0.05%) are separate launch settings. A creator can enable **Donate creator fees** and designate a Solana public wallet to receive those fees once collection is implemented. The recipient defaults to the connected wallet and can be replaced with another valid public address; the app never asks for private keys, seed phrases, or wallet credentials.

These settings are currently configuration only. The Devnet SPL token-creation transaction does not collect or transfer creator fees or the EARLY BIRD platform fee. Real fee enforcement will be added later with the on-chain trading/bonding-curve layer.

The public launch form supports optional HTTPS links for Telegram, X, and Website. GitHub profile and GitHub repository links are not part of the current public launch form.

## Important architecture decision

StonkFun's current launch API is a mainnet launch flow. Devnet should not pretend to be StonkFun. This MVP therefore creates real devnet SPL tokens and keeps the StonkFun adapter separate.

The StonkFun path supplies the selected live quote mint, receives a prepared transaction, validates that the connected creator is a required signer, shows it to the wallet for explicit approval, submits the signed transaction through the server adapter, and polls for at most two minutes until the provider returns the created mint. It is blocked unless `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`, and the configured `NEXT_PUBLIC_SOLANA_RPC` must report the Solana mainnet genesis hash. A wallet rejection never submits the transaction.

The repository verifies the public pair-discovery URL, but does not contain verified URLs for the provider's prepare, submit, and status operations. Those URLs must therefore be supplied as `STONKFUN_PREPARE_URL`, `STONKFUN_SUBMIT_URL`, and `STONKFUN_STATUS_URL`; the application deliberately does not invent defaults. `STONKFUN_TIMEOUT_MS` optionally controls the server-side provider timeout (12 seconds by default). Keep these variables server-only.

Provider prepare/submit/status response contracts remain limited to the fields implemented by the configured service: prepare must return `{ launchId, transaction }`, submit must return `{ signature }`, and status must return `{ state, signature?, mint? }`, where state is `pending`, `confirmed`, or `failed`. The provider endpoints are not publicly documented in this repository, so operators must verify these contracts with StonkFun before launch. In-memory idempotency prevents duplicate clicks in one application process, but it is not a substitute for a shared durable launch store in a multi-instance deployment.

The current provider request includes the creator, selected quote mint, token name/symbol/description, developer-buy amount, and optional public links. The logo, quote-amount estimate, creator-tax selection, donation selection, and platform-fee configuration are **not** sent or enforced by this adapter because no verified provider capability for those fields is available. Do not present those configuration-only fields as on-chain launch behavior.

## Controlled mainnet testing

1. Obtain and independently verify the three HTTPS provider endpoints and a trusted mainnet RPC URL. Never place a seed phrase, private key, or secret key in environment variables or logs.
2. Set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`, `NEXT_PUBLIC_SOLANA_RPC`, `STONKFUN_PREPARE_URL`, `STONKFUN_SUBMIT_URL`, and `STONKFUN_STATUS_URL`, then build and start the application.
3. First verify pair discovery and form validation with a wallet that holds no funds. Inspect the wallet simulation and every instruction before approving anything.
4. For the controlled launch, use a deliberately funded wallet and a small, operator-approved amount. **A real mainnet launch spends real funds and may be irreversible.** The final transaction always requires explicit wallet approval.
5. Retain the displayed signature and independently confirm both the transaction and created mint in Solana Explorer. A polling timeout does not prove that a submitted transaction failed; check the signature before retrying.

No automated test in this repository performs or claims to perform a real mainnet launch.

## Install

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Connect a wallet set to Solana Devnet and use the faucet to get test SOL.

## Next implementation stage

1. Add a metadata upload service (Arweave/IPFS).
2. Add a proper on-chain trading and bonding-curve fee mechanism for creator tax and the 0.05% EARLY BIRD platform fee after provider support is verified.
3. Replace process-local duplicate-request tracking with persistent launch records for horizontally scaled deployments.
4. Add persistent DB tables for launches, users, trades, fee events and audit logs.
5. Add admin controls and analytics.

Do not put a private key in `.env`. The admin wallet authenticates by signing a message.
