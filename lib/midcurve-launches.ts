import { neon } from "@neondatabase/serverless";

export type MidcurveLaunchProvider = "pumpfun" | "stonk";

export type MidcurveLaunch = {
  mint: string;
  signature: string;
  provider: MidcurveLaunchProvider;
  creator: string;
  name: string;
  symbol: string;
  description: string;
  quoteMint: string;
  logoUrl: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
  createdAt: Date;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

async function ensureTable() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS midcurve_launches (
      mint TEXT PRIMARY KEY,
      signature TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      creator TEXT NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      quote_mint TEXT NOT NULL DEFAULT '',
      logo_url TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      x_url TEXT NOT NULL DEFAULT '',
      telegram_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  return sql;
}

export async function saveMidcurveLaunch(input: {
  mint: string;
  signature: string;
  provider: MidcurveLaunchProvider;
  creator: string;
  name: string;
  symbol: string;
  description?: string;
  quoteMint?: string;
  logoUrl?: string;
  website?: string;
  xUrl?: string;
  telegramUrl?: string;
}): Promise<MidcurveLaunch> {
  const sql = await ensureTable();

  const rows = await sql`
    INSERT INTO midcurve_launches (
      mint,
      signature,
      provider,
      creator,
      name,
      symbol,
      description,
      quote_mint,
      logo_url,
      website,
      x_url,
      telegram_url
    )
    VALUES (
      ${input.mint},
      ${input.signature},
      ${input.provider},
      ${input.creator},
      ${input.name},
      ${input.symbol},
      ${input.description || ""},
      ${input.quoteMint || ""},
      ${input.logoUrl || ""},
      ${input.website || ""},
      ${input.xUrl || ""},
      ${input.telegramUrl || ""}
    )
    ON CONFLICT (mint)
    DO NOTHING
    RETURNING
      mint,
      signature,
      provider,
      creator,
      name,
      symbol,
      description,
      quote_mint,
      logo_url,
      website,
      x_url,
      telegram_url,
      created_at
  `;

  let row = rows[0];

  if (!row) {
    const existing = await sql`
      SELECT
        mint,
        signature,
        provider,
        creator,
        name,
        symbol,
        description,
        quote_mint,
        logo_url,
        website,
        x_url,
        telegram_url,
        created_at
      FROM midcurve_launches
      WHERE mint = ${input.mint}
      LIMIT 1
    `;

    row = existing[0];
  }

  if (!row) {
    throw new Error("Unable to save MIDCURVE launch.");
  }

  return mapLaunch(row);
}

export async function getMidcurveLaunches(
  limit = 24
): Promise<MidcurveLaunch[]> {
  const sql = await ensureTable();

  const safeLimit = Math.max(
    1,
    Math.min(100, Math.floor(limit))
  );

  const rows = await sql`
    SELECT
      mint,
      signature,
      provider,
      creator,
      name,
      symbol,
      description,
      quote_mint,
      logo_url,
      website,
      x_url,
      telegram_url,
      created_at
    FROM midcurve_launches
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map(mapLaunch);
}

function mapLaunch(row: Record<string, unknown>): MidcurveLaunch {
  return {
    mint: String(row.mint),
    signature: String(row.signature),
    provider: String(row.provider) as MidcurveLaunchProvider,
    creator: String(row.creator),
    name: String(row.name),
    symbol: String(row.symbol),
    description: String(row.description || ""),
    quoteMint: String(row.quote_mint || ""),
    logoUrl: String(row.logo_url || ""),
    website: String(row.website || ""),
    xUrl: String(row.x_url || ""),
    telegramUrl: String(row.telegram_url || ""),
    createdAt: new Date(String(row.created_at))
  };
}
