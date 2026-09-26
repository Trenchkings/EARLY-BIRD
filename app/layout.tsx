import "./globals.css";
import { WalletContext } from "../components/WalletContext";

export const metadata = {
  title: "EARLY BIRD — Solana Launchpad",
  description: "Launch tokens early. Devnet-first Solana launchpad."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContext>{children}</WalletContext>
      </body>
    </html>
  );
}