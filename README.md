# EARLY BIRD — Solana launchpad MVP

This is a devnet-first foundation for the EARLY BIRD launchpad.

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

## Fees and public profile metadata

Creator tax (1–3%) and the fixed EARLY BIRD platform fee (5 bps / 0.05%) are separate launch settings. A creator can enable **Donate creator fees** and designate a Solana public wallet to receive those fees once collection is implemented. The recipient defaults to the connected wallet and can be replaced with another valid public address; the app never asks for private keys, seed phrases, or wallet credentials.

These settings are currently configuration only. The Devnet SPL token-creation transaction does not collect or transfer creator fees or the EARLY BIRD platform fee. Real fee enforcement will be added later with the on-chain trading/bonding-curve layer.

The public launch form supports optional HTTPS links for Telegram, X, and Website. GitHub profile and GitHub repository links are not part of the current public launch form.

## Important architecture decision

StonkFun's current launch API is a mainnet launch flow. Devnet should not pretend to be StonkFun. This MVP therefore creates real devnet SPL tokens and keeps the StonkFun adapter separate.

Current StonkFun documentation describes a flow where a creator supplies a quote mint, receives an unsigned payment transaction, signs it in their wallet, submits it, and receives the resulting mint. StonkFun launches use Raydium LaunchLab. The integration can be added as a mainnet-only adapter after endpoint permissions, fee behaviour and legal/compliance requirements are verified.

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
2. Add a dynamic StonkFun pair discovery adapter.
3. Add StonkFun launch quote -> wallet sign -> submit -> status polling.
4. Add a proper on-chain trading and bonding-curve fee mechanism for creator tax and the 0.05% EARLY BIRD platform fee.
5. Add persistent DB tables for launches, users, trades, fee events and audit logs.
6. Add admin controls and analytics.
7. Add mainnet safety checks and only then enable mainnet.

Do not put a private key in `.env`. The admin wallet authenticates by signing a message.
