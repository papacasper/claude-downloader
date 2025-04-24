// ==UserScript==
// @name         Claude Chat Downloader (flippable dark dropdown)
// @namespace    http://tampermonkey.net/
// @version      2.1
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
// @license      MIT
// ==/UserScript==


(function() {
  'use strict';

  const API_BASE = 'https://claude.ai/api';

  // 1) Inject CSS for our custom dark, flippable dropdown
  const ddStyles = document.createElement('style');
  ddStyles.textContent = `
    .claude-format-dropdown {
      position: absolute;
      top: 0.5rem;
      right: 2.75rem;
      background: var(--bg-000);
      color: var(--text-100);
      border: 1px solid var(--border-300);
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
      background: var(--bg-000);
      color: var(--text-100);
      border: 1px solid var(--border-300);
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
    }
    .claude-format-dropdown .options > div:hover {
      background: var(--bg-500, rgba(39,39,42,0.4));
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
        headers: { 'Content-Type': 'application/json' },
        data: data ? JSON.stringify(data) : null,
        onload: r =>
          r.status >= 200 && r.status < 300
            ? resolve(JSON.parse(r.responseText))
            : reject(new Error(`Status ${r.status}`)),
        onerror: reject
      });
    });
  }
  async function getOrgId() {
    const orgs = await apiRequest('GET', '/organizations');
    return orgs[0].uuid;
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
    const fs = document.querySelector('fieldset.flex.w-full.min-w-0.flex-col');
    if (!fs) return;
    fs.style.position = 'relative';

    const dd = document.createElement('div');
    dd.className = 'claude-format-dropdown';
    dd.innerHTML = `
      <div class="selected">
        <span class="label">TXT</span>
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
        dd.querySelector('.label').textContent = fmt.toUpperCase();
        dd.classList.remove('open', 'up');
        download(fmt);
      });
    });

    fs.appendChild(dd);
  }

  // 4) Observe React re-renders
  const mo = new MutationObserver(muts => {
    if (
      muts.some(m =>
        Array.from(m.addedNodes).some(
          n =>
            n.nodeType === 1 &&
            (n.matches('fieldset.flex.w-full.min-w-0.flex-col') ||
              n.querySelector('fieldset.flex.w-full.min-w-0.flex-col'))
        )
      )
    ) {
      injectDropdown();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // initial
  injectDropdown();
})();
