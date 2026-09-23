// A tipagem oficial do OpenCV.js é extremamente extensa (centenas de classes
// geradas via Embind). Para manter o código pragmático, tratamos a instância
// do módulo como `any` e confiamos na documentação/uso em runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;

let cvPromise: Promise<CV> | null = null;

/**
 * Carrega o OpenCV.js (WebAssembly) uma única vez e resolve quando o runtime
 * estiver pronto para uso. Deve ser chamado apenas no cliente (browser).
 */
export function loadOpenCv(): Promise<CV> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV.js só pode ser carregado no navegador."));
  }

  if (!cvPromise) {
    cvPromise = (async () => {
      const mod = await import("@techstark/opencv-js");
      const cvModule = (mod as { default?: unknown }).default ?? mod;

      if (cvModule instanceof Promise) {
        return (await cvModule) as CV;
      }

      const cvAny = cvModule as { onRuntimeInitialized?: () => void; Mat?: unknown };
      if (cvAny.Mat) {
        return cvAny as CV;
      }

      return new Promise<CV>((resolve) => {
        cvAny.onRuntimeInitialized = () => resolve(cvAny as CV);
      });
    })();
  }

  return cvPromise;
}
