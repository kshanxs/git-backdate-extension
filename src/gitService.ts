import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BackdateOptions {
    filePath?: string;
    selectedFiles?: string[];
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
            } else if (options.selectedFiles && options.selectedFiles.length > 0) {
                // Handle multiple files
                for (const filePath of options.selectedFiles) {
                    const absoluteFilePath = path.resolve(this.workspaceRoot, filePath);
                    const absoluteWorkspaceRoot = path.resolve(this.workspaceRoot);
                    
                    if (!absoluteFilePath.startsWith(absoluteWorkspaceRoot)) {
                        throw new Error(`File '${filePath}' is outside the Git repository.`);
                    }
                    
                    if (!fs.existsSync(absoluteFilePath)) {
                        throw new Error(`File '${filePath}' does not exist.`);
                    }
                    
                    await execAsync(`git add "${filePath}"`, { cwd: this.workspaceRoot });
                }
            } else if (options.filePath) {
                // Handle single file (backward compatibility)
                const absoluteFilePath = path.resolve(options.filePath);
                const absoluteWorkspaceRoot = path.resolve(this.workspaceRoot);
                
                if (!absoluteFilePath.startsWith(absoluteWorkspaceRoot)) {
                    throw new Error(`File '${options.filePath}' is outside the Git repository. Please select a file within the current workspace.`);
                }
                
                const relativePath = path.relative(this.workspaceRoot, absoluteFilePath);
                
                // Check if file exists
                try {
                    await execAsync(`git ls-files --error-unmatch "${relativePath}"`, { cwd: this.workspaceRoot });
                } catch {
                    // File is not tracked by git, check if it exists in filesystem
                    if (!fs.existsSync(absoluteFilePath)) {
                        throw new Error(`File '${relativePath}' does not exist.`);
                    }
                }
                
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
            // First check if we have a remote
            const { stdout: remotes } = await execAsync('git remote', { cwd: this.workspaceRoot });
            if (!remotes.trim()) {
                throw new Error('No remote repository configured. Please add a remote first.');
            }

            // Check if current branch has upstream
            const currentBranch = await this.getCurrentBranch();
            try {
                await execAsync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, { cwd: this.workspaceRoot });
                // Has upstream, normal push
                await execAsync('git push', { cwd: this.workspaceRoot });
            } catch {
                // No upstream, need to set it
                await execAsync(`git push --set-upstream origin ${currentBranch}`, { cwd: this.workspaceRoot });
            }
            
            vscode.window.showInformationMessage('Successfully pushed to remote repository');
        } catch (error) {
            throw new Error(`Failed to push to remote: ${error}`);
        }
    }

    async publishBranch(): Promise<void> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        try {
            const currentBranch = await this.getCurrentBranch();
            await execAsync(`git push --set-upstream origin ${currentBranch}`, { cwd: this.workspaceRoot });
            vscode.window.showInformationMessage(`Successfully published branch '${currentBranch}' to remote repository`);
        } catch (error) {
            throw new Error(`Failed to publish branch: ${error}`);
        }
    }

    async hasRemote(): Promise<boolean> {
        if (!this.workspaceRoot) {
            return false;
        }

        try {
            const { stdout } = await execAsync('git remote', { cwd: this.workspaceRoot });
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    async hasUpstream(): Promise<boolean> {
        if (!this.workspaceRoot) {
            return false;
        }

        try {
            const currentBranch = await this.getCurrentBranch();
            await execAsync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`, { cwd: this.workspaceRoot });
            return true;
        } catch {
            return false;
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
            // Use git status --porcelain to get modified files within the repository
            const { stdout } = await execAsync('git status --porcelain', { cwd: this.workspaceRoot });
            const files = stdout
                .split('\n')
                .filter(line => line.trim() !== '')
                .map(line => {
                    // Remove the status prefix (first 3 characters) to get the file path
                    const filePath = line.substring(3).trim();
                    // Remove quotes if present
                    return filePath.replace(/^"(.*)"$/, '$1');
                })
                .filter(filePath => {
                    // Ensure the file is actually within the repository
                    const fullPath = path.join(this.workspaceRoot!, filePath);
                    return fs.existsSync(fullPath);
                });
            
            return files;
        } catch {
            return [];
        }
    }

    async hasUnpushedCommits(): Promise<boolean> {
        if (!this.workspaceRoot) {
            return false;
        }

        try {
            // Check if there are commits ahead of origin
            const { stdout } = await execAsync('git rev-list --count HEAD ^origin/HEAD 2>/dev/null || echo "0"', { cwd: this.workspaceRoot });
            return parseInt(stdout.trim()) > 0;
        } catch {
            return false;
        }
    }

    async getFileLastCommitInfo(filePath: string): Promise<{isPushed: boolean, commitHash: string, date: string} | null> {
        if (!this.workspaceRoot) {
            return null;
        }

        try {
            const relativePath = path.relative(this.workspaceRoot, filePath);
            
            // Get the last commit that modified this file
            const { stdout: lastCommit } = await execAsync(`git log -1 --format="%H|%ai" -- "${relativePath}"`, { cwd: this.workspaceRoot });
            
            if (!lastCommit.trim()) {
                return null;
            }

            const [commitHash, date] = lastCommit.trim().split('|');
            
            // Check if this commit exists on the remote
            try {
                await execAsync(`git branch -r --contains ${commitHash}`, { cwd: this.workspaceRoot });
                return { isPushed: true, commitHash, date };
            } catch {
                return { isPushed: false, commitHash, date };
            }
        } catch {
            return null;
        }
    }
}
