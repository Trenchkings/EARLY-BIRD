import { NextResponse } from "next/server";

const PAIRS_URL = "https://www.stonkfun.xyz/api/public/v1/pairs";

export async function GET() {
  try {
    const response = await fetch(PAIRS_URL, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "Unable to load StonkFun pairs." }, { status: 502 });
    const rows = Array.isArray(data) ? data : data?.data || data?.pairs || [];
    const pairs = Array.isArray(rows)
      ? rows.filter((pair: any) => pair?.mint && pair?.symbol && pair?.launchable !== false && pair?.launchLabReady !== false)
      : [];
    return NextResponse.json({ pairs });
  } catch {
    return NextResponse.json({ error: "Unable to load StonkFun pairs." }, { status: 502 });
  }
}
