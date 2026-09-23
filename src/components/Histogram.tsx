"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type HistogramProps = {
  originalRef: RefObject<HTMLCanvasElement | null>;
  processedRef: RefObject<HTMLCanvasElement | null>;
  originalVersion: number;
  processedVersion: number;
  hasImage: boolean;
};

const CHANNELS = [
  { offset: 0, fill: "rgba(239, 68, 68, 0.55)", legendClass: "bg-red-500", label: "R" },
  { offset: 1, fill: "rgba(34, 197, 94, 0.55)", legendClass: "bg-green-500", label: "G" },
  { offset: 2, fill: "rgba(59, 130, 246, 0.55)", legendClass: "bg-blue-500", label: "B" },
] as const;

const BIN_COUNT = 256;
const CHART_HEIGHT = 140;

type Tab = "original" | "processado";

const TABS: { id: Tab; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "processado", label: "Processado" },
];

function drawHistogram(source: HTMLCanvasElement, chart: HTMLCanvasElement): void {
  const sourceCtx = source.getContext("2d");
  if (!sourceCtx || !source.width || !source.height) return;

  const { data } = sourceCtx.getImageData(0, 0, source.width, source.height);
  const bins = CHANNELS.map(() => new Uint32Array(BIN_COUNT));
  let sampled = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    sampled++;
    for (let c = 0; c < CHANNELS.length; c++) {
      bins[c][data[i + CHANNELS[c].offset]]++;
    }
  }
  if (sampled === 0) return;

  let maxCount = 0;
  for (const channel of bins) {
    for (let bin = 0; bin < BIN_COUNT; bin++) {
      if (channel[bin] > maxCount) maxCount = channel[bin];
    }
  }
  if (maxCount === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const width = chart.clientWidth || 320;
  chart.width = Math.round(width * dpr);
  chart.height = Math.round(CHART_HEIGHT * dpr);

  const ctx = chart.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, CHART_HEIGHT);

  const binWidth = width / BIN_COUNT;
  const usableHeight = CHART_HEIGHT - 6;

  for (let c = 0; c < CHANNELS.length; c++) {
    ctx.beginPath();
    ctx.moveTo(0, CHART_HEIGHT);
    for (let bin = 0; bin < BIN_COUNT; bin++) {
      const y = CHART_HEIGHT - (bins[c][bin] / maxCount) * usableHeight;
      ctx.lineTo(bin * binWidth, y);
      ctx.lineTo((bin + 1) * binWidth, y);
    }
    ctx.lineTo(width, CHART_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = CHANNELS[c].fill;
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.moveTo(0, CHART_HEIGHT - 0.5);
  ctx.lineTo(width, CHART_HEIGHT - 0.5);
  ctx.stroke();
}

export default function Histogram({
  originalRef,
  processedRef,
  originalVersion,
  processedVersion,
  hasImage,
}: HistogramProps) {
  const [tab, setTab] = useState<Tab>("original");
  const chartRef = useRef<HTMLCanvasElement>(null);

  const processedReady = processedVersion > 0;
  const activeTab: Tab = tab === "processado" && !processedReady ? "original" : tab;

  useEffect(() => {
    if (!hasImage) return;
    const source = (activeTab === "original" ? originalRef : processedRef).current;
    const chart = chartRef.current;
    if (!source || !chart) return;
    drawHistogram(source, chart);
  }, [activeTab, hasImage, originalVersion, processedVersion, originalRef, processedRef]);

  const emptyMessage =
    activeTab === "processado" && !processedReady
      ? "Selecione um filtro para visualizar o histograma"
      : "Envie uma imagem para visualizar o histograma";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Histograma
          </p>
          <div className="flex rounded-lg bg-neutral-100 p-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  activeTab === t.id
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {CHANNELS.map((c) => (
            <span key={c.offset} className="flex items-center gap-1 text-xs text-neutral-500">
              <span className={`h-2 w-2 rounded-full ${c.legendClass}`} />
              {c.label}
            </span>
          ))}
        </div>
      </div>
      {hasImage && (activeTab === "original" || processedReady) ? (
        <canvas ref={chartRef} className="block h-[140px] w-full" />
      ) : (
        <div className="flex h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50">
          <p className="text-sm text-neutral-400">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
