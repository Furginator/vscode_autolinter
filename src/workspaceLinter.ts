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

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx,py,html,css,scss,sass,json,yaml,yml,md,vue,svelte,astro}',
            '**/node_modules/**'
        );

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
}
