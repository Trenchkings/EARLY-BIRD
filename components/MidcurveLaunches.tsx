"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type MidcurveLaunch = {
  mint: string;
  signature: string;
  provider: "pumpfun" | "stonk";
  creator: string;
  name: string;
  symbol: string;
  description: string;
  quoteMint: string;
  logoUrl: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
  createdAt: string;
};

export default function MidcurveLaunches() {
  const [launches, setLaunches] = useState<MidcurveLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadLaunches() {
      try {
        const response = await fetch(
          "/api/midcurve/launches?limit=24",
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        const body = await response.json() as {
          launches?: MidcurveLaunch[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            body.error || "Unable to load MIDCURVE launches."
          );
        }

        setLaunches(body.launches || []);
      } catch (reason) {
        if (
          reason instanceof Error &&
          reason.name !== "AbortError"
        ) {
          setError(reason.message);
        }
      } finally {
        setLoading(false);
      }
    }

    loadLaunches();

    return () => controller.abort();
  }, []);

  if (!loading && launches.length === 0 && !error) {
    return (
      <section style={{ marginTop: 60, marginBottom: 60 }}>
        <div style={{ marginBottom: 18 }}>
          <span className="badge">MIDCURVE LAUNCHES</span>

          <h2 style={{ marginTop: 12 }}>
            Fresh from MIDCURVE
          </h2>

          <p className="small">
            New tokens launched through MIDCURVE will appear here.
          </p>
        </div>

        <div className="card" style={{ textAlign: "center" }}>
          <h3>No MIDCURVE launches yet</h3>

          <p className="small" style={{ marginBottom: 0 }}>
            The next successful token launched through MIDCURVE
            will be the first token shown here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 60, marginBottom: 60 }}>
      <div style={{ marginBottom: 18 }}>
        <span className="badge">MIDCURVE LAUNCHES</span>

        <h2 style={{ marginTop: 12 }}>
          Fresh from MIDCURVE
        </h2>

        <p className="small">
          Tokens launched directly through MIDCURVE.
        </p>
      </div>

      {loading && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            Loading MIDCURVE launches...
          </p>
        </div>
      )}

      {error && (
        <div className="card">
          <p style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {!loading && !error && launches.length > 0 && (
        <div className="grid">
          {launches.map(launch => (
            <article
              className="card"
              key={launch.mint}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14
                }}
              >
                {launch.logoUrl ? (
                  <Image
                    src={launch.logoUrl}
                    alt={`${launch.name} logo`}
                    width={58}
                    height={58}
                    unoptimized
                    style={{
                      width: 58,
                      height: 58,
                      objectFit: "cover",
                      borderRadius: 14
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      flex: "0 0 58px",
                      borderRadius: 14,
                      border: "1px solid var(--line)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900,
                      fontSize: 20
                    }}
                  >
                    {launch.symbol
                      ? launch.symbol.slice(0, 2)
                      : "MC"}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0 }}>
                    {launch.name}
                  </h3>

                  <div
                    className="small"
                    style={{ marginTop: 4 }}
                  >
                    ${launch.symbol}
                  </div>
                </div>
              </div>

              <div>
                <span className="badge">
                  {launch.provider === "pumpfun"
                    ? "PUMP.FUN"
                    : "STONKFUN"}
                </span>
              </div>

              {launch.description && (
                <p
                  className="small"
                  style={{
                    margin: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical"
                  }}
                >
                  {launch.description}
                </p>
              )}

              <div className="small">
                Mint:{" "}
                {launch.mint.slice(0, 6)}...
                {launch.mint.slice(-6)}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: "auto"
                }}
              >
                <a
                  className="btn btn-primary"
                  href={`/token/${launch.mint}`}
                >
                  View token
                </a>

                {launch.website && (
                  <a
                    className="btn btn-secondary"
                    href={launch.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                )}

                {launch.xUrl && (
                  <a
                    className="btn btn-secondary"
                    href={launch.xUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    X
                  </a>
                )}

                {launch.telegramUrl && (
                  <a
                    className="btn btn-secondary"
                    href={launch.telegramUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Telegram
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
