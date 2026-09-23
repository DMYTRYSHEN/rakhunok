import { initWasm, Resvg } from '@resvg/resvg-wasm';

let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

async function ensureWasmInitialized(): Promise<void> {
  if (wasmInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      // 1. Try Cloudflare Worker WebAssembly module import first
      try {
        // @ts-expect-error wrangler wasm import
        const mod = await import('@resvg/resvg-wasm/index_bg.wasm');
        const resvgWasm = mod.default || mod;
        if (resvgWasm && (resvgWasm instanceof WebAssembly.Module || resvgWasm instanceof ArrayBuffer || ArrayBuffer.isView(resvgWasm))) {
          await initWasm(resvgWasm);
          wasmInitialized = true;
          return;
        }
      } catch {
        // Fall back to filesystem reading in Node test/local runners
      }

      // 2. Node.js environment fallback
      try {
        const fs = await import('node:fs');
        const { createRequire } = await import('node:module');
        const baseHref = typeof import.meta.url === 'string' && import.meta.url ? import.meta.url : `file://${process.cwd()}/`;
        const require = createRequire(baseHref);
        const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
        const wasmBuffer = fs.readFileSync(wasmPath);
        await initWasm(wasmBuffer);
        wasmInitialized = true;
        return;
      } catch (err: unknown) {
        throw new Error(`Failed to initialize resvg WASM: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }
  return initPromise;
}

export async function convertSvgToPng(svgString: string, size: number): Promise<Uint8Array> {
  await ensureWasmInitialized();

  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'width',
      value: size
    }
  });

  const rendered = resvg.render();
  return rendered.asPng();
}
