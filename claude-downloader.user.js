// ==UserScript==
// @name         Claude Chat Downloader (flippable dark dropdown)
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Choose TXT/MD/JSON from a dark dropdown that flips up if needed, then click to download Claude conversations.
// @author       Papa Casper
// @homepage     https://papacasper.com
// @homepageURL  https://github.com/papacasper/claude-downloader
// @updateURL    https://raw.githubusercontent.com/PapaCasper/claude-downloader/main/claude-downloader.user.js
// @downloadURL  https://raw.githubusercontent.com/PapaCasper/claude-downloader/main/claude-downloader.user.js
// @match        https://claude.ai/chat/*
// @match        https://claude.ai/chats/*
// @match        https://claude.ai/project/*
// @match        https://claude.ai/projects/*
// @match        https://claude.ai/new*
// @match        https://claude.ai/recents*
// @grant        GM_xmlhttpRequest
// @connect      claude.ai
// @license      MIT
// ==/UserScript==


(function() {
  'use strict';

  const API_BASE = 'https://claude.ai/api';
  const IS_EDGE = /Edg/.test(navigator.userAgent);

  // 1) Inject CSS for our custom dark, flippable dropdown
  const ddStyles = document.createElement('style');
  ddStyles.textContent = `
    .claude-format-dropdown {
      position: absolute;
      top: 0.5rem;
      right: 2.75rem;
      background: var(--bg-000, #1c1c1e);
      color: var(--text-100, #e5e5e7);
      border: 1px solid var(--border-300, #3f3f44);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      z-index: 20;
      user-select: none;
    }
    .claude-format-dropdown > .selected {
      padding: 0.25rem 0.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }
    .claude-format-dropdown > .options {
      position: absolute;
      top: calc(100% + 0.125rem);
      left: 0;
      display: none;
      flex-direction: column;
      background: var(--bg-000, #1c1c1e);
      color: var(--text-100, #e5e5e7);
      border: 1px solid var(--border-300, #3f3f44);
      border-radius: 0.375rem;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .claude-format-dropdown.open > .options {
      display: flex;
    }
    .claude-format-dropdown.open.up > .options {
      top: auto;
      bottom: calc(100% + 0.125rem);
    }
    .claude-format-dropdown .options > div {
      padding: 0.5rem;
      cursor: pointer;
      background: hsl(var(--bg-100)/var(--tw-bg-opacity));;
    }
    .claude-format-dropdown .options > div:hover {
      background: hsl(var(--bg-200)/var(--tw-bg-opacity));;
    }
    .claude-format-dropdown svg {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }
    .claude-format-dropdown.open > .selected svg {
      transform: rotate(-90deg);
    }
  `;
  document.head.appendChild(ddStyles);

  // 2) API helpers
  function apiRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: `${API_BASE}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://claude.ai',
          'Referer': 'https://claude.ai/',
          'X-Requested-With': 'XMLHttpRequest'
        },
        data: data ? JSON.stringify(data) : null,
        onload: r => {
          try {
            if (r.status >= 200 && r.status < 300) {
              resolve(JSON.parse(r.responseText));
            } else {
              console.error("API request failed:", r.status, r.responseText);
              reject(new Error(`Status ${r.status}: ${r.responseText}`));
            }
          } catch (e) {
            console.error("Error parsing response:", e);
            reject(e);
          }
        },
        onerror: (e) => {
          console.error("Request error:", e);
          reject(e);
        }
      });
    });
  }

  async function getOrgId() {
    try {
      const orgs = await apiRequest('GET', '/organizations');
      return orgs[0].uuid;
    } catch (e) {
      console.error("Failed to get organization ID:", e);
      // Fallback: try to extract from page URL or localStorage
      try {
        // Check localStorage
        const localStorageData = JSON.parse(localStorage.getItem('claude-auth'));
        if (localStorageData && localStorageData.organizations && localStorageData.organizations.length > 0) {
          return localStorageData.organizations[0].uuid;
        }
      } catch (err) {
        console.error("Fallback extraction failed:", err);
      }
      throw new Error("Could not determine organization ID");
    }
  }

  async function fetchHistory(orgId, id) {
    const isProj = location.pathname.includes('/project/');
    const path = isProj
      ? `/organizations/${orgId}/projects/${id}`
      : `/organizations/${orgId}/chat_conversations/${id}`;
    return apiRequest('GET', path);
  }

  function formatData(data, fmt) {
    const msgs = data.chat_messages || data.conversations[0].chat_messages;
    if (fmt === 'json') return JSON.stringify(data, null, 2);
    if (fmt === 'txt') {
      return msgs
        .map(m => {
          const who = m.sender === 'human' ? 'User' : 'Claude';
          return `${who}:\n${m.text}\n\n`;
        })
        .join('');
    }
    let md = `# Claude Export\n*${new Date().toLocaleString()}*\n\n---\n\n`;
    msgs.forEach(m => {
      const who = m.sender === 'human' ? 'User' : 'Claude';
      md += `### ${who}\n\n${m.text}\n\n---\n\n`;
    });
    return md;
  }

  async function download(fmt) {
    try {
      const orgId = await getOrgId();
      const id = location.pathname.split('/').pop();
      const data = await fetchHistory(orgId, id);
      const text = formatData(data, fmt);
      const prefix = location.pathname.includes('/project/') ? 'project' : 'chat';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fn = `${prefix}-${stamp}.${fmt}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Download failed—see console for details.');
    }
  }

  // 3) Inject custom dropdown + flip logic
  function injectDropdown() {
    if (document.querySelector('.claude-format-dropdown')) return;

    // Use multiple selectors to be more browser-compatible
    const fieldsetSelectors = [
      'fieldset.flex.w-full.min-w-0.flex-col',
      'fieldset.w-full.flex.min-w-0.flex-col',
      'fieldset.flex-col.w-full.min-w-0',
      'fieldset[class*="flex"][class*="w-full"][class*="min-w-0"][class*="flex-col"]'
    ];

    let fs = null;
    for (const selector of fieldsetSelectors) {
      fs = document.querySelector(selector);
      if (fs) break;
    }

    if (!fs) {
      if (IS_EDGE) {
        // For Edge: try a more generic approach
        fs = document.querySelector('form fieldset');
      }
      if (!fs) return; // Still not found
    }

    fs.style.position = 'relative';

    const dd = document.createElement('div');
    dd.className = 'claude-format-dropdown';
    dd.innerHTML = `
      <div class="selected">
        <span class="label">Download Chat </span>
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 5l3 3 3-3"/>
        </svg>
      </div>
      <div class="options">
        <div data-fmt="txt">TXT</div>
        <div data-fmt="md">MD</div>
        <div data-fmt="json">JSON</div>
      </div>
    `;

    const selDiv = dd.querySelector('.selected');
    selDiv.addEventListener('click', () => {
      dd.classList.toggle('open');
      dd.classList.remove('up');
      const opts = dd.querySelector('.options');
      opts.style.display = 'flex';
      const rect = opts.getBoundingClientRect();
      opts.style.display = '';
      if (rect.bottom > window.innerHeight) {
        dd.classList.add('up');
      }
    });

    dd.querySelectorAll('.options > div').forEach(opt => {
      opt.addEventListener('click', () => {
        const fmt = opt.dataset.fmt;
        const origLabel = dd.querySelector('.label');
        origLabel.textContent = `Download ${fmt.toUpperCase()}`;

        // Reset to just "Download" after a brief delay
        setTimeout(() => {
          origLabel.textContent = "Download";
        }, 1500);

        dd.classList.remove('open', 'up');
        download(fmt);
      });
    });

    fs.appendChild(dd);

    // Add click outside to close
    document.addEventListener('click', (e) => {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open', 'up');
      }
    });
  }

  // 4) Observe React re-renders with improved robustness
  const mo = new MutationObserver(muts => {
    try {
      if (
        muts.some(m =>
          Array.from(m.addedNodes).some(
            n =>
              n.nodeType === 1 &&
              (n.matches('fieldset') ||
               n.matches('fieldset.flex.w-full.min-w-0.flex-col') ||
               n.querySelector('fieldset') ||
               n.querySelector('fieldset.flex.w-full.min-w-0.flex-col'))
          )
        )
      ) {
        setTimeout(injectDropdown, 100); // Small delay for Edge
      }
    } catch (e) {
      console.error("Error in mutation observer:", e);
    }
  });

  // Use a more reliable way to start observing
  function startObserving() {
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
      console.log("Claude Downloader: Observer started");
    } catch (e) {
      console.error("Failed to start observer:", e);
    }
  }

  // Try initial injection, with retry for Edge
  function initialSetup() {
    injectDropdown();
    if (!document.querySelector('.claude-format-dropdown')) {
      console.log("Claude Downloader: Initial injection failed, will retry...");
      setTimeout(injectDropdown, 1000);
      setTimeout(injectDropdown, 2000);
    }
  }

  // Start everything
  startObserving();
  initialSetup();
})();
