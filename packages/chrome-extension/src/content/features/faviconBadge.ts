import type { EnvironmentType } from '@nowforge/core';
import type { EnvColorMap } from '../../shared/settings.js';

/**
 * Generates a colored-circle PNG with the instance's 2-letter initials and
 * sets it as the page's favicon. Cached per (instance, env, color) so we
 * don't re-encode on every SPA navigation.
 *
 * If the page's CSP blocks `data:` URLs as <link rel="icon"> (some SN tenants
 * do), this fails silently — the toolbar icon swap performed by the background
 * service worker is the resilient fallback.
 */

const dataUrlCache = new Map<string, string>();

function cacheKey(instanceName: string, envType: string, color: string): string {
  return `${instanceName}|${envType}|${color}`;
}

function buildDataUrl(initials: string, color: string, size: number): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Filled circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle inner ring for contrast
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, size / 16);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();

    // White initials
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.42)}px -apple-system, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Tiny optical nudge down
    ctx.fillText(initials, size / 2, size / 2 + Math.max(1, size / 32));

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function injectLink(rel: string, href: string, sizes?: string): void {
  const link = document.createElement('link');
  link.rel = rel;
  link.type = 'image/png';
  link.href = href;
  if (sizes) link.setAttribute('sizes', sizes);
  document.head.appendChild(link);
}

/**
 * Replace all existing favicon links with our generated ones (16×16 + 32×32).
 * Returns true if the data URLs were generated successfully (regardless of
 * whether CSP allowed the <link> insertion).
 */
export function applyFaviconBadge(
  instanceName: string,
  envType: EnvironmentType,
  envColors: EnvColorMap
): boolean {
  const initials = instanceName.slice(0, 2).toUpperCase();
  const color = envColors[envType] ?? envColors.unknown;

  let url16 = dataUrlCache.get(cacheKey(instanceName, envType, color) + '|16');
  let url32 = dataUrlCache.get(cacheKey(instanceName, envType, color) + '|32');

  if (!url16) {
    const generated = buildDataUrl(initials, color, 16);
    if (!generated) return false;
    url16 = generated;
    dataUrlCache.set(cacheKey(instanceName, envType, color) + '|16', url16);
  }
  if (!url32) {
    const generated = buildDataUrl(initials, color, 32);
    if (!generated) return false;
    url32 = generated;
    dataUrlCache.set(cacheKey(instanceName, envType, color) + '|32', url32);
  }

  try {
    document.querySelectorAll('link[rel*="icon"]').forEach((el) => el.remove());
    injectLink('icon', url16, '16x16');
    injectLink('icon', url32, '32x32');
    injectLink('shortcut icon', url32);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-apply the favicon a few times after navigation, since SN sometimes
 * inserts its own <link rel="icon"> late during SPA hydration.
 */
export function applyFaviconWithRetries(
  instanceName: string,
  envType: EnvironmentType,
  envColors: EnvColorMap
): void {
  applyFaviconBadge(instanceName, envType, envColors);
  setTimeout(() => applyFaviconBadge(instanceName, envType, envColors), 800);
  setTimeout(() => applyFaviconBadge(instanceName, envType, envColors), 2500);
}
