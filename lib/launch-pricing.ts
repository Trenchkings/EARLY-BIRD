/**
 * Boundary for the future, on-chain bonding-curve quote implementation.
 * No quote is executable until this is backed by the launch program.
 */
export type BondingCurveQuoteInput = {
  quoteAmount: string;
  devBuyAmount: string;
};

export type EstimatedTokenQuote = {
  estimatedTokens: null;
  executable: false;
  status: "pricing-not-implemented";
};

export function estimateTokensReceived(_: BondingCurveQuoteInput): EstimatedTokenQuote {
  return { estimatedTokens: null, executable: false, status: "pricing-not-implemented" };
}
