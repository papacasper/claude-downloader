// ==UserScript==
// @name         Claude Chat Downloader (native button style)
// @namespace    http://tampermonkey.net/
// @version      2.2.2
// @description  Download Claude conversations with native button styling that matches the plus/settings buttons
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

  // 1) Inject CSS matching Claude's exact native dropdown style
  const ddStyles = document.createElement('style');
  ddStyles.textContent = `
    .claude-download-dropdown {
      width: 20rem;
      position: absolute;
      max-width: calc(100vw - 16px);
      bottom: 2.5rem;
      left: 0px;
      display: none;
      z-index: 50;
    }

    .claude-download-dropdown.show {
      display: block;
    }

    .claude-download-dropdown .dropdown-inner {
      position: relative;
      width: 100%;
      will-change: transform;
      height: auto;
      overflow-y: auto;
      overscroll-behavior: auto;
      display: flex;
      z-index: 50;
      background: #30302e;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 0.5px solid var(--border-300, #3f3f44);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      flex-direction: column-reverse;
      opacity: 1;
      transform: none;
    }

    .claude-download-dropdown .dropdown-content {
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
      transition-timing-function: ease-in-out;
      transition-duration: 100ms;
      transition-property: height;
      transition-delay: 0ms;
      justify-content: flex-end;
      background: #30302e;
    }

    .claude-download-dropdown .p-1\\.5 {
      padding: 0.375rem;
    }

    .claude-download-dropdown .flex.flex-col {
      display: flex;
      flex-direction: column;
    }

    .claude-download-option {
      display: flex;
      width: 100%;
      text-align: left;
      gap: 0.625rem;
      padding: 0.375rem;
      font-weight: 400;
      color: var(--text-200, #e5e5e7);
      border-radius: 0.5rem;
      user-select: none;
      align-items: center;
      cursor: pointer;
      transition: all 0.15s ease;
      height: 2rem;
      background: transparent;
      border: none;
    }

    .claude-download-option:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-000, #ffffff);
    }

    .claude-download-option:active {
      transform: scale(0.995);
    }

    .claude-download-option .option-icon {
      min-width: 1rem;
      min-height: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-300, #c7c7c9);
      flex-shrink: 0;
    }

    .claude-download-option:hover .option-icon {
      color: var(--text-100, #f2f2f7);
    }

    .claude-download-option .option-text {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex: 1;
      min-width: 7rem;
    }

    .claude-download-option .option-label {
      font-weight: 400;
      color: var(--text-300, #c7c7c9);
      text-overflow: ellipsis;
      word-break: break-words;
      white-space: nowrap;
      min-width: 0;
      overflow: hidden;
    }

    .claude-download-option:hover .option-label {
      color: var(--text-100, #f2f2f7);
    }

    /* Ensure button wrapper has relative positioning for dropdown */
    .claude-download-wrapper {
      position: relative;
      display: flex;
      align-items: center;
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
      try {
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

  // 3) Find the button container and inject native-styled button
  function injectDownloadButton() {
    if (document.querySelector('.claude-download-btn')) {
      console.log("Claude Downloader: Button already exists");
      return;
    }

    console.log("Claude Downloader: Attempting to inject button...");

    // Strategy: Find the input area's button row
    // Look for the plus button or settings button as anchor points
    const plusButton = document.querySelector('button[data-testid="input-menu-plus"]');
    const settingsButton = document.querySelector('button[aria-label="Open settings"]');
    
    let insertionPoint = null;
    let insertionMethod = 'after'; // 'after', 'before', or 'append'

    if (plusButton) {
      // Insert near the plus button
      insertionPoint = plusButton.closest('div.relative.shrink-0') || plusButton.parentElement;
      console.log("Claude Downloader: Found plus button as anchor");
    } else if (settingsButton) {
      // Insert near settings button
      insertionPoint = settingsButton.closest('div.relative.shrink-0') || settingsButton.parentElement;
      insertionMethod = 'before';
      console.log("Claude Downloader: Found settings button as anchor");
    }

    // Fallback: look for the button container area
    if (!insertionPoint) {
      const containerSelectors = [
        'div.relative.flex-1.flex.items-center.shrink.min-w-0.gap-1',
        'div.flex.items-center.gap-2',
        'div[class*="flex"][class*="items-center"][class*="gap"]'
      ];

      for (const selector of containerSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          insertionPoint = container;
          insertionMethod = 'append';
          console.log(`Claude Downloader: Found container via selector: ${selector}`);
          break;
        }
      }
    }

    if (!insertionPoint) {
      console.log("Claude Downloader: No suitable insertion point found");
      return;
    }

    // Create button wrapper
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'claude-download-wrapper relative shrink-0';

    // Create the main button using Claude's exact classes
    const btn = document.createElement('button');
    btn.className = 'claude-download-btn inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none border-0.5 transition-all h-8 min-w-8 rounded-lg flex items-center px-[7.5px] group !pointer-events-auto !outline-offset-1 text-text-300 border-border-300 active:scale-[0.98] hover:text-text-200/90 hover:bg-bg-100';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', 'Download chat');
    btn.title = 'Download Chat';

    // Create button content wrapper
    const btnContentWrapper = document.createElement('div');
    btnContentWrapper.className = 'flex flex-row items-center justify-center gap-1';

    // Create icon wrapper
    const iconWrapper = document.createElement('div');
    iconWrapper.style.cssText = 'transform: none;';

    // Download icon SVG (matching Claude's style)
    iconWrapper.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
        <path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0ZM117.66,138.34a8,8,0,0,0,11.31,0l48-48A8,8,0,0,0,165.66,79L136,108.69V24a8,8,0,0,0-16,0v84.69L90.34,79A8,8,0,0,0,79,90.34Z"/>
      </svg>
    `;

    btnContentWrapper.appendChild(iconWrapper);
    btn.appendChild(btnContentWrapper);

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'claude-download-dropdown';

    const dropdownInner = document.createElement('div');
    dropdownInner.className = 'dropdown-inner';
    dropdownInner.style.maxHeight = '415px';

    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'dropdown-content';
    dropdownContent.style.height = 'auto';

    const dropdownWrapper = document.createElement('div');
    dropdownWrapper.className = 'w-full';

    const paddingWrapper = document.createElement('div');
    paddingWrapper.className = 'p-1.5 flex flex-col';

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'flex flex-col';
    optionsContainer.style.transform = 'none';

    // Create download options
    const formats = [
      { fmt: 'txt', label: 'Download as TXT', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { fmt: 'md', label: 'Download as MD', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { fmt: 'json', label: 'Download as JSON', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
    ];

    formats.forEach(format => {
      const optionDiv = document.createElement('div');

      const optionButton = document.createElement('button');
      optionButton.className = 'claude-download-option';
      optionButton.dataset.fmt = format.fmt;

      const iconContainer = document.createElement('div');
      iconContainer.className = 'option-icon';
      iconContainer.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${format.icon}"/>
        </svg>
      `;

      const textContainer = document.createElement('div');
      textContainer.className = 'option-text';

      const label = document.createElement('p');
      label.className = 'option-label';
      label.textContent = format.label;

      textContainer.appendChild(label);
      optionButton.appendChild(iconContainer);
      optionButton.appendChild(textContainer);
      optionDiv.appendChild(optionButton);
      optionsContainer.appendChild(optionDiv);
    });

    // Assemble dropdown structure
    paddingWrapper.appendChild(optionsContainer);
    dropdownWrapper.appendChild(paddingWrapper);
    dropdownContent.appendChild(dropdownWrapper);
    dropdownInner.appendChild(dropdownContent);
    dropdown.appendChild(dropdownInner);

    // Assemble button wrapper
    btnWrapper.appendChild(btn);
    btnWrapper.appendChild(dropdown);

    // Button click handler
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    // Dropdown option handlers
    dropdown.querySelectorAll('button[data-fmt]').forEach(option => {
      option.addEventListener('click', () => {
        const fmt = option.dataset.fmt;
        dropdown.classList.remove('show');
        download(fmt);
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!btnWrapper.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });

    // Insert the button based on the method
    try {
      if (insertionMethod === 'after' && insertionPoint.parentNode) {
        insertionPoint.parentNode.insertBefore(btnWrapper, insertionPoint.nextSibling);
      } else if (insertionMethod === 'before' && insertionPoint.parentNode) {
        insertionPoint.parentNode.insertBefore(btnWrapper, insertionPoint);
      } else {
        insertionPoint.appendChild(btnWrapper);
      }
      console.log("Claude Downloader: Button injected successfully!");
    } catch (e) {
      console.error("Claude Downloader: Failed to insert button:", e);
      // Last resort: append to the insertion point
      try {
        insertionPoint.appendChild(btnWrapper);
        console.log("Claude Downloader: Button appended as fallback");
      } catch (e2) {
        console.error("Claude Downloader: All insertion methods failed:", e2);
      }
    }
  }

  // 4) Observe React re-renders with improved robustness
  const mo = new MutationObserver(muts => {
    try {
      if (
        muts.some(m =>
          Array.from(m.addedNodes).some(
            n =>
              n.nodeType === 1 &&
              (n.matches?.('div.flex.items-center') ||
               n.querySelector?.('div.flex.items-center') ||
               n.matches?.('button') ||
               n.querySelector?.('button'))
          )
        )
      ) {
        setTimeout(injectDownloadButton, 100);
      }
    } catch (e) {
      console.error("Error in mutation observer:", e);
    }
  });

  // Start observing and initial setup
  function startObserving() {
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true });
      console.log("Claude Downloader: Observer started");
    } catch (e) {
      console.error("Failed to start observer:", e);
    }
  }

  function initialSetup() {
    console.log("Claude Downloader: Starting initial setup...");

    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(injectDownloadButton, 500);
      });
    } else {
      injectDownloadButton();
    }

    // Retry attempts with increasing delays
    const retryDelays = [1000, 2000, 3000, 5000];
    retryDelays.forEach(delay => {
      setTimeout(() => {
        if (!document.querySelector('.claude-download-btn')) {
          console.log(`Claude Downloader: Retry attempt after ${delay}ms`);
          injectDownloadButton();
        }
      }, delay);
    });
  }

  // Start everything
  startObserving();
  initialSetup();
})();
