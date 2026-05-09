/**
 * Collects browser-side performance metrics from the Performance API.
 * Lives in the content script so the same window/document the user is on
 * is the one being measured.
 */

export interface PageLoadMetrics {
  url: string;
  /** ms from navigationStart */
  domContentLoaded: number;
  loadEvent: number;
  ttfb: number;
  largestContentfulPaint?: number;
  resourceCount: number;
  totalTransferSize: number;
}

export interface ResourceMetric {
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
}

export interface ClientScriptTiming {
  name: string;
  duration: number;
}

export interface PerfSnapshot {
  timestamp: number;
  pageLoad: PageLoadMetrics | null;
  resources: ResourceMetric[];
  scripts: ClientScriptTiming[];
}

export function collectSnapshot(): PerfSnapshot {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const lcp = (() => {
    try {
      const entries = performance.getEntriesByType('largest-contentful-paint');
      const last = entries[entries.length - 1] as PerformanceEntry | undefined;
      return last?.startTime;
    } catch { return undefined; }
  })();

  const pageLoad: PageLoadMetrics | null = nav
    ? {
        url: window.location.href,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadEvent: nav.loadEventEnd - nav.startTime,
        ttfb: nav.responseStart - nav.requestStart,
        largestContentfulPaint: lcp,
        resourceCount: resources.length,
        totalTransferSize: resources.reduce((a, r) => a + (r.transferSize || 0), 0),
      }
    : null;

  return {
    timestamp: Date.now(),
    pageLoad,
    resources: resources.slice(-50).map((r) => ({
      name: r.name,
      initiatorType: r.initiatorType,
      duration: r.duration,
      transferSize: r.transferSize || 0,
    })),
    scripts: [],
  };
}

/** Persist most recent snapshot for the side panel to read. */
const STORAGE_KEY = 'nowforge_perf_snapshot';

export function publishSnapshot(): void {
  const snap = collectSnapshot();
  try {
    void chrome.storage.local.set({ [STORAGE_KEY]: snap });
  } catch { /* storage might be unavailable in non-extension contexts */ }
}

/** Initialise: emit a snapshot on load + when LCP arrives. */
export function initPerformanceCollector(): void {
  if (document.readyState === 'complete') {
    setTimeout(publishSnapshot, 200);
  } else {
    window.addEventListener('load', () => setTimeout(publishSnapshot, 200), { once: true });
  }

  try {
    const observer = new PerformanceObserver(() => publishSnapshot());
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* not all browsers support */ }
}

export const PERF_STORAGE_KEY = STORAGE_KEY;
