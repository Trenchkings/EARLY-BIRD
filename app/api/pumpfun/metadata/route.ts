import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PINATA_FILES_URL = "https://uploads.pinata.cloud/v3/files";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function cleanOptionalUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

async function uploadToPinata(
  file: Blob,
  name: string,
  contentType: string,
  jwt: string
): Promise<string> {
  const form = new FormData();

  form.append(
    "file",
    new File([file], name, { type: contentType })
  );

  form.append(
    "network",
    "public"
  );

  const response = await fetch(PINATA_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`
    },
    body: form
  });

  const body = (await response.json().catch(() => null)) as
    | {
        data?: {
          cid?: string;
        };
        error?: string;
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error ||
        body?.message ||
        `Pinata upload failed (${response.status}).`
    );
  }

  const cid = body?.data?.cid;

  if (!cid) {
    throw new Error("Pinata did not return a CID.");
  }

  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export async function POST(request: Request) {
  try {
    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      return NextResponse.json(
        { error: "PINATA_JWT is not configured." },
        { status: 500 }
      );
    }

    const form = await request.formData();

    const name =
      typeof form.get("name") === "string"
        ? String(form.get("name")).trim()
        : "";

    const symbol =
      typeof form.get("symbol") === "string"
        ? String(form.get("symbol")).trim().toUpperCase()
        : "";

    const description =
      typeof form.get("description") === "string"
        ? String(form.get("description")).trim()
        : "";

    const website = cleanOptionalUrl(form.get("website"));
    const twitter = cleanOptionalUrl(form.get("twitter"));
    const telegram = cleanOptionalUrl(form.get("telegram"));

    const image = form.get("image");

    if (!name || !symbol) {
      return NextResponse.json(
        { error: "Token name and symbol are required." },
        { status: 400 }
      );
    }

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "A token logo is required." },
        { status: 400 }
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Token logo must be an image." },
        { status: 400 }
      );
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Token logo must be 2 MB or smaller." },
        { status: 400 }
      );
    }

    const imageUri = await uploadToPinata(
      image,
      image.name || `${symbol.toLowerCase()}-logo`,
      image.type || "application/octet-stream",
      jwt
    );

    const metadata = {
      name,
      symbol,
      description,
      image: imageUri,
      showName: true,
      ...(website ? { website } : {}),
      ...(twitter ? { twitter } : {}),
      ...(telegram ? { telegram } : {})
    };

    const metadataBlob = new Blob(
      [JSON.stringify(metadata)],
      { type: "application/json" }
    );

    const metadataUri = await uploadToPinata(
      metadataBlob,
      `${symbol.toLowerCase()}-metadata.json`,
      "application/json",
      jwt
    );

    return NextResponse.json({
      uri: metadataUri,
      imageUri
    });
  } catch (error) {
    console.error("PUMPFUN METADATA ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to upload Pump.fun metadata."
      },
      { status: 502 }
    );
  }
}
