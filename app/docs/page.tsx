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

        <h2 style={{marginTop:28}}>Phase 2 launch configuration</h2>
        <p>The launch form records a quote amount, developer buy amount, creator tax (exactly 1%, 2%, or 3%), and a Solana fee-recipient wallet. The fee recipient defaults to the creator&apos;s connected wallet and is validated as a public key. The creator signs the exact configuration before token creation; the signed configuration is retained with the prototype&apos;s local metadata and is not an editable post-launch setting.</p>
        <p>Creator tax and the EARLY BIRD platform fee are separate concepts. The creator tax is a future creator-directed buy/sell charge (1–3%), while the EARLY BIRD platform fee remains a fixed 5 bps / 0.05% protocol fee directed to the configured development wallet. Neither is collected by the current SPL token-creation flow, and neither is presented as trading data.</p>

        <h2 style={{marginTop:28}}>Pricing and trading boundary</h2>
        <p>Quote and dev-buy values are launch inputs, not a price oracle. The code includes a typed boundary for a future bonding-curve quote provider, but currently returns no estimated token amount and is explicitly non-executable. There are no buy/sell transactions, chart, market cap, volume, liquidity, price, or token-price claims in this phase.</p>
        <p>A final bonding-curve program must calculate and enforce buy/sell amounts and route any applicable fees atomically. A Token-2022 <code>TransferFeeConfig</code> can be evaluated for transfer-level fees where the token architecture supports it, but it is not a substitute for a bonding-curve buy/sell tax: transfer fees apply to token transfers and have different collection semantics. No transfer fee configuration is enabled by this SPL Token program mint.</p>

        <h2 style={{marginTop:28}}>Optional public links</h2>
        <p>Metadata can include optional GitHub profile and repository URLs, plus website, X/Twitter, and Telegram URLs. These fields are strictly validated HTTPS links and are not required to launch. EARLY BIRD does not request GitHub OAuth permissions to store public links; a future verification feature can add an opt-in OAuth boundary without adding client secrets to this application.</p>

        <h2 style={{marginTop:28}}>Admin authentication</h2>
        <p>Administrative access is wallet-authenticated. The site checks that the connected wallet matches the configured administrator address and then verifies a signed login message. The site does not store an administrator private key.</p>

        <h2 style={{marginTop:28}}>Current limitations</h2>
        <ul className="docs-list">
          <li>Token metadata entered in the form is stored locally for this prototype; no database or metadata upload service is included.</li>
          <li>The logo picker validates and previews an image locally. It does not upload or attach that image to on-chain token metadata.</li>
          <li>There is no token price, quote, trading data, chart, buying, or selling functionality.</li>
          <li>The displayed estimated-token field is intentionally unavailable until a reviewed on-chain bonding curve exists; entered quote and dev-buy amounts do not transfer funds.</li>
          <li>Creator taxes and platform fees are configuration only until the final trading implementation enforces them atomically.</li>
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
