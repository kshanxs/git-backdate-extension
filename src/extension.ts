import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitBackdatePanel } from './gitBackdatePanel';
import { GitService } from './gitService';

export function activate(context: vscode.ExtensionContext) {
    console.log('Git Backdate extension is now active!');

    const gitService = new GitService();

    // Register command to open the backdate panel
    const openPanelCommand = vscode.commands.registerCommand('gitBackdate.openPanel', () => {
        GitBackdatePanel.createOrShow(context.extensionUri, gitService);
    });

    // Register command to backdate a specific file
    const backdateFileCommand = vscode.commands.registerCommand('gitBackdate.backdateFile', (uri: vscode.Uri) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        if (uri && uri.fsPath) {
            // Validate that the file is within the current workspace
            if (workspaceRoot && !uri.fsPath.startsWith(workspaceRoot)) {
                vscode.window.showErrorMessage('Selected file is outside the current workspace. Please select a file within the Git repository.');
                return;
            }
            GitBackdatePanel.createOrShow(context.extensionUri, gitService, uri.fsPath);
        } else {
            // If no file is selected, get the currently active file
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const activeFilePath = activeEditor.document.uri.fsPath;
                // Validate that the active file is within the current workspace
                if (workspaceRoot && !activeFilePath.startsWith(workspaceRoot)) {
                    vscode.window.showErrorMessage('Active file is outside the current workspace. Please open a file within the Git repository.');
                    return;
                }
                GitBackdatePanel.createOrShow(context.extensionUri, gitService, activeFilePath);
            } else {
                vscode.window.showWarningMessage('Please select a file to backdate.');
            }
        }
    });

    // Register command to backdate entire project
    const backdateProjectCommand = vscode.commands.registerCommand('gitBackdate.backdateProject', () => {
        GitBackdatePanel.createOrShow(context.extensionUri, gitService);
    });

    context.subscriptions.push(openPanelCommand, backdateFileCommand, backdateProjectCommand);

    // Register webview panel serializer for persistence
    if (vscode.window.registerWebviewPanelSerializer) {
        vscode.window.registerWebviewPanelSerializer(GitBackdatePanel.viewType, {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
                GitBackdatePanel.revive(webviewPanel, context.extensionUri, gitService);
            }
        });
    }
}

export function deactivate() {
    console.log('Git Backdate extension deactivated');
}
