/**
 * Installs the browser APIs jsdom lacks but plugin views commonly touch (diagram and chart
 * libraries in particular), so a view renders in a test without each plugin re-creating
 * these stubs. Only fills in what is missing; safe to call repeatedly. No-op outside a DOM
 * environment (use `// @vitest-environment jsdom` in tests that render views).
 */
export function installDomPolyfills(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const scope = globalThis as Record<string, unknown>;
  // Tells React that state updates are wrapped in act() (silences its warnings).
  scope.IS_REACT_ACT_ENVIRONMENT = true;

  if (!('ResizeObserver' in scope)) {
    scope.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }

  if (!('DOMMatrixReadOnly' in scope)) {
    // Enough for libraries that read the scale/translation of a CSS `matrix(...)`.
    scope.DOMMatrixReadOnly = class {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(transform?: string) {
        const values = /matrix\(([^)]+)\)/.exec(transform ?? '')?.[1]?.split(',').map(Number);
        if (values?.length === 6 && values.every(Number.isFinite)) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = values as [
            number, number, number, number, number, number,
          ];
        }
      }
      get m11(): number {
        return this.a;
      }
      get m22(): number {
        return this.d;
      }
      get m41(): number {
        return this.e;
      }
      get m42(): number {
        return this.f;
      }
    };
  }

  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }

  // jsdom has <canvas> but no 2D context (getContext returns null). Views mostly use it to
  // measure text: give them a context whose drawing calls are no-ops and whose
  // measureText approximates a monospace width.
  if (
    typeof HTMLCanvasElement !== 'undefined' &&
    navigator.userAgent.includes('jsdom') &&
    !('__flamapyStub' in HTMLCanvasElement.prototype.getContext)
  ) {
    const getContext = function (this: HTMLCanvasElement) {
      const context: Record<string | symbol, unknown> = {
        canvas: this,
        font: '10px sans-serif',
        measureText: (text: string) => ({ width: text.length * 7 }),
      };
      return new Proxy(context, {
        get: (target, key) => (key in target ? target[key] : () => {}),
      });
    };
    HTMLCanvasElement.prototype.getContext = Object.assign(getContext, {
      __flamapyStub: true,
    }) as never;
  }

  // d3-zoom (react-d3-tree, ...) reads <svg>.width.baseVal.value, which jsdom leaves undefined.
  if (typeof SVGSVGElement !== 'undefined' && !('width' in SVGSVGElement.prototype)) {
    for (const dimension of ['width', 'height'] as const) {
      Object.defineProperty(SVGSVGElement.prototype, dimension, {
        configurable: true,
        get(this: SVGSVGElement) {
          return { baseVal: { value: Number.parseFloat(this.getAttribute(dimension) ?? '') || 0 } };
        },
      });
    }
  }
}
