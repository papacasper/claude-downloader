# Claude Chat Downloader

A userscript that adds an Export button to Claude.ai, allowing you to download your conversations in multiple formats.

## Features

- 📥 Adds export buttons directly under Chat Controls section
- 💾 Download conversations in TXT, MD, or JSON formats
- 🎨 Seamlessly integrates with Claude's UI design
- 🌓 Supports both light and dark modes
- 📱 Works on desktop and mobile views
- 🔍 Preserves code blocks and formatting
- ✨ Interactive hover states with tooltips
- 🎯 Single-click export for each format

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Click the "Install" button above
3. Approve the installation in Tampermonkey

## Usage

1. Go to [Claude.ai](https://claude.ai)
2. Open any conversation
3. Find the format buttons under "Chat controls":
   - TXT: Simple text format with clear speaker labels
   - MD: Markdown format with headers and formatting preserved
   - JSON: Complete conversation data in JSON format
4. Hover over any button to see format description
5. Click to download in your preferred format

## Export Format Examples

### TXT Format
```txt
User:
Hello Claude!

Claude:
Hello! How can I help you today?
```

### MD Format
```markdown
# Claude Chat Export

*Exported on [timestamp]*

### User
Hello Claude!

---

### Claude
Hello! How can I help you today?

---
```

### JSON Format
```json
{
  "chat_messages": [
    {
      "sender": "human",
      "text": "Hello Claude!"
    },
    {
      "sender": "assistant",
      "text": "Hello! How can I help you today?"
    }
  ]
}
```

## Support

- 🐛 Report issues: [GitHub Issues](https://github.com/PapaCasper/claude-downloader/issues)
- 💻 Source code: [GitHub Repository](https://github.com/PapaCasper/claude-downloader)
- 🌐 Author website: [papacasper.com](https://papacasper.com)

## Changelog

### v2.0 alpha (Current)
- Redesigned UI to integrate with Chat Controls
- Added individual format buttons in a row layout
- Added interactive hover effects and tooltips
- Improved button placement and styling
- Enhanced visual feedback
- Streamlined export process
- Fixed mobile view compatibility

### v1.0 alpha
- Initial public release
- Added support for multiple export formats (TXT, MD, JSON)
- Added mobile view support
- Improved dark/light mode handling
