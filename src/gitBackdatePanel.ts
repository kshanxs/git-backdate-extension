import * as vscode from 'vscode';
import * as path from 'path';
import { GitService, BackdateOptions } from './gitService';

export class GitBackdatePanel {
    public static currentPanel: GitBackdatePanel | undefined;
    public static readonly viewType = 'gitBackdate';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _gitService: GitService;
    private _disposables: vscode.Disposable[] = [];
    private _selectedFilePath?: string;

    public static createOrShow(extensionUri: vscode.Uri, gitService: GitService, selectedFilePath?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (GitBackdatePanel.currentPanel) {
            GitBackdatePanel.currentPanel._selectedFilePath = selectedFilePath;
            GitBackdatePanel.currentPanel._panel.reveal(column);
            GitBackdatePanel.currentPanel._update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            GitBackdatePanel.viewType,
            'Git Backdate',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        GitBackdatePanel.currentPanel = new GitBackdatePanel(panel, extensionUri, gitService, selectedFilePath);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, gitService: GitService) {
        GitBackdatePanel.currentPanel = new GitBackdatePanel(panel, extensionUri, gitService);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, gitService: GitService, selectedFilePath?: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._gitService = gitService;
        this._selectedFilePath = selectedFilePath;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'backdate':
                        await this._handleBackdateRequest(message.data);
                        break;
                    case 'getModifiedFiles':
                        await this._sendModifiedFiles();
                        break;
                    case 'checkGitStatus':
                        await this._sendGitStatus();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _handleBackdateRequest(data: any) {
        try {
            const options: BackdateOptions = {
                commitMessage: data.commitMessage,
                backdateString: data.backdateString,
                filePath: data.includeAllFiles ? undefined : (data.selectedFile || this._selectedFilePath),
                includeAllFiles: data.includeAllFiles
            };

            await this._gitService.backdateCommit(options);

            if (data.pushToRemote) {
                await this._gitService.pushToRemote();
            }

            this._panel.webview.postMessage({
                type: 'success',
                message: 'Commit created successfully!'
            });

        } catch (error) {
            this._panel.webview.postMessage({
                type: 'error',
                message: error instanceof Error ? error.message : 'An unknown error occurred'
            });
        }
    }

    private async _sendModifiedFiles() {
        try {
            const files = await this._gitService.getModifiedFiles();
            this._panel.webview.postMessage({
                type: 'modifiedFiles',
                files: files
            });
        } catch (error) {
            console.error('Failed to get modified files:', error);
        }
    }

    private async _sendGitStatus() {
        try {
            const isGitRepo = await this._gitService.isGitRepository();
            const currentBranch = isGitRepo ? await this._gitService.getCurrentBranch() : '';
            
            this._panel.webview.postMessage({
                type: 'gitStatus',
                isGitRepo,
                currentBranch,
                selectedFile: this._selectedFilePath
            });
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'gitStatus',
                isGitRepo: false,
                currentBranch: '',
                selectedFile: this._selectedFilePath
            });
        }
    }

    public dispose() {
        GitBackdatePanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
        );
        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
        );
        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">
                <title>Git Backdate</title>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>🕰️ Git Backdate</h1>
                        <p>Commit and push files with custom backdated timestamps</p>
                    </header>

                    <div id="gitStatus" class="status-section"></div>

                    <div class="form-section">
                        <div class="input-group">
                            <label for="commitMessage">Commit Message:</label>
                            <input type="text" id="commitMessage" placeholder="Enter your commit message..." required>
                        </div>

                        <div class="input-group">
                            <label for="backdateInput">Backdate to:</label>
                            <input type="datetime-local" id="backdateInput" required>
                        </div>

                        <div class="input-group">
                            <label>Scope:</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" name="scope" value="file" id="scopeFile">
                                    Selected File
                                </label>
                                <label>
                                    <input type="radio" name="scope" value="all" id="scopeAll" checked>
                                    Entire Project
                                </label>
                            </div>
                        </div>

                        <div id="fileSelection" class="input-group" style="display: none;">
                            <label for="fileSelect">Select File:</label>
                            <select id="fileSelect">
                                <option value="">Choose a file...</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <label>
                                <input type="checkbox" id="pushToRemote">
                                Push to remote repository after commit
                            </label>
                        </div>

                        <div class="button-group">
                            <button id="backdateBtn" class="primary-button">Create Backdated Commit</button>
                            <button id="refreshBtn" class="secondary-button">Refresh Status</button>
                        </div>
                    </div>

                    <div id="output" class="output-section"></div>
                </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
