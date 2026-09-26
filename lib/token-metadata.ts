export type TokenMetadata = {
  name: string;
  symbol: string;
  description: string;
  image: string | null;
};

export type TokenMetadataInput = TokenMetadata;

export const TOKEN_METADATA_LIMITS = {
  nameBytes: 32,
  symbolLength: 10,
  descriptionLength: 500,
  imageBytes: 2 * 1024 * 1024
} as const;

export function validateTokenMetadata(metadata: TokenMetadataInput): string | null {
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
  return null;
}

export function validateTokenLogo(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Choose an image file for the token logo.";
  if (file.size > TOKEN_METADATA_LIMITS.imageBytes) return "Token logo must be 2 MB or smaller.";
  return null;
}
