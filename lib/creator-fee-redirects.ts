import { neon } from "@neondatabase/serverless";

export type CreatorFeeRedirect = {
  creator: string;
  tokenMint: string;
  recipient: string;
  createdAt: Date;
  updatedAt: Date;
};

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  return neon(databaseUrl);
}

async function ensureTable() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS creator_fee_redirects (
      creator TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      recipient TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (creator, token_mint)
    )
  `;

  return sql;
}

export async function saveCreatorFeeRedirect(
  creator: string,
  tokenMint: string,
  recipient: string
): Promise<CreatorFeeRedirect> {
  const sql = await ensureTable();

  const rows = await sql`
    INSERT INTO creator_fee_redirects (
      creator,
      token_mint,
      recipient
    )
    VALUES (
      ${creator},
      ${tokenMint},
      ${recipient}
    )
    ON CONFLICT (creator, token_mint)
    DO UPDATE SET
      recipient = EXCLUDED.recipient,
      updated_at = NOW()
    RETURNING
      creator,
      token_mint,
      recipient,
      created_at,
      updated_at
  `;

  const row = rows[0];

  if (!row) {
    throw new Error(
      "Unable to save creator fee redirect."
    );
  }

  return {
    creator: String(row.creator),
    tokenMint: String(row.token_mint),
    recipient: String(row.recipient),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}

export async function getCreatorFeeRedirect(
  creator: string,
  tokenMint: string
): Promise<CreatorFeeRedirect | null> {
  const sql = await ensureTable();

  const rows = await sql`
    SELECT
      creator,
      token_mint,
      recipient,
      created_at,
      updated_at
    FROM creator_fee_redirects
    WHERE creator = ${creator}
      AND token_mint = ${tokenMint}
    LIMIT 1
  `;

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    creator: String(row.creator),
    tokenMint: String(row.token_mint),
    recipient: String(row.recipient),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at))
  };
}
