// ==UserScript==
// @name         Claude Chat Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0 alpha
// @description  Add download button to save Claude AI conversations in TXT, MD, or JSON format
// @author       Papa Casper
// @license      MIT
// @homepage     https://papacasper.com
// @repository   https://github.com/PapaCasper
// @source       https://github.com/PapaCasper/claude-downloader
// @supportURL   https://github.com/PapaCasper/claude-downloader/issues
// @match        https://claude.ai/chat/*
// @match        https://claude.ai/chats/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE_URL = 'https://claude.ai/api';

    const styles = `
        .claude-download-container {
            position: relative;
            display: inline-flex;
            align-items: center;
        }
        .claude-download-button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            height: 2.25rem;
            padding: 0 0.75rem;
            border-radius: 0.375rem;
            font-size: 0.875rem;
            font-weight: 500;
            background-color: transparent;
            color: rgb(161, 161, 170);
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
        }
        .claude-download-button:hover {
            background-color: rgb(39, 39, 42);
            color: rgb(250, 250, 250);
        }
        .claude-download-button svg {
            width: 1.25rem;
            height: 1.25rem;
        }
        .claude-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 0.5rem;
            background-color: rgb(24, 24, 27);
            border: 1px solid rgb(39, 39, 42);
            border-radius: 0.5rem;
            padding: 0.25rem;
            min-width: 10rem;
            display: none;
            flex-direction: column;
            gap: 0.125rem;
            z-index: 50;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .claude-dropdown.show {
            display: flex;
        }
        .claude-dropdown-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.625rem 0.75rem;
            border-radius: 0.375rem;
            color: rgb(250, 250, 250);
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.15s ease;
            width: 100%;
            text-align: left;
            white-space: nowrap;
        }
        .claude-dropdown-item svg {
            width: 1rem;
            height: 1rem;
            color: rgb(161, 161, 170);
        }
        .claude-dropdown-item:hover {
            background-color: rgb(39, 39, 42);
        }
        .claude-mobile-menu {
            display: none;
            position: relative;
        }
        @media (max-width: 768px) {
            .claude-download-container {
                display: none;
            }
            .claude-mobile-menu {
                display: block;
            }
            .claude-mobile-menu .claude-dropdown {
                position: absolute;
                bottom: calc(100% + 0.5rem);
                right: 0;
                margin-top: 0;
            }
        }
        @media (prefers-color-scheme: light) {
            .claude-dropdown {
                background-color: rgb(250, 250, 250);
                border-color: rgb(228, 228, 231);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .claude-dropdown-item {
                color: rgb(24, 24, 27);
            }
            .claude-dropdown-item:hover {
                background-color: rgb(228, 228, 231);
            }
            .claude-dropdown-item svg {
                color: rgb(113, 113, 122);
            }
            .claude-download-button:hover {
                background-color: rgb(228, 228, 231);
                color: rgb(24, 24, 27);
            }
        }
    `;

    // Add styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // API Request Function
    function apiRequest(method, endpoint, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: `${API_BASE_URL}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                data: data ? JSON.stringify(data) : null,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(new Error(`API request failed with status ${response.status}`));
                    }
                },
                onerror: (error) => {
                    reject(error);
                },
            });
        });
    }

    // Get Organization ID
    async function getOrganizationId() {
        const organizations = await apiRequest('GET', '/organizations');
        return organizations[0].uuid;
    }

    // Get Conversation History
    async function getConversationHistory(orgId, chatId) {
        return await apiRequest('GET', `/organizations/${orgId}/chat_conversations/${chatId}`);
    }

    // Format conversion
    function convertToFormat(data, format) {
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'txt') {
            return data.chat_messages.map(message => {
                const sender = message.sender === 'human' ? 'User' : 'Claude';
                return `${sender}:\n${message.text}\n\n`;
            }).join('');
        } else if (format === 'md') {
            let content = `# Claude Chat Export\n\n`;
            content += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

            data.chat_messages.forEach(message => {
                const sender = message.sender === 'human' ? 'User' : 'Claude';
                const text = message.text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                    return `\`\`\`${lang}\n${code.trim()}\`\`\`\n`;
                });
                content += `### ${sender}\n\n${text}\n\n---\n\n`;
            });

            return content;
        }
    }

    // Download Function
    async function downloadChat(format) {
        try {
            const orgId = await getOrganizationId();
            const chatId = window.location.pathname.split('/').pop();
            const chatData = await getConversationHistory(orgId, chatId);

            const content = convertToFormat(chatData, format);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `claude-chat-${timestamp}.${format}`;

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
            console.error('Error downloading chat:', error);
            alert('Error downloading chat. Please try again.');
        }
    }

    // Helper function to create dropdown menu
    function createDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'claude-dropdown';

        const formats = [
            { id: 'txt', label: 'Export as TXT' },
            { id: 'md', label: 'Export as MD' },
            { id: 'json', label: 'Export as JSON' }
        ];

        formats.forEach(format => {
            const item = document.createElement('button');
            item.className = 'claude-dropdown-item';
            item.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0ZM117.66,154.34a8,8,0,0,0,11.31,0l40-40a8,8,0,0,0-11.31-11.31L136,124.69V40a8,8,0,0,0-16,0v84.69L98.34,103a8,8,0,0,0-11.31,11.31Z"/>
                </svg>
                ${format.label}
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadChat(format.id);
                dropdown.classList.remove('show');
            });
            dropdown.appendChild(item);
        });

        return dropdown;
    }

    // Create and add download button
    function addDownloadButton() {
        if (document.querySelector('.claude-download-container')) return;

        // Create desktop version
        const container = document.createElement('div');
        container.className = 'claude-download-container';

        const button = document.createElement('button');
        button.className = 'claude-download-button';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                <path d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152a8,8,0,0,1,16,0v56H208V152a8,8,0,0,1,16,0ZM117.66,154.34a8,8,0,0,0,11.31,0l40-40a8,8,0,0,0-11.31-11.31L136,124.69V40a8,8,0,0,0-16,0v84.69L98.34,103a8,8,0,0,0-11.31,11.31Z"/>
            </svg>
            Export
        `;

        const dropdown = createDropdown();
        container.appendChild(button);
        container.appendChild(dropdown);

        // Create mobile version
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'claude-mobile-menu';
        const mobileButton = button.cloneNode(true);
        const mobileDropdown = createDropdown();
        mobileMenu.appendChild(mobileButton);
        mobileMenu.appendChild(mobileDropdown);

        // Add click handlers
        function handleButtonClick(dropdownElement) {
            return (e) => {
                e.stopPropagation();
                // Close any other open dropdowns
                document.querySelectorAll('.claude-dropdown').forEach(d => {
                    if (d !== dropdownElement) d.classList.remove('show');
                });
                dropdownElement.classList.toggle('show');
            };
        }

        button.addEventListener('click', handleButtonClick(dropdown));
        mobileButton.addEventListener('click', handleButtonClick(mobileDropdown));

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.claude-dropdown').forEach(d => {
                d.classList.remove('show');
            });
        });

        // Insert desktop version
        const targetContainer = document.querySelector('.hidden.flex-row-reverse.gap-1\\.5.md\\:flex');
        if (targetContainer) {
            targetContainer.insertBefore(container, targetContainer.firstChild);
        }

        // Insert mobile version
        const mobileContainer = document.querySelector('.flex.items-center.md\\:hidden');
        if (mobileContainer) {
            mobileContainer.insertBefore(mobileMenu, mobileContainer.firstChild);
        }
    }

    // Observer setup
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                addDownloadButton();
            }
        }
    });

    function startObserver() {
        const targetDiv = document.querySelector('.right-3.flex.gap-2.md\\:absolute');
        if (targetDiv) {
            observer.observe(targetDiv, {
                childList: true,
                subtree: true
            });
            addDownloadButton();
        } else {
            setTimeout(startObserver, 500);
        }
    }

    startObserver();
})();
