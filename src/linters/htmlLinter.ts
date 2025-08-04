// src/linters/htmlLinter.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

export class HTMLLinter {
    public isEnabled(): boolean {
        // Check if HTML linting is enabled in workspace configuration
        const config = vscode.workspace.getConfiguration('autolinter');
        return config.get('html.enabled', true);
    }

    public getSupportedExtensions(): string[] {
        return ['.html', '.htm', '.xhtml'];
    }

    public async lint(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const filePath = uri.fsPath;
            if (!fs.existsSync(filePath)) {
                console.warn(`File does not exist: ${filePath}`);
                return diagnostics;
            }

            // Here you would typically run an HTML linter like `htmlhint` or similar
            const result = await this.runHTMLLinter(filePath);
            return this.parseHTMLLinterOutput(result, uri);
        } catch (error) {
            console.warn('HTML linting failed:', error);
            return diagnostics;
        }
    }

    private runHTMLLinter(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Example command, replace with actual HTML linter command
            const command = `htmlhint ${filePath}`;
            cp.exec(command, (error: cp.ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout || stderr);
            });
        });
    }

    private parseHTMLLinterOutput(output: string, uri: vscode.Uri): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            const match = line.match(/(.+):(\d+):(\d+):\s*(.+)/);
            if (match) {
                const filePath = match[1];
                const lineNumber = parseInt(match[2], 10) - 1; // Convert to 0-based index
                const columnNumber = parseInt(match[3], 10) - 1; // Convert to 0-based index
                const message = match[4];

                const range = new vscode.Range(lineNumber, columnNumber, lineNumber, columnNumber + 1);
                const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
    }
}