# Demo Instructions for Git Backdate Extension

## Testing the Extension

### Prerequisites
1. Make sure you have a Git repository initialized in your workspace
2. Have some files with changes to commit

### Running the Extension in Development Mode

1. **Open Extension Development Host**:
   - Press `F5` in VS Code, or
   - Open Command Palette (`Cmd+Shift+P`) and run "Debug: Start Debugging"
   - This will open a new VS Code window with the extension loaded

2. **Test the Extension**:
   In the new Extension Development Host window:

   **Method 1: Command Palette**
   - Press `Cmd+Shift+P`
   - Type "Git Backdate: Open Panel"
   - Press Enter

   **Method 2: Context Menu**
   - Right-click on any file in the Explorer
   - Select "Backdate This File"

   **Method 3: SCM View**
   - Open the Source Control view (Git icon in sidebar)
   - Look for the "Git Backdate" section

### Using the GUI

1. **Set Commit Message**: Enter a descriptive commit message
2. **Choose Date**: Select the date and time you want to backdate to
3. **Select Scope**:
   - **Selected File**: Commit only the specific file you right-clicked on
   - **Entire Project**: Commit all modified files in the repository
4. **Optional Push**: Check "Push to remote repository" to push after committing
5. **Create Commit**: Click "Create Backdated Commit"

### Features to Test

- ✅ Open the panel from different methods
- ✅ Backdate a single file
- ✅ Backdate entire project
- ✅ Custom date/time selection
- ✅ Git status detection
- ✅ Modified files listing
- ✅ Error handling (try with no Git repo)
- ✅ Success/error messages
- ✅ Theme integration (try different VS Code themes)

### Sample Test Scenario

1. Create a test file: `echo "Hello World" > test.txt`
2. Modify an existing file
3. Open the Git Backdate panel
4. Set a commit message like "Test backdate commit"
5. Choose a date from last week
6. Select "Entire Project"
7. Click "Create Backdated Commit"
8. Check `git log` to see the backdated commit

### Troubleshooting

- **Extension not loading**: Check the output console for errors
- **Git commands failing**: Ensure you're in a Git repository
- **UI not appearing**: Try refreshing the webview panel
- **Build errors**: Run `npm run esbuild` to rebuild

Enjoy testing your new Git Backdate extension! 🕰️✨
