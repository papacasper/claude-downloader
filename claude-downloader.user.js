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

(function() {
  'use strict';

  const API_BASE_URL = 'https://claude.ai/api';

  // Styles for the download buttons
  const styles = `
    .claude-download-button {
      display: flex;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-200);
      cursor: pointer;
      align-items: center;
      justify-content: space-between;
      border: 1px solid var(--border-300);
      background-color: transparent;
      transition: all 0.2s ease;
      flex: 1;
      min-width: 85px;
      margin-right: 0.5rem;
      position: relative;
    }
    .claude-download-button:last-child {
      margin-right: 0;
    }
    .claude-download-button:hover {
      background-color: var(--bg-500, rgba(39, 39, 42, 0.4));
      color: var(--text-100);
      border-color: var(--text-200);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .claude-download-button:active {
      transform: translateY(0);
    }
  `;

  // Inject styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // Utility: make API requests
  function apiRequest(method, endpoint, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: { 'Content-Type': 'application/json', ...headers },
        data: data ? JSON.stringify(data) : null,
        onload: response => {
          if (response.status >= 200 && response.status < 300) {
            resolve(JSON.parse(response.responseText));
          } else {
            reject(new Error(`API request failed: ${response.status}`));
          }
        },
        onerror: reject
      });
    });
  }

  // Fetch the first organization UUID
  async function getOrganizationId() {
    const orgs = await apiRequest('GET', '/organizations');
    return orgs[0].uuid;
  }

  // Fetch the conversation or project history
  async function getConversationHistory(orgId, id) {
    const isProject = window.location.pathname.includes('/project/');
    const endpoint = isProject
      ? `/organizations/${orgId}/projects/${id}`
      : `/organizations/${orgId}/chat_conversations/${id}`;
    return apiRequest('GET', endpoint);
  }

  // Convert API data into the chosen format
  function convertToFormat(data, format) {
    const isProject = window.location.pathname.includes('/project/');
    const raw = isProject ? data.conversations[0].chat_messages : data.chat_messages;

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'txt') {
      return raw.map(m => {
        const sender = m.sender === 'human' ? 'User' : 'Claude';
        return `${sender}:\n${m.text}\n\n`;
      }).join('');
    }

    // markdown
    let md = `# ${isProject ? 'Claude Project Export' : 'Claude Chat Export'}\n\n`;
    md += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
    raw.forEach(m => {
      const sender = m.sender === 'human' ? 'User' : 'Claude';
      const text = m.text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) =>
        `\`\`\`${lang}\n${code.trim()}\`\`\`\n`
      );
      md += `### ${sender}\n\n${text}\n\n---\n\n`;
    });
    return md;
  }

  // Trigger download of the conversation
  async function downloadChat(format) {
    try {
      const orgId = await getOrganizationId();
      const id = window.location.pathname.split('/').pop();
      const data = await getConversationHistory(orgId, id);
      const content = convertToFormat(data, format);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = window.location.pathname.includes('/project/')
        ? 'claude-project'
        : 'claude-chat';
      const filename = `${prefix}-${timestamp}.${format}`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Error downloading conversation. Please try again.');
    }
  }

  // Insert the download buttons into the new Claude layout
  function addDownloadButton() {
    if (document.querySelector('.claude-download-container')) return;

    const container = document.createElement('div');
    container.className = 'claude-download-container flex flex-row gap-2 mt-2';

    const formats = [
      { id: 'txt', label: 'TXT', title: 'Download as plain text' },
      { id: 'md',  label: 'MD',  title: 'Download as markdown' },
      { id: 'json',label: 'JSON',title: 'Download full JSON' }
    ];

    formats.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'claude-download-button';
      btn.title = f.title;
      btn.textContent = f.label;
      btn.addEventListener('click', () => downloadChat(f.id));
      container.appendChild(btn);
    });

    // New selector: the fieldset wrapping Claude's input
    const chatFieldset = document.querySelector('fieldset.flex.w-full.min-w-0.flex-col');
    if (chatFieldset) {
      chatFieldset.parentNode.insertBefore(container, chatFieldset.nextSibling);
    }
  }

  // Watch for Claude's dynamic React updates
  const observer = new MutationObserver(mutations => {
    const shouldAdd = mutations.some(m =>
      Array.from(m.addedNodes).some(node =>
        node.nodeType === 1 && (
          node.matches('fieldset.flex.w-full.min-w-0.flex-col') ||
          node.querySelector('fieldset.flex.w-full.min-w-0.flex-col')
        )
      )
    );
    if (shouldAdd) addDownloadButton();
  });

  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    addDownloadButton();
  }

  start();
})();
