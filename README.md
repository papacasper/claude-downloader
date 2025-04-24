# Claude Chat Downloader

A userscript that adds a dark-themed dropdown to Claude.ai’s chat input, allowing you to choose between TXT, MD, or JSON formats and download your conversations with a single click. The dropdown intelligently flips up if there's not enough space below the input field.

## Features

- 🌓 **Dark Mode Integration**: Seamlessly matches Claude’s dark-themed chat input.
- 🔄 **Flippable Dropdown**: Dropdown menu opens upward when there's insufficient room below.
- 📋 **Multiple Output Formats**: Download conversations in **TXT**, **MD**, or **JSON**.
- 📥 **In-Chat Control**: Dropdown and download icon embedded directly in the chat input box.
- ⚡ **Single-Click Export**: Select format and click the icon to instantly download.
- 📱 **Responsive**: Works on desktop and mobile views.
- 🛠 **Auto-Update**: Script can update itself from GitHub releases.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or a compatible userscript manager).
2. Click **Install** or copy-paste the script source URL:
   ```
   https://raw.githubusercontent.com/PapaCasper/claude-downloader/main/claude-downloader.user.js
   ```
3. Approve installation in Tampermonkey.

## Usage

1. Visit [Claude.ai](https://claude.ai) and open any conversation.
2. Inside the chat input box, locate the **format dropdown** (defaults to `TXT`).
3. Click the dropdown to pick **TXT**, **MD**, or **JSON**. The menu will flip upward if needed.
4. Click the 📥 **download icon** to save your conversation in the chosen format.

## Export Format Examples

### TXT
```txt
User:
Hello Claude!

Claude:
Hello! How can I help you today?
```

### MD
```markdown
# Claude Chat Export

*Exported on 2025-04-23 14:32:10*

---

### User

Hello Claude!

---

### Claude

Hello! How can I help you today?

---
```

### JSON
```json
{
  "chat_messages": [
    { "sender": "human", "text": "Hello Claude!" },
    { "sender": "assistant", "text": "Hello! How can I help you today?" }
  ]
}
```

## Update & Maintenance

- The script auto-updates from the GitHub repository when a new release is published.
- Report bugs or request features on [GitHub Issues](https://github.com/PapaCasper/claude-downloader/issues).

## Support

- 📂 **Source code**: https://github.com/PapaCasper/claude-downloader
- 🌐 **Author**: https://papacasper.com

## Changelog

### v2.1
- Added GitHub auto-update (updateURL/downloadURL).
- Fixed dropdown positioning and flipping logic.
- Updated UI styling for better theme match.

### v2.0
- Switched to custom dark dropdown in chat input.
- Introduced flippable menu that opens up when needed.
- Simplified download workflow to a single embedded control.

### v1.0
- Initial release: added separate export buttons for TXT, MD, JSON.
