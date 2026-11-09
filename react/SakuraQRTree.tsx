'use client';
/**
 * <SakuraQRTree /> — QR code <-> voxel cherry-blossom tree.
 * Works in Next.js (App Router / Pages) and plain React. Three.js is loaded lazily on the client only.
 *
 * deps: react, three (>=0.160), qrcode-generator
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import qrcode from 'qrcode-generator';
import type { SakuraColor, SakuraController, SakuraMode, SakuraState, SakuraTheme } from './sakura-qr-tree';

export type { SakuraColor, SakuraMode, SakuraState, SakuraTheme, SakuraController } from './sakura-qr-tree';

export interface SakuraQRTreeProps {
  /** text encoded in the QR code */
  url?: string;
  color?: SakuraColor;
  mode?: SakuraMode;
  /** 'tree' | 'qr' — controlled: change it to animate the transition */
  state?: SakuraState;
  /** 'day' | 'dusk' | 'night' | 'auto' (by local time) */
  theme?: SakuraTheme | 'auto';
  /** start as QR and grow the tree on load */
  intro?: boolean;
  /** auto-lower quality on slow devices (default true) */
  adaptive?: boolean;
  /** scan-to-open pill in QR state (default true) */
  caption?: boolean;
  /** show URL input / Share / mode pill / swatches / sound toggle (default true) */
  ui?: boolean;
  sound?: boolean;
  /** tree random seed (re-creates the scene when changed) */
  seed?: number;
  petals?: number;
  /** transition seconds */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  onStateChange?: (state: SakuraState) => void;
  onUrlShare?: (url: string) => void;
  onChange?: (patch: { state?: SakuraState; mode?: SakuraMode; color?: SakuraColor; sound?: boolean; theme?: SakuraTheme; url?: string; quality?: number }) => void;
}
export type SakuraQRTreeHandle = Pick<SakuraController, 'toggle' | 'setState' | 'snap' | 'seek' | 'setUrl' | 'setColor' | 'setMode' | 'setSound' | 'setTheme' | 'exportPNG'> & { readonly controller: SakuraController | null };

function encode(text: string): boolean[][] {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

export const SakuraQRTree = forwardRef<SakuraQRTreeHandle, SakuraQRTreeProps>(function SakuraQRTree(
  { url = 'https://yoursite.com', color = 'pink', mode = 'spring', state = 'tree', theme = 'day', intro = false, adaptive = true, caption = true, ui = true, sound = false, seed = 7, petals = 460, duration = 1.7, className, style, onStateChange, onUrlShare, onChange },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<SakuraController | null>(null);
  // always-latest values, so the scene is created once and never torn down for ordinary prop changes
  const latest = useRef({ url, color, mode, state, theme, sound, onStateChange, onUrlShare, onChange });
  latest.current = { url, color, mode, state, theme, sound, onStateChange, onUrlShare, onChange };

  useEffect(() => {
    let dead = false;
    let created: SakuraController | null = null;
    (async () => {
      const { createSakuraQR } = await import('./sakura-qr-tree');
      if (dead || !host.current) return;
      const p = latest.current;
      created = createSakuraQR(host.current, {
        url: p.url, color: p.color, mode: p.mode, state: p.state, theme: p.theme, sound: p.sound, ui, seed, petals, duration, intro, adaptive, caption, encode,
        onToggle: (s) => latest.current.onStateChange?.(s),
        onShare: onUrlShare ? (u) => latest.current.onUrlShare?.(u) : null,
        onChange: (patch) => latest.current.onChange?.(patch),
      });
      ctl.current = created;
    })();
    return () => { dead = true; created?.destroy(); ctl.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui, seed, petals, duration, intro, adaptive, caption, !!onUrlShare]);

  useEffect(() => { ctl.current?.setUrl(url || 'https://yoursite.com'); }, [url]);
  useEffect(() => { ctl.current?.setColor(color); }, [color]);
  useEffect(() => { ctl.current?.setMode(mode); }, [mode]);
  useEffect(() => { ctl.current?.setTheme(theme); }, [theme]);
  useEffect(() => { ctl.current?.setState(state, true); }, [state]);
  useEffect(() => { ctl.current?.setSound(sound); }, [sound]);

  useImperativeHandle(ref, () => ({
    toggle: () => ctl.current?.toggle(),
    setState: (s, silent, instant) => ctl.current?.setState(s, silent, instant),
    snap: (s) => ctl.current?.snap(s), seek: (v) => ctl.current?.seek(v),
    setUrl: (u) => ctl.current?.setUrl(u), setColor: (c) => ctl.current?.setColor(c),
    setMode: (m) => ctl.current?.setMode(m), setSound: (b) => ctl.current?.setSound(b),
    setTheme: (t, i) => ctl.current?.setTheme(t, i), exportPNG: (o) => ctl.current ? ctl.current.exportPNG(o) : Promise.reject(new Error('SakuraQRTree is not ready yet')),
    get controller() { return ctl.current; },
  }), []);

  return <div ref={host} className={className} style={{ width: '100%', height: '100%', minHeight: 420, ...style }} />;
});

export default SakuraQRTree;
