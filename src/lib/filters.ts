import type { CV } from "./opencv";

export type ParamDef = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
};

export type FilterCategory = "Bordas" | "Suavização" | "Histograma / Contraste";

export type FilterDef = {
  id: string;
  label: string;
  category: FilterCategory;
  description: string;
  params: ParamDef[];
};

export const FILTERS: FilterDef[] = [
  {
    id: "canny",
    label: "Canny",
    category: "Bordas",
    description: "Detecção de bordas por gradiente com histerese de dois limiares.",
    params: [
      { key: "t1", label: "Limiar 1", min: 0, max: 255, step: 1, default: 50 },
      { key: "t2", label: "Limiar 2", min: 0, max: 255, step: 1, default: 150 },
    ],
  },
  {
    id: "sobel",
    label: "Sobel",
    category: "Bordas",
    description: "Gradiente direcional (X e Y combinados) via kernel de Sobel.",
    params: [{ key: "ksize", label: "Tamanho do kernel", min: 1, max: 7, step: 2, default: 3 }],
  },
  {
    id: "laplacian",
    label: "Laplaciano",
    category: "Bordas",
    description: "Detecção de bordas por derivada de segunda ordem.",
    params: [{ key: "ksize", label: "Tamanho do kernel", min: 1, max: 7, step: 2, default: 3 }],
  },
  {
    id: "gaussian",
    label: "Filtro Gaussiano",
    category: "Suavização",
    description: "Suavização/redução de ruído com kernel Gaussiano.",
    params: [
      { key: "ksize", label: "Raio do kernel", min: 1, max: 31, step: 2, default: 5 },
      { key: "sigma", label: "Sigma", min: 0, max: 20, step: 0.5, default: 0 },
    ],
  },
  {
    id: "median",
    label: "Filtro de Mediana",
    category: "Suavização",
    description: "Substitui cada pixel pela mediana da vizinhança — ótimo contra ruído sal-e-pimenta.",
    params: [{ key: "ksize", label: "Tamanho do kernel", min: 1, max: 15, step: 2, default: 5 }],
  },
  {
    id: "mean",
    label: "Filtro de Média",
    category: "Suavização",
    description: "Suavização simples pela média dos pixels vizinhos (box blur).",
    params: [{ key: "ksize", label: "Tamanho do kernel", min: 1, max: 31, step: 2, default: 5 }],
  },
  {
    id: "brighten",
    label: "Clarear",
    category: "Histograma / Contraste",
    description: "Aumenta o brilho da imagem somando um valor fixo às intensidades dos pixels.",
    params: [
      { key: "amount", label: "Intensidade do clareamento", min: 0, max: 100, step: 1, default: 50 },
    ],
  },
  {
    id: "contrast_expand",
    label: "Expansão de Contraste Linear",
    category: "Histograma / Contraste",
    description:
      "Estica linearmente a faixa de intensidades [entrada mín, entrada máx] para o intervalo total [0, 255], aumentando o contraste.",
    params: [
      { key: "inLow", label: "Entrada mínima", min: 0, max: 254, step: 1, default: 50 },
      { key: "inHigh", label: "Entrada máxima", min: 1, max: 255, step: 1, default: 200 },
    ],
  },
  {
    id: "contrast_compress",
    label: "Compressão de Contraste Linear",
    category: "Histograma / Contraste",
    description:
      "Comprime linearmente a faixa total [0, 255] no intervalo [saída mín, saída máx], reduzindo o contraste.",
    params: [
      { key: "outLow", label: "Saída mínima", min: 0, max: 254, step: 1, default: 50 },
      { key: "outHigh", label: "Saída máxima", min: 1, max: 255, step: 1, default: 200 },
    ],
  },
  {
    id: "equalize",
    label: "Equalização de Histograma",
    category: "Histograma / Contraste",
    description: "Redistribui as intensidades para melhorar o contraste global (em escala de cinza).",
    params: [],
  },
  {
    id: "threshold",
    label: "Limiarização Binária",
    category: "Histograma / Contraste",
    description: "Converte a imagem em preto e branco a partir de um limiar fixo.",
    params: [{ key: "thresh", label: "Limiar", min: 0, max: 255, step: 1, default: 127 }],
  },
  {
    id: "otsu",
    label: "Limiarização de Otsu",
    category: "Histograma / Contraste",
    description: "Encontra automaticamente o melhor limiar de binarização.",
    params: [],
  },
];

export function getFilter(id: string): FilterDef {
  const filter = FILTERS.find((f) => f.id === id);
  if (!filter) throw new Error(`Filtro desconhecido: ${id}`);
  return filter;
}

