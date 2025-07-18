import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BackdateOptions {
    filePath?: string;
    commitMessage: string;
    backdateString: string; // ISO date string
    includeAllFiles?: boolean;
}

export class GitService {
    private workspaceRoot: string | undefined;

    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    async isGitRepository(): Promise<boolean> {
        if (!this.workspaceRoot) {
            return false;
        }

        try {
            await execAsync('git rev-parse --git-dir', { cwd: this.workspaceRoot });
            return true;
        } catch {
            return false;
        }
    }

    async getGitStatus(): Promise<string> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: this.workspaceRoot });
            return stdout;
        } catch (error) {
            throw new Error(`Failed to get git status: ${error}`);
        }
    }

    async backdateCommit(options: BackdateOptions): Promise<void> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        if (!await this.isGitRepository()) {
            throw new Error('Current workspace is not a git repository');
        }

        try {
            // Format the date for git
            const date = new Date(options.backdateString);
            const gitDateFormat = date.toISOString();

            // Add files to staging
            if (options.includeAllFiles) {
                await execAsync('git add .', { cwd: this.workspaceRoot });
            } else if (options.filePath) {
                const relativePath = path.relative(this.workspaceRoot, options.filePath);
                await execAsync(`git add "${relativePath}"`, { cwd: this.workspaceRoot });
            } else {
                throw new Error('No files specified for commit');
            }

            // Create commit with backdated timestamp
            const commitCommand = `git commit -m "${options.commitMessage}" --date="${gitDateFormat}"`;
            const env = {
                ...process.env,
                GIT_AUTHOR_DATE: gitDateFormat,
                GIT_COMMITTER_DATE: gitDateFormat
            };

            await execAsync(commitCommand, { 
                cwd: this.workspaceRoot,
                env: env
            });

            vscode.window.showInformationMessage(`Successfully created backdated commit: ${options.commitMessage}`);
        } catch (error) {
            throw new Error(`Failed to create backdated commit: ${error}`);
        }
    }

    async pushToRemote(): Promise<void> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        try {
            await execAsync('git push', { cwd: this.workspaceRoot });
            vscode.window.showInformationMessage('Successfully pushed to remote repository');
        } catch (error) {
            throw new Error(`Failed to push to remote: ${error}`);
        }
    }

    async getCurrentBranch(): Promise<string> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        try {
            const { stdout } = await execAsync('git branch --show-current', { cwd: this.workspaceRoot });
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get current branch: ${error}`);
        }
    }

    async getModifiedFiles(): Promise<string[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        try {
            const { stdout } = await execAsync('git status --porcelain', { cwd: this.workspaceRoot });
            const files = stdout
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => line.substring(3).trim());
            
            return files;
        } catch {
            return [];
        }
    }
}
