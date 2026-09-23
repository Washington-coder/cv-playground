"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadOpenCv, type CV } from "@/lib/opencv";
import { FILTERS, getFilter, applyFilter } from "@/lib/filters";
import Histogram from "./Histogram";
import Slider from "./Slider";

const CATEGORIES = Array.from(new Set(FILTERS.map((f) => f.category)));
const MAX_DIMENSION = 960;

export default function CvPlayground() {
  const [cv, setCv] = useState<CV | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  const [processedVersion, setProcessedVersion] = useState(0);
  const [filterId, setFilterId] = useState<string>(FILTERS[0].id);
  const [params, setParams] = useState<Record<string, number>>({});
  const [showWebcam, setShowWebcam] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadOpenCv()
      .then((loaded) => setCv(loaded))
      .catch((err) => setCvError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    const filter = getFilter(filterId);
    const defaults: Record<string, number> = {};
    filter.params.forEach((p) => {
      defaults[p.key] = p.default;
    });
    setParams(defaults);
  }, [filterId]);

  const process = useCallback(() => {
    if (!cv || !hasImage || !originalCanvasRef.current || !processedCanvasRef.current) return;
    const filter = getFilter(filterId);
    if (filter.params.some((p) => !(p.key in params))) return;

    const src = cv.imread(originalCanvasRef.current);
    try {
      applyFilter(cv, src, filterId, params, processedCanvasRef.current);
      setProcessedVersion((v) => v + 1);
    } finally {
      src.delete();
    }
  }, [cv, hasImage, filterId, params]);

  useEffect(() => {
    process();
  }, [process]);

  const loadImageFromSource = useCallback(
    (source: CanvasImageSource, naturalWidth: number, naturalHeight: number) => {
      const canvas = originalCanvasRef.current;
      if (!canvas) return;

      const scale = Math.min(1, MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
      const width = Math.round(naturalWidth * scale);
      const height = Math.round(naturalHeight * scale);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(source, 0, 0, width, height);
      setHasImage(true);
      setImageVersion((v) => v + 1);
    },
    []
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loadImageFromSource(img, img.naturalWidth, img.naturalHeight);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [loadImageFromSource]
  );

  const closeWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setShowWebcam(false);
  }, []);

  const openWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setShowWebcam(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      alert("Não foi possível acessar a webcam. Verifique as permissões do navegador.");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    loadImageFromSource(video, video.videoWidth, video.videoHeight);
    closeWebcam();
  }, [loadImageFromSource, closeWebcam]);

  const downloadResult = useCallback(() => {
    const canvas = processedCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-playground-${filterId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [filterId]);

  const activeFilter = getFilter(filterId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          100% no navegador · OpenCV.js + WebAssembly
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          CV Playground
        </h1>
        <p className="max-w-2xl text-neutral-500">
          Envie uma imagem ou use a webcam e explore, em tempo real, operações clássicas de
          Processamento Digital de Imagens: detecção de bordas, suavização e transformações de
          histograma.
        </p>
      </header>

      {cvError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar o OpenCV.js: {cvError}
        </div>
      )}

      {!cv && !cvError && (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
          Carregando o mecanismo de visão computacional…
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">1. Imagem</h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                {hasImage ? "Trocar imagem" : "Selecionar imagem"}
              </button>
              <button
                type="button"
                onClick={openWebcam}
                className="w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Usar webcam
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">2. Filtro</h2>
            <div className="flex flex-col gap-4">
              {CATEGORIES.map((category) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {FILTERS.filter((f) => f.category === category).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilterId(f.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          filterId === f.id
                            ? "bg-indigo-600 text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className="flex flex-col gap-6">
          <div
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Original
              </p>
              <div
                className={`flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
                  dragOver ? "border-indigo-400 bg-indigo-50" : "border-neutral-200 bg-neutral-50"
                }`}
              >
                <canvas
                  ref={originalCanvasRef}
                  className={`h-auto w-full ${hasImage ? "block" : "hidden"}`}
                />
                {!hasImage && (
                  <div className="flex flex-col items-center gap-1 px-6 text-center">
                    <p className="text-sm font-medium text-neutral-500">
                      Arraste uma imagem aqui
                    </p>
                    <p className="text-xs text-neutral-400">ou use os botões ao lado</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Processado — {activeFilter.label}
                </p>
                {hasImage && (
                  <button
                    type="button"
                    onClick={downloadResult}
                    className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-700"
                  >
                    Baixar
                  </button>
                )}
              </div>
              <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl bg-neutral-50">
                <canvas
                  ref={processedCanvasRef}
                  className={`h-auto w-full ${hasImage ? "block" : "hidden"}`}
                />
                {!hasImage && (
                  <p className="px-6 text-center text-sm text-neutral-400">
                    O resultado aparecerá aqui
                  </p>
                )}
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-neutral-900">3. Parâmetros</h2>
            <p className="mb-4 text-xs text-neutral-400">{activeFilter.description}</p>
            {activeFilter.params.length === 0 ? (
              <p className="text-sm text-neutral-400">Este filtro não possui parâmetros ajustáveis.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {activeFilter.params.map((p) => (
                  <Slider
                    key={p.key}
                    label={p.label}
                    value={params[p.key] ?? p.default}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    onChange={(value) => setParams((prev) => ({ ...prev, [p.key]: value }))}
                  />
                ))}
              </div>
            )}
          </section>

          <Histogram
            originalRef={originalCanvasRef}
            processedRef={processedCanvasRef}
            originalVersion={imageVersion}
            processedVersion={processedVersion}
            hasImage={hasImage}
          />
        </main>
      </div>

      {showWebcam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Capturar da webcam</h3>
              <button
                type="button"
                onClick={closeWebcam}
                className="text-neutral-400 hover:text-neutral-600"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <video ref={videoRef} className="w-full rounded-xl bg-black" muted playsInline />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeWebcam}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Capturar foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