function oddAtLeast1(n: number): number {
  const v = Math.max(1, Math.round(n));
  return v % 2 === 0 ? v + 1 : v;
}

/**
 * Aplica o filtro selecionado sobre a imagem de origem (Mat RGBA) e desenha
 * o resultado no canvas de destino. Cuida da liberação de memória dos Mats
 * intermediários (o WASM do OpenCV não usa garbage collector).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilter(
  cv: CV,
  src: any,
  filterId: string,
  params: Record<string, number>,
  outputCanvas: HTMLCanvasElement
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mats: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = <T = any>(mat: T): T => {
    mats.push(mat);
    return mat;
  };

  try {
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (filterId) {
      case "canny": {
        const dst = track(new cv.Mat());
        cv.Canny(gray, dst, params.t1, params.t2);
        result = dst;
        break;
      }
      case "sobel": {
        const ksize = oddAtLeast1(params.ksize);
        const gx = track(new cv.Mat());
        const gy = track(new cv.Mat());
        cv.Sobel(gray, gx, cv.CV_16S, 1, 0, ksize);
        cv.Sobel(gray, gy, cv.CV_16S, 0, 1, ksize);
        const absX = track(new cv.Mat());
        const absY = track(new cv.Mat());
        cv.convertScaleAbs(gx, absX);
        cv.convertScaleAbs(gy, absY);
        const dst = track(new cv.Mat());
        cv.addWeighted(absX, 0.5, absY, 0.5, 0, dst);
        result = dst;
        break;
      }
      case "laplacian": {
        const ksize = oddAtLeast1(params.ksize);
        const lap = track(new cv.Mat());
        cv.Laplacian(gray, lap, cv.CV_16S, ksize);
        const dst = track(new cv.Mat());
        cv.convertScaleAbs(lap, dst);
        result = dst;
        break;
      }
      case "gaussian": {
        const ksize = oddAtLeast1(params.ksize);
        const dst = track(new cv.Mat());
        cv.GaussianBlur(src, dst, new cv.Size(ksize, ksize), params.sigma);
        result = dst;
        break;
      }
      case "median": {
        const ksize = oddAtLeast1(params.ksize);
        const rgb = track(new cv.Mat());
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        const dst = track(new cv.Mat());
        cv.medianBlur(rgb, dst, ksize);
        result = dst;
        break;
      }
      case "mean": {
        const ksize = oddAtLeast1(params.ksize);
        const dst = track(new cv.Mat());
        cv.blur(src, dst, new cv.Size(ksize, ksize));
        result = dst;
        break;
      }
      case "brighten": {
        const rgb = track(new cv.Mat());
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        const dst = track(new cv.Mat());
        rgb.convertTo(dst, -1, 1, params.amount);
        result = dst;
        break;
      }
      case "contrast_expand": {
        const inLow = Math.min(params.inLow, params.inHigh - 1);
        const inHigh = Math.max(params.inHigh, inLow + 1);
        const alpha = 255 / (inHigh - inLow);
        const beta = -inLow * alpha;
        const rgb = track(new cv.Mat());
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        const dst = track(new cv.Mat());
        rgb.convertTo(dst, -1, alpha, beta);
        result = dst;
        break;
      }
      case "contrast_compress": {
        const outLow = Math.min(params.outLow, params.outHigh - 1);
        const outHigh = Math.max(params.outHigh, outLow + 1);
        const alpha = (outHigh - outLow) / 255;
        const beta = outLow;
        const rgb = track(new cv.Mat());
        cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
        const dst = track(new cv.Mat());
        rgb.convertTo(dst, -1, alpha, beta);
        result = dst;
        break;
      }
      case "equalize": {
        const dst = track(new cv.Mat());
        cv.equalizeHist(gray, dst);
        result = dst;
        break;
      }
      case "threshold": {
        const dst = track(new cv.Mat());
        cv.threshold(gray, dst, params.thresh, 255, cv.THRESH_BINARY);
        result = dst;
        break;
      }
      case "otsu": {
        const dst = track(new cv.Mat());
        cv.threshold(gray, dst, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        result = dst;
        break;
      }
      default: {
        result = track(src.clone());
        break;
      }
    }

    if (result.channels() === 1) {
      const display = track(new cv.Mat());
      cv.cvtColor(result, display, cv.COLOR_GRAY2RGBA);
      cv.imshow(outputCanvas, display);
    } else if (result.channels() === 3) {
      const display = track(new cv.Mat());
      cv.cvtColor(result, display, cv.COLOR_RGB2RGBA);
      cv.imshow(outputCanvas, display);
    } else {
      cv.imshow(outputCanvas, result);
    }
  } finally {
    mats.forEach((mat) => mat.delete());
  }
}
