import {
  findMetadataPda,
  mplTokenMetadata,
  safeFetchAllMetadata
} from "@metaplex-foundation/mpl-token-metadata";

import {
  createUmi
} from "@metaplex-foundation/umi-bundle-defaults";

import {
  publicKey
} from "@metaplex-foundation/umi";

export type PumpQuoteMetadata = {
  name: string;
  symbol: string;
  logoUrl?: string;
};

type OffchainMetadata = {
  name?: string;
  symbol?: string;
  image?: string;
};

const metadataCache = new Map<
  string,
  {
    expiresAt: number;
    value: PumpQuoteMetadata | null;
  }
>();

const METADATA_CACHE_MS = 60 * 60 * 1000;

function normalizeUri(uri: string): string {
  const value = uri.replace(/\0/g, "").trim();

  if (value.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${value.slice(7)}`;
  }

  return value;
}

async function fetchOffchainMetadata(
  uri: string
): Promise<OffchainMetadata | null> {
  const url = normalizeUri(uri);

  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as OffchainMetadata;
  } catch {
    return null;
  }
}

async function enrichMetadata(
  mint: string,
  metadata: {
    name: string;
    symbol: string;
    uri: string;
  }
): Promise<PumpQuoteMetadata> {
  const onchainName =
    metadata.name.replace(/\0/g, "").trim();

  const onchainSymbol =
    metadata.symbol.replace(/\0/g, "").trim();

  const metadataUri =
    metadata.uri.replace(/\0/g, "").trim();

  const offchain =
    metadataUri
      ? await fetchOffchainMetadata(metadataUri)
      : null;

  return {
    name:
      offchain?.name?.trim() ||
      onchainName ||
      "Pump.fun supported quote",

    symbol:
      offchain?.symbol?.trim() ||
      onchainSymbol ||
      `${mint.slice(0, 4)}...${mint.slice(-4)}`,

    ...(offchain?.image
      ? {
          logoUrl: normalizeUri(offchain.image)
        }
      : {})
  };
}

export async function resolvePumpQuoteMetadataBulk(
  rpcUrl: string,
  mints: string[]
): Promise<Map<string, PumpQuoteMetadata | null>> {
  const result =
    new Map<string, PumpQuoteMetadata | null>();

  const unresolved: string[] = [];

  for (const mint of mints) {
    const cached = metadataCache.get(mint);

    if (cached && cached.expiresAt > Date.now()) {
      result.set(mint, cached.value);
    } else {
      unresolved.push(mint);
    }
  }

  if (unresolved.length === 0) {
    return result;
  }

  const umi = createUmi(rpcUrl).use(
    mplTokenMetadata()
  );

  /*
   * Keep account batches below common Solana
   * getMultipleAccounts limits.
   */
  const ACCOUNT_BATCH_SIZE = 50;

  for (
    let index = 0;
    index < unresolved.length;
    index += ACCOUNT_BATCH_SIZE
  ) {
    const mintBatch =
      unresolved.slice(
        index,
        index + ACCOUNT_BATCH_SIZE
      );

    try {
      const metadataPdas =
        mintBatch.map(mint =>
          findMetadataPda(umi, {
            mint: publicKey(mint)
          })
        );

      const metadataAccounts =
        await safeFetchAllMetadata(
          umi,
          metadataPdas
        );

      /*
       * safeFetchAllMetadata can omit missing accounts,
       * so map returned metadata using its mint rather
       * than relying on array positions.
       */
      const accountByMint = new Map(
        metadataAccounts.map(metadata => [
          metadata.mint.toString(),
          metadata
        ])
      );

      const OFFCHAIN_BATCH_SIZE = 8;

      for (
        let offchainIndex = 0;
        offchainIndex < mintBatch.length;
        offchainIndex += OFFCHAIN_BATCH_SIZE
      ) {
        const offchainBatch =
          mintBatch.slice(
            offchainIndex,
            offchainIndex + OFFCHAIN_BATCH_SIZE
          );

        const resolved =
          await Promise.all(
            offchainBatch.map(async mint => {
              const metadata =
                accountByMint.get(mint);

              if (!metadata) {
                return {
                  mint,
                  value: null
                };
              }

              const value =
                await enrichMetadata(
                  mint,
                  metadata
                );

              return {
                mint,
                value
              };
            })
          );

        for (const item of resolved) {
          metadataCache.set(item.mint, {
            value: item.value,
            expiresAt:
              Date.now() + METADATA_CACHE_MS
          });

          result.set(
            item.mint,
            item.value
          );
        }
      }
    } catch (error) {
      console.warn(
        "Unable to bulk resolve Pump quote metadata:",
        error
      );

      for (const mint of mintBatch) {
        metadataCache.set(mint, {
          value: null,
          expiresAt:
            Date.now() + 5 * 60 * 1000
        });

        result.set(mint, null);
      }
    }
  }

  return result;
}
