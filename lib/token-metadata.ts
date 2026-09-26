import { PublicKey } from "@solana/web3.js";

export const CREATOR_TAX_BPS_OPTIONS = [100, 200, 300] as const;
export type CreatorTaxBps = (typeof CREATOR_TAX_BPS_OPTIONS)[number];

export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  quoteAmount: string;
  devBuyAmount: string;
  creatorTaxBps: CreatorTaxBps;
  feeRecipient: string;
  githubProfile: string;
  githubRepository: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
};

export type TokenMetadataInput = TokenMetadata;

export const TOKEN_METADATA_LIMITS = {
  nameBytes: 32,
  symbolLength: 10,
  descriptionLength: 500,
  imageBytes: 2 * 1024 * 1024
} as const;

const SOL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/;

function validateOptionalUrl(value: string, label: string, allowedHosts?: string[]): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return `${label} must use https.`;
    if (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase())) {
      return `${label} must use an approved domain.`;
    }
    return null;
  } catch {
    return `${label} must be a valid URL.`;
  }
}

export function validateSolAmount(value: string, label: string): string | null {
  if (!SOL_AMOUNT_PATTERN.test(value.trim())) return `${label} must be a non-negative SOL amount with up to 9 decimals.`;
  return null;
}

export function isCreatorTaxBps(value: number): value is CreatorTaxBps {
  return (CREATOR_TAX_BPS_OPTIONS as readonly number[]).includes(value);
}

export function validateTokenMetadata(metadata: TokenMetadataInput): string | null {
  if (!metadata || typeof metadata !== "object" ||
    typeof metadata.name !== "string" || typeof metadata.symbol !== "string" || typeof metadata.description !== "string" ||
    typeof metadata.quoteAmount !== "string" || typeof metadata.devBuyAmount !== "string" || typeof metadata.creatorTaxBps !== "number" ||
    typeof metadata.feeRecipient !== "string" || typeof metadata.githubProfile !== "string" || typeof metadata.githubRepository !== "string" ||
    typeof metadata.website !== "string" || typeof metadata.xUrl !== "string" || typeof metadata.telegramUrl !== "string") {
    return "Launch metadata has an invalid shape.";
  }
  if (!metadata.name.trim() || !metadata.symbol.trim()) {
    return "Enter a token name and ticker.";
  }
  if (new TextEncoder().encode(metadata.name.trim()).length > TOKEN_METADATA_LIMITS.nameBytes) {
    return "Name must be 32 bytes or fewer.";
  }
  if (metadata.symbol.trim().length > TOKEN_METADATA_LIMITS.symbolLength) {
    return "Ticker must be 10 characters or fewer.";
  }
  if (metadata.description.length > TOKEN_METADATA_LIMITS.descriptionLength) {
    return "Description must be 500 characters or fewer.";
  }
  const quoteError = validateSolAmount(metadata.quoteAmount, "Quote amount");
  if (quoteError) return quoteError;
  const devBuyError = validateSolAmount(metadata.devBuyAmount, "Dev buy amount");
  if (devBuyError) return devBuyError;
  if (!isCreatorTaxBps(metadata.creatorTaxBps)) return "Creator tax must be exactly 1%, 2%, or 3%.";
  try {
    new PublicKey(metadata.feeRecipient.trim());
  } catch {
    return "Fee recipient must be a valid Solana public key.";
  }
  const githubProfileError = validateOptionalUrl(metadata.githubProfile, "GitHub profile", ["github.com", "www.github.com"]);
  if (githubProfileError) return githubProfileError;
  const githubRepositoryError = validateOptionalUrl(metadata.githubRepository, "GitHub repository", ["github.com", "www.github.com"]);
  if (githubRepositoryError) return githubRepositoryError;
  if (metadata.githubProfile.trim() && !/^https:\/\/(www\.)?github\.com\/[^/]+\/?$/.test(metadata.githubProfile.trim())) return "GitHub profile must point to a GitHub user or organization.";
  if (metadata.githubRepository.trim() && !/^https:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(metadata.githubRepository.trim())) return "GitHub repository must point to a public GitHub repository URL.";
  const websiteError = validateOptionalUrl(metadata.website, "Website");
  if (websiteError) return websiteError;
  const xError = validateOptionalUrl(metadata.xUrl, "X/Twitter URL", ["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
  if (xError) return xError;
  const telegramError = validateOptionalUrl(metadata.telegramUrl, "Telegram URL", ["t.me", "www.t.me", "telegram.me", "www.telegram.me"]);
  if (telegramError) return telegramError;
  return null;
}

export function validateTokenLogo(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Choose an image file for the token logo.";
  if (file.size > TOKEN_METADATA_LIMITS.imageBytes) return "Token logo must be 2 MB or smaller.";
  return null;
}
