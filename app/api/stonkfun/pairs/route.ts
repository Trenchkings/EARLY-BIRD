import { NextResponse } from "next/server";
import { getPairs, StonkFunError } from "../../../../lib/stonkfun-adapter";

export async function GET() {
  try {
    return NextResponse.json({ pairs: await getPairs() });
  } catch (error) {
    const status = error instanceof StonkFunError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load StonkFun pairs." }, { status });
  }
}
