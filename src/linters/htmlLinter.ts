// src/linters/htmlLinter.ts - HTML specific linter
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as cp from 'child_process';
import { ILinter } from '../workspaceLinter';
import { LintIssue as DiagnosticLintIssue } from '../diagnosticProvider';

export class HTMLLinter implements ILinter {
    public isEnabled(): boolean {
        return vscode.workspace.getConfiguration('autolinter').get('html.enabled', true);
    }

    public getSupportedExtensions(): string[] {
        return ['html', 'htm', 'xhtml'];
    }

    public async lint(uri: vscode.Uri): Promise<DiagnosticLintIssue[]> {
        const issues: DiagnosticLintIssue[] = [];

        try {
            const filePath = uri.fsPath;
            if (!fs.existsSync(filePath)) {
                console.warn(`File does not exist: ${filePath}`);
                return issues;
            }
            const result = await this.runHTMLLinter(filePath);
            return this.parseHTMLLinterOutput(result);
        } catch (error) {
            console.warn('HTML linting failed:', error);
            return issues;
        }
    }

    private runHTMLLinter(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const command = `htmlhint "${filePath}"`;
            cp.exec(command, (error: cp.ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout || stderr);
            });
        });
    }

    private parseHTMLLinterOutput(output: string): DiagnosticLintIssue[] {
        const issues: DiagnosticLintIssue[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            const match = line.match(/(.+):(\d+):(\d+):\s*(.+)/);
            if (match) {
                const [, , lineNum, colNum, message] = match;
                issues.push({
                    message,
                    severity: 'warning',
                    line: parseInt(lineNum),
                    column: parseInt(colNum),
                    endLine: parseInt(lineNum),
                    endColumn: parseInt(colNum) + 1,
                    source: 'htmlhint'
                });
            }
        }

        return issues;
    }
}