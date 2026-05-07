import type { PageContext } from '../shared/messaging.js';
import type { ExtensionMessage, GetPageContextResponse } from '../shared/messaging.js';

// Map of tabId → PageContext
const tabContextMap = new Map<number, PageContext>();

const ENV_COLORS: Record<string, string> = {
  dev: '#34c759',
  test: '#ff9f0a',
  uat: '#af52de',
  staging: '#5856d6',
  prod: '#ff453a',
  unknown: '#8e8e93',
};

// ── Dynamic icon generation ───────────────────────────────────────────────────

/**
 * Generate a colored-circle extension icon with the instance's 2-letter
 * initials. Uses OffscreenCanvas (available in MV3 service workers).
 * Returns a size→ImageData map suitable for chrome.action.setIcon().
 */
function generateExtensionIcon(
  instanceName: string,
  envType: string
): { [size: number]: ImageData } {
  const bgColor = ENV_COLORS[envType] ?? '#8e8e93';
  const initials = instanceName.slice(0, 2).toUpperCase();
  const result: { [size: number]: ImageData } = {};

  for (const size of [16, 32, 48]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    // Filled circle
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle inner ring so the icon reads against both light and dark toolbars
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(1, size / 16);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();

    // White initials
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.38)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Nudge down by 1px at larger sizes for optical centering
    ctx.fillText(initials, size / 2, Math.round(size / 2) + (size >= 32 ? 1 : 0));

    result[size] = ctx.getImageData(0, 0, size, size);
  }

  return result;
}

// ── Tab appearance update ─────────────────────────────────────────────────────

function updateTabAppearance(tabId: number, context: PageContext): void {
  const envType = context.instanceInfo?.environmentType ?? 'unknown';
  const instanceName = context.instanceInfo?.instanceName ?? '';

  // 1. Text badge (3-letter abbreviation + env color background)
  void chrome.action.setBadgeText({
    tabId,
    text: instanceName ? instanceName.slice(0, 3).toUpperCase() : '',
  });
  void chrome.action.setBadgeBackgroundColor({
    tabId,
    color: ENV_COLORS[envType] ?? '#8e8e93',
  });

  // 2. Replace the static "NF" icon with a per-instance colored-circle icon.
  //    This uses the extension action API — completely CSP-independent.
  if (instanceName) {
    try {
      const imageData = generateExtensionIcon(instanceName, envType);
      chrome.action.setIcon({ tabId, imageData }).catch(() => {
        // setIcon can fail if the tab is discarded — ignore
      });
    } catch (e) {
      // OffscreenCanvas unavailable (shouldn't happen in MV3, but be safe)
      console.warn('[NowForge BG] generateExtensionIcon failed:', e);
    }
  } else {
    // Not a SN page — reset to the default static icon
    chrome.action.setIcon({ tabId, path: { 16: '/icons/icon16.png', 48: '/icons/icon48.png', 128: '/icons/icon128.png' } }).catch(() => {});
  }
}

// ── Active-tab context lookup ─────────────────────────────────────────────────

/**
 * Returns the cached PageContext for the active tab, or asks the content
 * script directly if we have no cached entry (handles tabs open before the
 * extension was loaded, and the popup-window vs browser-window edge-case).
 */
function getActiveTabContext(): Promise<PageContext | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) { resolve(null); return; }

      const tabId = tab.id;
      const cached = tabContextMap.get(tabId);
      if (cached) { resolve(cached); return; }

      chrome.tabs.sendMessage(
        tabId,
        { type: 'GET_PAGE_CONTEXT' } as ExtensionMessage,
        (response: GetPageContextResponse | undefined) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const ctx = response?.context ?? null;
          if (ctx) {
            tabContextMap.set(tabId, ctx);
            updateTabAppearance(tabId, ctx);
          }
          resolve(ctx);
        }
      );
    });
  });
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    const tabId = sender.tab?.id;

    if (message.type === 'CONTENT_SCRIPT_READY' || message.type === 'PAGE_CONTEXT_UPDATED') {
      if (tabId !== undefined) {
        tabContextMap.set(tabId, message.context);
        updateTabAppearance(tabId, message.context);
      }
      return false;
    }

    if (message.type === 'GET_PAGE_CONTEXT') {
      getActiveTabContext()
        .then((context) => sendResponse({ context } as GetPageContextResponse))
        .catch(() => sendResponse({ context: null }));
      return true; // keep channel open for async sendResponse
    }

    return false;
  }
);

// ── Lifecycle ─────────────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  tabContextMap.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && !changeInfo.url.includes('.service-now.com')) {
    tabContextMap.delete(tabId);
    void chrome.action.setBadgeText({ tabId, text: '' });
    // Reset icon to default NF icon when leaving a SN page
    chrome.action.setIcon({
      tabId,
      path: { 16: '/icons/icon16.png', 48: '/icons/icon48.png', 128: '/icons/icon128.png' },
    }).catch(() => {});
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => {});

// Forward the Cmd/Ctrl+K shortcut declared in manifest.commands to the active
// tab's content script. The content script also has its own keydown listener
// as a backup, so we have redundancy if the user remaps or disables this.
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-command-bar') return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (typeof tabId !== 'number') return;
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_COMMAND_BAR' }).catch(() => {
      // Tab is not a SN page (no content script) — ignore
    });
  });
});
