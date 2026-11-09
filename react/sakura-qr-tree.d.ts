export type SakuraColor = 'pink' | 'purple' | 'red' | 'amber' | 'blue' | 'white';
export type SakuraMode = 'spring' | 'bloom' | 'breeze';
export type SakuraState = 'tree' | 'qr';
export type SakuraTheme = 'day' | 'dusk' | 'night';
export interface SakuraOptions {
  url?: string; color?: SakuraColor; mode?: SakuraMode; state?: SakuraState; theme?: SakuraTheme | 'auto';
  /** start as QR and grow the tree on load */ intro?: boolean; /** auto-lower quality on slow devices (default true) */ adaptive?: boolean; /** scan-to-open pill in QR state (default true) */ caption?: boolean;
  ui?: boolean; sound?: boolean; seed?: number; petals?: number; duration?: number; placeholder?: string;
  preserveDrawingBuffer?: boolean;
  encode?: ((text: string) => boolean[][]) | null;
  onToggle?: ((s: SakuraState) => void) | null;
  onShare?: ((url: string) => void) | null;
  onChange?: ((patch: { state?: SakuraState; mode?: SakuraMode; color?: SakuraColor; sound?: boolean; theme?: SakuraTheme; url?: string; quality?: number }) => void) | null;
}
export interface SakuraController {
  toggle(): void; setState(s: SakuraState, silent?: boolean, instant?: boolean): void;
  snap(s: SakuraState): void; seek(v: number): void;
  setUrl(u: string): boolean; setTheme(t: SakuraTheme | 'auto', instant?: boolean): void; exportPNG(o?: { size?: number; ink?: string }): Promise<Blob>; setColor(c: SakuraColor): void; setMode(m: SakuraMode): void; setSound(on: boolean): void;
  destroy(): void; readonly state: SakuraState; readonly theme: SakuraTheme; readonly quality: number; readonly progress: number; readonly matrix: boolean[][];
  canvas: HTMLCanvasElement; root: HTMLElement;
}
export const PALETTES: Record<SakuraColor, { swatch: string; base: string; light: string; dark: string; qr: string }>;
export function createSakuraQR(container: HTMLElement, opts?: SakuraOptions): SakuraController;
export function buildTree(seed?: number): object;
export default createSakuraQR;
