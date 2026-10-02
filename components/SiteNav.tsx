"use client";

import Image from "next/image";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { CONFIG } from "../lib/config";

export default function SiteNav() {
  const { publicKey } = useWallet();

  const isAdmin =
    publicKey?.toBase58() === CONFIG.devWallet;

  return (
    <nav className="eb-nav">
      <div className="eb-brand">
        <Image
          src="/midcurve-logo.jpg"
          alt="MIDCURVE"
          width={42}
          height={42}
        />
        <span>MIDCURVE</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <a className="btn btn-secondary" href="/#launch">
          Launch
        </a>

        <a className="btn btn-secondary" href="/docs">
          Docs
        </a>

        <a className="btn btn-secondary" href="/market">
          Market
        </a>

        {isAdmin && (
          <a className="btn btn-secondary" href="/admin">
            Admin
          </a>
        )}

        <WalletMultiButton />
      </div>
    </nav>
  );
}
