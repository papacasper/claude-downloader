// ==UserScript==
// @name         Claude Chat Downloader
// @namespace    http://tampermonkey.net/
// @version      2.0 alpha
// @description  Add download button to save Claude AI conversations in TXT, MD, or JSON format
// @author       Papa Casper
// @homepage     https://papacasper.com
// @repository   https://github.com/PapaCasper/claude-downloader
// @source       https://github.com/PapaCasper/claude-downloader
// @supportURL   https://github.com/PapaCasper/claude-downloader/issues
// @match        https://claude.ai/chat/*
// @match        https://claude.ai/chats/*
// @match        https://claude.ai/project/*
// @match        https://claude.ai/projects/*
// @match        https://claude.ai/new*
// @match        https://claude.ai/recents*
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

;(function() {
  'use strict';

  const API_BASE = 'https://claude.ai/api';

  // ---- API helpers ----
  function apiRequest(method, url, data = null) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        method,
        url: `${API_BASE}${url}`,
        headers: { 'Content-Type': 'application/json' },
        data: data ? JSON.stringify(data) : null,
        onload: r => (r.status >= 200 && r.status < 300)
          ? res(JSON.parse(r.responseText))
          : rej(new Error(r.statusText)),
        onerror: rej
      });
    });
  }

  async function getOrgId() {
    const orgs = await apiRequest('GET','/organizations');
    return orgs[0].uuid;
  }

  async function fetchHistory(orgId, id) {
    const path = window.location.pathname.includes('/project/')
      ? `/organizations/${orgId}/projects/${id}`
      : `/organizations/${orgId}/chat_conversations/${id}`;
    return apiRequest('GET', path);
  }

  function formatData(data, fmt) {
    const msgs = data.chat_messages || data.conversations[0].chat_messages;
    if (fmt === 'json') return JSON.stringify(data, null, 2);

    // Plain‑text
    if (fmt === 'txt') {
      return msgs.map(m=>{
        const who = m.sender === 'human' ? 'User' : 'Claude';
        return `${who}:\n${m.text}\n\n`;
      }).join('');
    }

    // Markdown
    let md = `# Claude Export\n*${new Date().toLocaleString()}*\n\n---\n\n`;
    msgs.forEach(m=>{
      const who = m.sender === 'human' ? 'User' : 'Claude';
      md += `### ${who}\n\n${m.text}\n\n---\n\n`;
    });
    return md;
  }

  async function download(fmt) {
    try {
      const orgId = await getOrgId();
      const id    = location.pathname.split('/').pop();
      const data  = await fetchHistory(orgId, id);
      const blob  = new Blob(
        [ formatData(data, fmt) ],
        { type: 'text/plain' }
      );

      const namePrefix = location.pathname.includes('/project/') ? 'project' : 'chat';
      const filename   = `${namePrefix}-${new Date().toISOString().replace(/[:.]/g,'-')}.${fmt}`;

      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to download — see console for details.');
    }
  }

  // ---- Inject dropdown + icon ----
  function injectDropdown() {
    // only once
    if (document.querySelector('#claude-format-select')) return;

    const fieldset = document.querySelector('fieldset.flex.w-full.min-w-0.flex-col');
    if (!fieldset) return;

    // ensure we can absolutely position inside it
    fieldset.style.position = 'relative';

    // create <select>
    const sel = document.createElement('select');
    sel.id = 'claude-format-select';
    sel.innerHTML = `
      <option value="txt">TXT</option>
      <option value="md">MD</option>
      <option value="json">JSON</option>
    `;
    Object.assign(sel.style, {
      position: 'absolute',
      top: '0.5rem',
      right: '2.75rem',
      padding: '0.25rem',
      background: 'var(--bg-000)',
      color: 'var(--text-200)',
      border: '1px solid var(--border-300)',
      borderRadius: '0.25rem',
      fontSize: '0.875rem',
      zIndex: 20
    });

    // create download icon
    const btn = document.createElement('button');
    btn.innerText = '⬇️';
    btn.title     = 'Download conversation';
    Object.assign(btn.style, {
      position: 'absolute',
      top: '0.5rem',
      right: '0.5rem',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.1rem',
      color: 'var(--text-200)',
      zIndex: 20
    });
    btn.addEventListener('click', () => download(sel.value));

    // append both
    fieldset.append(sel, btn);
  }

  // ---- Watch for React renders ----
  const mo = new MutationObserver(ms => {
    if (ms.some(m =>
      Array.from(m.addedNodes).some(n =>
        n.nodeType === 1 && (
          n.matches('fieldset.flex.w-full.min-w-0.flex-col') ||
          n.querySelector('fieldset.flex.w-full.min-w-0.flex-col')
        )
      )
    )) {
      injectDropdown();
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });
  // initial
  injectDropdown();

})();
