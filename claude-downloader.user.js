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

(function () {
  'use strict';

  const API_BASE = 'https://claude.ai/api';

  //
  // 1) Inject CSS so the dropdown + options match Claude’s input box
  //
  const popupStyles = document.createElement('style');
  popupStyles.textContent = `
    /* Match the select’s background/text to Claude’s dark input */
    #claude-format-select {
      background: var(--bg-000) !important;
      color:      var(--text-100) !important;
      border:     1px solid var(--border-300) !important;
    }
    /* And options too */
    #claude-format-select option {
      background: var(--bg-000) !important;
      color:      var(--text-100) !important;
    }
  `;
  document.head.appendChild(popupStyles);

  //
  // 2) API helpers
  //
  function apiRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: `${API_BASE}${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        data: data ? JSON.stringify(data) : null,
        onload: r => (r.status >= 200 && r.status < 300)
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
      return msgs.map(m => {
        const who = m.sender === 'human' ? 'User' : 'Claude';
        return `${who}:\n${m.text}\n\n`;
      }).join('');
    }

    // markdown
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

  //
  // 3) Inject the styled dropdown + ⬇️ button into Claude’s input field
  //
  function injectDropdown() {
    if (document.querySelector('#claude-format-select')) return;
    const fs = document.querySelector('fieldset.flex.w-full.min-w-0.flex-col');
    if (!fs) return;

    // allow absolute children
    fs.style.position = 'relative';

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
      fontSize: '0.875rem',
      zIndex: 20,
      // no background/color here—they come from our injected CSS
    });

    // create download button
    const btn = document.createElement('button');
    btn.innerHTML = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    fill="currentColor"
    style="width:1.25rem; height:1.25rem; display:block;"
  >
    <path d="M498.837,65.628c-7.957-3.328-17.152-1.472-23.253,4.629L256,289.841L36.416,70.257
             c-6.101-6.101-15.275-7.936-23.253-4.629C5.184,68.913,0,76.721,0,85.34v106.667
             c0,5.675,2.24,11.093,6.251,15.083l234.667,234.667
             c4.16,4.16,9.621,6.251,15.083,6.251c5.462,0,10.923-2.091,15.083-6.251L505.751,207.09
             c4.011-3.989,6.251-9.408,6.251-15.083V85.34
             C512,76.721,506.816,68.913,498.837,65.628z"/>
  </svg>
`;
    btn.title = 'Download conversation';
    Object.assign(btn.style, {
      position: 'absolute',
      top: '0.5rem',
      right: '0.5rem',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.1rem',
      color: 'var(--text-200)',
      zIndex: 20,
    });
    btn.addEventListener('click', () => download(sel.value));

    fs.append(sel, btn);
  }

  //
  // 4) Watch for React re-renders and inject on-the-fly
  //
  const mo = new MutationObserver(muts => {
    if (muts.some(m =>
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
  injectDropdown();
})();
