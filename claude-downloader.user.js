// ==UserScript==
// @name         Claude Chat Downloader
// @namespace    http://tampermonkey.net/
// @version      2.7
// @description  Add download button to save Claude AI conversations in TXT, MD, or JSON format
// @author       Papa Casper (updated by Claude)
// @homepage     https://papacasper.com
// @repository   https://github.com/PapaCasper
// @source       https://github.com/PapaCasper/claude-downloader
// @supportURL   https://github.com/PapaCasper/claude-downloader/issues
// @match        https://claude.ai/chat/*
// @match        https://claude.ai/chats/*
// @match        https://claude.ai/project/*
// @match        https://claude.ai/projects/*
// @grant        GM_xmlhttpRequest
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE_URL = 'https://claude.ai/api';

    const CONVERSATION_PARAMS = 'tree=True&rendering_mode=messages&render_all_tools=true&consistency=eventual';

    const styles = `
        .claude-download-container {
            display: flex;
            flex-direction: row;
            gap: 0.5rem;
            padding: 0.4rem 0.75rem;
            flex-shrink: 0;
            background-color: var(--bg-100);
            border-bottom: 0.5px solid var(--border-300);
        }
        .claude-download-button {
            display: flex;
            padding: 0.4rem 0.75rem;
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
        .claude-download-button svg {
            width: 1.25rem;
            height: 1.25rem;
            margin-left: 0.5rem;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // -------------------------------------------------------------------------
    // Find the correct insertion point.
    //
    // Target structure:
    //   <div class="h-full flex flex-col overflow-hidden" style="flex: 100 1 0%">
    //     <header data-testid="page-header">...</header>   ← find this
    //     <div data-autoscroll-container>...</div>          ← insert before this
    //   </div>
    //
    // We locate the header first (reliable data-testid), then confirm its
    // next sibling is the scroll container, then insert between them.
    // Returns true if injection succeeded, false if the DOM isn't ready yet.
    // -------------------------------------------------------------------------
    function tryInject() {
        if (document.querySelector('.claude-download-container')) return true;

        const header = document.querySelector('header[data-testid="page-header"]');
        if (!header) return false;

        // Walk forward from the header to find the scroll container sibling
        let scrollContainer = null;
        let sibling = header.nextElementSibling;
        while (sibling) {
            if (sibling.hasAttribute('data-autoscroll-container') ||
                sibling.querySelector('[data-autoscroll-container]')) {
                scrollContainer = sibling.hasAttribute('data-autoscroll-container')
                    ? sibling
                    : sibling.querySelector('[data-autoscroll-container]');
                break;
            }
            sibling = sibling.nextElementSibling;
        }

        if (!scrollContainer) return false;

        // Confirm the scroll container's parent is also the header's parent
        // (they must be siblings inside the same flex column)
        const flexColumn = header.parentElement;
        if (!flexColumn || !flexColumn.contains(scrollContainer)) return false;

        const container = buildButtonsContainer();
        // Insert immediately before the scroll container — places it between
        // the header and the messages inside the flex column as a static child.
        // The scroll container has flex-1 so it fills remaining height and our
        // bar stays pinned at the top without any sticky/absolute positioning.
        scrollContainer.insertAdjacentElement('beforebegin', container);
        return true;
    }

    // -------------------------------------------------------------------------
    // API helpers
    // -------------------------------------------------------------------------
    function apiRequest(method, endpoint, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: `${API_BASE_URL}${endpoint}`,
                headers: { 'Content-Type': 'application/json', ...headers },
                data: data ? JSON.stringify(data) : null,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(new Error(`API request failed with status ${response.status}`));
                    }
                },
                onerror: reject,
            });
        });
    }

    async function getOrganizationId() {
        const organizations = await apiRequest('GET', '/organizations');
        return organizations[0].uuid;
    }

    async function getConversationHistory(orgId, id) {
        const isProject = window.location.pathname.includes('/project/');
        const endpoint = isProject
            ? `/organizations/${orgId}/projects/${id}`
            : `/organizations/${orgId}/chat_conversations/${id}?${CONVERSATION_PARAMS}`;
        return await apiRequest('GET', endpoint);
    }

    // -------------------------------------------------------------------------
    // Message text extraction
    // -------------------------------------------------------------------------
    function extractMessageText(message) {
        if (Array.isArray(message.content) && message.content.length > 0) {
            const parts = [];
            for (const block of message.content) {
                switch (block.type) {
                    case 'text':
                        if (block.text) parts.push(block.text.trim());
                        break;
                    case 'tool_use':
                        if (block.name) {
                            parts.push(block.message
                                ? `_[${block.name}: ${block.message}]_`
                                : `_[${block.name}]_`);
                        }
                        break;
                    case 'tool_result':
                        break;
                    case 'image':
                        parts.push('[image]');
                        break;
                    case 'document':
                        parts.push(`[document: ${block.name || 'attached'}]`);
                        break;
                }
            }
            return parts.join('\n\n');
        }
        return (message.text || '')
            .replace(/```\s*\nThis block is not supported on your current device yet\.\s*\n```\s*\n?/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // -------------------------------------------------------------------------
    // Format conversion
    // -------------------------------------------------------------------------
    function convertToFormat(data, format) {
        const isProject = window.location.pathname.includes('/project/');

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'txt') {
            const messages = isProject ? data.conversations[0].chat_messages : data.chat_messages;
            return messages.map(message => {
                const sender = message.sender === 'human' ? 'User' : 'Claude';
                return `${sender}:\n${extractMessageText(message)}\n\n`;
            }).join('');
        } else if (format === 'md') {
            let content = `# ${isProject ? 'Claude Project Export' : 'Claude Chat Export'}\n\n`;
            content += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
            const messages = isProject ? data.conversations[0].chat_messages : data.chat_messages;
            messages.forEach(message => {
                const sender = message.sender === 'human' ? 'User' : 'Claude';
                const text = extractMessageText(message).replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
                    return `\`\`\`${lang}\n${code.trim()}\`\`\`\n`;
                });
                content += `### ${sender}\n\n${text}\n\n---\n\n`;
            });
            return content;
        }
    }

    // -------------------------------------------------------------------------
    // Download
    // -------------------------------------------------------------------------
    async function downloadChat(format) {
        try {
            const orgId = await getOrganizationId();
            const id = window.location.pathname.split('/').pop();
            const data = await getConversationHistory(orgId, id);
            const content = convertToFormat(data, format);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const prefix = window.location.pathname.includes('/project/') ? 'claude-project' : 'claude-chat';
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
        } catch (error) {
            console.error('Error downloading conversation:', error);
            alert('Error downloading conversation. Please try again.');
        }
    }

    // -------------------------------------------------------------------------
    // Build buttons
    // -------------------------------------------------------------------------
    function buildButtonsContainer() {
        const container = document.createElement('div');
        container.className = 'claude-download-container';

        const formats = [
            { id: 'txt',  label: 'TXT',  title: 'Download as plain text file' },
            { id: 'md',   label: 'MD',   title: 'Download as markdown file with formatting' },
            { id: 'json', label: 'JSON', title: 'Download complete conversation data' },
        ];

        formats.forEach(format => {
            const btn = document.createElement('button');
            btn.className = 'claude-download-button';
            btn.title = format.title;
            btn.innerHTML = `
                <span>${format.label}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0ZM117.66,154.34a8,8,0,0,0,11.31,0l40-40a8,8,0,0,0-11.31-11.31L136,124.69V40a8,8,0,0,0-16,0v84.69L98.34,103a8,8,0,0,0-11.31,11.31Z"/>
                </svg>
            `;
            btn.addEventListener('click', () => downloadChat(format.id));
            container.appendChild(btn);
        });

        return container;
    }

    // -------------------------------------------------------------------------
    // Remove bar when leaving a conversation page
    // -------------------------------------------------------------------------
    function removeDownloadButton() {
        document.querySelector('.claude-download-container')?.remove();
    }

    function isConversationPage() {
        return /\/(chat|chats|project|projects)\//.test(window.location.pathname);
    }

    // -------------------------------------------------------------------------
    // Observer — fires on every DOM mutation.
    // tryInject() returns false if the target elements aren't in the DOM yet,
    // so we simply wait for the next mutation and try again. We never fall back
    // to document.body, so a premature call is harmless.
    // -------------------------------------------------------------------------
    const observer = new MutationObserver(() => {
        if (isConversationPage()) {
            tryInject();
        } else {
            removeDownloadButton();
        }
    });

    function startObserver() {
        const target = document.documentElement;
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
            if (isConversationPage()) tryInject();
        } else {
            setTimeout(startObserver, 500);
        }
    }

    startObserver();
})();
