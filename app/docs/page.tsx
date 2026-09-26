import Image from "next/image";
import { CONFIG } from "../../lib/config";

const networkLabel = CONFIG.network === "mainnet-beta" ? "Mainnet beta" : "Solana devnet";

export default function DocsPage() {
  return <main className="eb-shell">
    <nav className="eb-nav">
      <a className="eb-brand" href="/"><Image src="/early-bird-logo.jpeg" alt="EARLY BIRD" width={42} height={42}/><span>EARLY BIRD</span></a>
      <a className="btn btn-secondary" href="/">Back to launch</a>
    </nav>
    <div className="eb-container">
      <section className="card" style={{maxWidth:900, margin:"0 auto"}}>
        <span className="badge">Technical documentation</span>
        <h1 style={{fontSize:"clamp(38px, 6vw, 60px)", margin:"16px 0"}}>EARLY BIRD status</h1>
        <p className="small">Implementation details, safeguards, and the path to a broader launch experience.</p>

        <h2 style={{marginTop:32}}>Current network status</h2>
        <p>The application is currently configured for <strong>{networkLabel}</strong>. The live token action creates a real SPL mint, associated token account, and initial token supply through the connected wallet. Mainnet launch-adapter requests remain blocked unless the network configuration is explicitly set to mainnet beta.</p>

        <h2 style={{marginTop:28}}>Configured platform fee</h2>
        <p>The configured platform fee is <strong>{CONFIG.platformFeeBps} basis points (0.05%)</strong>. No fee is collected by the current SPL token-creation transaction because EARLY BIRD does not yet have a trading program. Any future fee must be enforced in the on-chain trade layer before mainnet enablement.</p>

        <h2 style={{marginTop:28}}>Admin authentication</h2>
        <p>Administrative access is wallet-authenticated. The site checks that the connected wallet matches the configured administrator address and then verifies a signed login message. The site does not store an administrator private key.</p>

        <h2 style={{marginTop:28}}>Current limitations</h2>
        <ul className="docs-list">
          <li>Token metadata entered in the form is stored locally for this prototype; no database or metadata upload service is included.</li>
          <li>The logo picker validates and previews an image locally. It does not upload or attach that image to on-chain token metadata.</li>
          <li>There is no token price, quote, trading data, chart, buying, or selling functionality.</li>
          <li>The StonkFun-compatible mainnet adapter boundary is intentionally disabled until its integration is reviewed and enabled.</li>
        </ul>

        <h2 style={{marginTop:28}}>Development roadmap</h2>
        <ol className="docs-list">
          <li>Preserve and validate the wallet-created SPL token flow.</li>
          <li>Add reviewed token metadata publishing and asset storage.</li>
          <li>Review and enable the mainnet launch adapter with on-chain fee enforcement.</li>
          <li>Only after the trade layer is verified, consider trading capabilities and related market information.</li>
        </ol>
      </section>
    </div>
  </main>;
}
