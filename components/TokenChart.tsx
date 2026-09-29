"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type UTCTimestamp
} from "lightweight-charts";

type Props = {
  mint: string;
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export default function TokenChart({ mint }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 350,

      layout: {
        background: {
          type: ColorType.Solid,
          color: "transparent"
        },
        textColor: "#9fb7c7"
      },

      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.05)"
        },
        horzLines: {
          color: "rgba(255,255,255,0.05)"
        }
      },

      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.12)"
      },

      timeScale: {
        borderColor: "rgba(255,255,255,0.12)",
        timeVisible: true,
        secondsVisible: false
      }
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350"
    });

    let cancelled = false;

    async function loadCandles() {
      try {
        setError("");

        const to = Date.now();

        const response = await fetch(
          `https://datapi.jup.ag/v2/charts/${encodeURIComponent(
            mint
          )}?interval=5_MINUTE&candles=120&type=price&to=${to}`,
          {
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(`Chart API returned ${response.status}`);
        }

        const body = await response.json();

        if (!Array.isArray(body.candles)) {
          throw new Error("No candle data returned.");
        }

        const data = (body.candles as Candle[])
          .filter(
            candle =>
              Number.isFinite(candle.time) &&
              Number.isFinite(candle.open) &&
              Number.isFinite(candle.high) &&
              Number.isFinite(candle.low) &&
              Number.isFinite(candle.close)
          )
          .map(candle => ({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          }))
          .sort((a, b) => Number(a.time) - Number(b.time));

        if (cancelled) return;

        candleSeries.setData(data);
        chart.timeScale().fitContent();
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load chart."
          );
        }
      }
    }

    loadCandles();

    const interval = window.setInterval(loadCandles, 15000);

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];

      if (!entry) return;

      chart.applyOptions({
        width: entry.contentRect.width
      });
    });

    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [mint]);

  return (
    <div style={{ marginTop: 18 }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          minHeight: 350,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)"
        }}
      />

      {error && (
        <p className="small" style={{ marginTop: 10 }}>
          Chart unavailable: {error}
        </p>
      )}
    </div>
  );
}
