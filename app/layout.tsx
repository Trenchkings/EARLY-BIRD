import "./globals.css";
import { WalletContext } from "../components/WalletContext";

export const metadata = {
  title: "MIDCURVE â€” Solana Launchpad",
  description: "Launch tokens early with MIDCURVE."
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

