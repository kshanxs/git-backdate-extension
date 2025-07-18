# Git Backdate Extension

A powerful VS Code extension that allows you to commit and push files with custom backdated timestamps through an intuitive GUI interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/kshanxs/git-backdate-extension)](https://github.com/kshanxs/git-backdate-extension/issues)
[![GitHub stars](https://img.shields.io/github/stars/kshanxs/git-backdate-extension)](https://github.com/kshanxs/git-backdate-extension/stargazers)

## Features

🕰️ **Backdate Commits**: Create Git commits with any date in the past
📁 **Flexible Scope**: Commit individual files or entire projects
🎨 **Beautiful GUI**: Modern, responsive webview interface that integrates seamlessly with VS Code themes
🚀 **One-Click Push**: Optionally push to remote repository after committing
📋 **Git Integration**: Real-time Git status and modified files detection
⚡ **Quick Access**: Available through command palette and context menus

## How to Use

### Opening the Extension

1. **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and search for "Git Backdate: Open Panel"
2. **Context Menu**: Right-click on any file in the Explorer and select "Backdate This File"
3. **Explorer Integration**: Use the extension from the Source Control view

### Creating Backdated Commits

1. Open the Git Backdate panel
2. Enter your commit message
3. Select the date and time you want to backdate to
4. Choose your scope:
   - **Selected File**: Commit only a specific file
   - **Entire Project**: Commit all modified files
5. Optionally check "Push to remote repository" to push immediately after committing
6. Click "Create Backdated Commit"

### Requirements

- VS Code 1.74.0 or higher
- Git repository (the extension will detect if you're in a Git repo)
- Node.js and npm (for development)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Git Backdate"
4. Click Install

### Manual Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/kshanxs/git-backdate-extension.git
   cd git-backdate-extension
   ```
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to open a new Extension Development Host window

## Commands

- `gitBackdate.openPanel`: Open the main Git Backdate panel
- `gitBackdate.backdateFile`: Backdate a specific file (appears in context menu)
- `gitBackdate.backdateProject`: Backdate the entire project

## Configuration

The extension works out of the box with no configuration required. It automatically detects your Git repository and integrates with your VS Code theme.

## Development

### Building
```bash
npm install
npm run compile
```

### Running in Development
1. Press F5 in VS Code to open Extension Development Host
2. The extension will be loaded in the new window

### Technologies Used
- TypeScript
- VS Code Extension API
- Git CLI integration
- HTML/CSS/JavaScript for webview

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Shubhanshu Shukla** - [kshanxs](https://github.com/kshanxs)

## Support

If you encounter any issues or have feature requests, please file them in the [GitHub Issues](https://github.com/kshanxs/git-backdate-extension/issues) section.

## Repository

🔗 **GitHub Repository**: [https://github.com/kshanxs/git-backdate-extension](https://github.com/kshanxs/git-backdate-extension)

---

### Enjoy backdating your commits with style! 🚀
