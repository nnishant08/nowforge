// ─────────────────────────────────────────────────────────────────────────────
// NowForge content script
// Injected on every *.service-now.com page (document_idle, classic script).
//
// Responsibilities:
//   1. Build a PageContext from window.location and document.title
//   2. Push it to the background service worker (for the toolbar icon/badge)
//   3. Initialise Feature 1 (Instance Identity) — favicon, instance tag,
//      tab title prefix — via the orchestrator in features/instanceIdentity
//   4. Watch for SPA navigation and re-run on URL change
//   5. Respond to GET_PAGE_CONTEXT pull requests from the background
// ─────────────────────────────────────────────────────────────────────────────

console.log('[NowForge] content script loaded on', window.location.href);

import { getInstanceInfoFromUrl, parseServiceNowUrl } from '@nowforge/core';
import type { PageContext, PageType } from '../shared/messaging.js';
import type { GetPageContextResponse } from '../shared/messaging.js';
import { sendToBackground } from '../shared/messaging.js';
import { initInstanceIdentity } from './features/instanceIdentity.js';
import { initCommandBar } from './features/commandBar/index.js';

// ── Page type detection ──────────────────────────────────────────────────────

function detectPageType(url: string): PageType {
  if (/\/now\/builder\/|\/\$uib\//.test(url)) return 'ui-builder';
  if (/\/now\/flow-designer\/|\/\$flow-designer\.do/.test(url)) return 'flow-designer';
  if (/\/now\/workspace\/|\/now\/nav\//.test(url)) return 'workspace';
  if (/\/sp\b|\/esc\b|\/csm\b/.test(url)) return 'service-portal';
  if (/\/[a-z_]+_list\.do/.test(url)) return 'list';
  if (/\/[a-z_]+\.do/.test(url) && /[?&]sys_id=/.test(url)) return 'form';
  if (/\/params\/target\/[a-z_]+_list\.do/.test(url)) return 'list';
  if (/\/params\/target\/[a-z_]+\.do/.test(url)) return 'form';
  return 'other';
}

// ── Page context ─────────────────────────────────────────────────────────────

function buildPageContext(): PageContext {
  const url = window.location.href;
  const parsed = parseServiceNowUrl(url);
  const instanceInfo = getInstanceInfoFromUrl(url);
  const pageType = detectPageType(url);

  return {
    instanceInfo,
    pageType,
    tableName: parsed.tableName,
    sysId: parsed.sysId,
    url,
    title: document.title,
  };
}

// ── Global context storage ───────────────────────────────────────────────────

declare global {
  interface Window {
    __NOWFORGE_CONTEXT__?: PageContext;
  }
}

// ── Background pull-request listener ─────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: GetPageContextResponse) => void
  ) => {
    if (message.type === 'GET_PAGE_CONTEXT') {
      const context = window.__NOWFORGE_CONTEXT__ ?? buildPageContext();
      window.__NOWFORGE_CONTEXT__ = context;
      sendResponse({ context });
      return false;
    }
    return false;
  }
);

// ── Entry point ──────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  console.log('[NowForge] initialising for', window.location.hostname);

  const context = buildPageContext();
  window.__NOWFORGE_CONTEXT__ = context;
  sendToBackground({ type: 'CONTENT_SCRIPT_READY', context });

  // Wait for body before mounting the floating tag
  if (!document.body) {
    await new Promise<void>((resolve) => {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    });
  }

  // Initialise Feature 1 — returns a function we call on every SPA nav
  const refreshIdentity = await initInstanceIdentity(context);

  // Initialise Feature 2 — Cmd/Ctrl+K command bar
  const refreshCommandBar = initCommandBar(context);

  // SPA navigation: ServiceNow heavily uses pushState
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[NowForge] SPA navigation detected →', lastUrl);
      const updated = buildPageContext();
      window.__NOWFORGE_CONTEXT__ = updated;
      sendToBackground({ type: 'PAGE_CONTEXT_UPDATED', context: updated });
      void refreshIdentity(updated);
      refreshCommandBar(updated);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

void init();
