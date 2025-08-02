// src/workspaceLinter.ts - Main linting orchestrator
import * as vscode from 'vscode';
import * as path from 'path';
import { DiagnosticProvider } from './diagnosticProvider';
import { TypeScriptLinter } from './linters/typescriptLinter';
import { PythonLinter } from './linters/pythonLinter';
import { ESLintLinter } from './linters/eslintLinter';
import { HTMLLinter } from './linters/htmlLinter';
import { CSSLinter } from './linters/cssLinter';

export class WorkspaceLinter {
    private isLinting = false;
    private linters: Map<string, any> = new Map();
    private diagnosticProvider: DiagnosticProvider;

    constructor(diagnosticProvider: DiagnosticProvider) {
        this.diagnosticProvider = diagnosticProvider;
        this.initializeLinters();
    }

    private initializeLinters() {
        this.linters.set('typescript', new TypeScriptLinter());
        this.linters.set('javascript', new ESLintLinter());
        this.linters.set('python', new PythonLinter());
        this.linters.set('html', new HTMLLinter());
        this.linters.set('css', new CSSLinter());
    }

    public async startLinting() {
        if (this.isLinting) return;
        
        this.isLinting = true;
        vscode.window.showInformationMessage('Starting workspace-wide linting...');
        
        await this.lintWorkspace();
        
        // Set up periodic re-linting
        setInterval(() => {
            if (this.isLinting) {
                this.lintWorkspace();
            }
        }, 30000); // Re-lint every 30 seconds
    }

    public stopLinting() {
        this.isLinting = false;
        this.diagnosticProvider.clearAllDiagnostics();
        vscode.window.showInformationMessage('Stopped workspace-wide linting');
    }

    public async lintWorkspace() {
        if (!vscode.workspace.workspaceFolders) return;

        // Read gitignore patterns
        const gitignorePatterns = await this.readGitignore();
        console.log(`Found ${gitignorePatterns.length} gitignore patterns`);

        const allFiles = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx,py,html,css,scss,sass}',
            undefined
        );

        // Filter using gitignore + basic exclusions
        const files = allFiles.filter(file => {
            const filePath = file.fsPath;
            
            // Check gitignore first
            if (this.matchesGitignore(filePath, gitignorePatterns)) {
                return false;
            }
            
            // Then basic exclusions as backup
            return this.shouldLintFile(file);
        });

        console.log(`Found ${allFiles.length} total files, filtered to ${files.length} files using gitignore`);

        // Rest of the method stays the same...
        if (files.length > 500) {
            const response = await vscode.window.showWarningMessage(
                `Found ${files.length} files to lint. This might take a while. Continue?`,
                'Yes', 'No'
            );
            if (response !== 'Yes') return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Linting workspace files...",
            cancellable: true
        }, async (progress, token) => {
            const totalFiles = files.length;
            let processedFiles = 0;

            for (const file of files) {
                if (token.isCancellationRequested) break;

                await this.lintFile(file);
                processedFiles++;
                
                progress.report({
                    increment: (100 / totalFiles),
                    message: `${processedFiles}/${totalFiles} files processed`
                });
            }
        });
    }

    public async lintFile(uri: vscode.Uri) {
        const ext = path.extname(uri.fsPath).slice(1);
        const linter = this.getLinterForExtension(ext);
        
        if (!linter) return;

        try {
            const diagnostics = await linter.lint(uri);
            this.diagnosticProvider.setDiagnostics(uri, diagnostics);
        } catch (error) {
            console.error(`Error linting ${uri.fsPath}:`, error);
        }
    }

    private getLinterForExtension(ext: string): any {
        const linterMap: { [key: string]: string } = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'scss': 'css',
            'sass': 'css'
        };

        return this.linters.get(linterMap[ext]);
    }
    private shouldLintFile(uri: vscode.Uri): boolean {
        const filePath = uri.fsPath.toLowerCase();
        
        // Exclude common directories (case insensitive)
        const excludePatterns = [
            'node_modules',
            '/dist/',
            '/build/',
            '/out/',
            '/.git/',
            '/coverage/',
            '/.vscode/',
            '/lib/',
            '/venv/',
            '/__pycache__/',
            '/.next/',
            '/.nuxt/',
            '/target/',
            '/vendor/',
            '/.cache/',
            '/tmp/',
            '/logs/',
            '/temp/',
            '.min.',
            '.bundle.',
            '.compiled.',
            '/assets/',
            '/static/',
            '/public/',
            '/docs/',
            '/test/',
            '/tests/',
            '/.nyc_output/',
            '/cypress/',
            '/e2e/',
            'spec.', // test files
            'test.',
            '.spec.',
            '.test.'
        ];
        
        // Only lint files in common source directories
        const sourcePatterns = [
            '/src/',
            '/source/',
            '/app/',
            '/components/',
            '/pages/',
            '/views/',
            '/utils/',
            '/helpers/',
            '/services/',
            '/api/',
            '/backend/'
        ];
        
        // Must be in a source directory OR be a root-level config file
        const isInSourceDir = sourcePatterns.some(pattern => filePath.includes(pattern));
        const isRootConfig = filePath.split('/').length <= 3; // rough estimate for root level
        
        if (!isInSourceDir && !isRootConfig) {
            return false;
        }
        
        // Exclude any file matching exclude patterns
        return !excludePatterns.some(pattern => filePath.includes(pattern));
    }
    private async readGitignore(): Promise<string[]> {
    const gitignorePatterns: string[] = [];
    
    if (!vscode.workspace.workspaceFolders) return gitignorePatterns;
    
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const gitignorePath = path.join(workspaceRoot, '.gitignore');
        const fs = require('fs');
        
        if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            const lines = gitignoreContent.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                // Skip empty lines and comments
                if (trimmed && !trimmed.startsWith('#')) {
                    gitignorePatterns.push(trimmed);
                }
            }
        }
    } catch (error) {
        console.warn('Failed to read .gitignore:', error);
    }
    
    return gitignorePatterns;
    }
    private matchesGitignore(filePath: string, gitignorePatterns: string[]): boolean {
        const relativePath = vscode.workspace.asRelativePath(filePath);
        
        for (const pattern of gitignorePatterns) {
            // Simple pattern matching (this could be more sophisticated)
            if (pattern.endsWith('/')) {
                // Directory pattern
                if (relativePath.includes(pattern) || relativePath.startsWith(pattern)) {
                    return true;
                }
            } else if (pattern.includes('*')) {
                // Wildcard pattern - convert to regex
                const regexPattern = pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                const regex = new RegExp(regexPattern);
                if (regex.test(relativePath)) {
                    return true;
                }
            } else {
                // Exact match or substring
                if (relativePath === pattern || relativePath.includes(pattern)) {
                    return true;
                }
            }
        }
        
        return false;
    }
}