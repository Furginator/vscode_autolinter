// src/linters/pythonLinter.ts - Python specific linter
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { ILinter } from '../workspaceLinter';
import { LintIssue as DiagnosticLintIssue } from '../diagnosticProvider';

export class PythonLinter implements ILinter {
    public isEnabled(): boolean {
        return vscode.workspace.getConfiguration('autolinter').get('python.enabled', true);
    }

    public getSupportedExtensions(): string[] {
        return ['py', 'pyw'];
    }

    public async lint(uri: vscode.Uri): Promise<DiagnosticLintIssue[]> {
        const issues: DiagnosticLintIssue[] = [];

        try {
            const result = await this.runPythonLinter(uri.fsPath);
            return this.parsePythonLinterOutput(result);
        } catch (error) {
            console.warn('Python linting failed:', error);
            return issues;
        }
    }

    private runPythonLinter(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const commands = [
                `flake8 --format="%(path)s:%(row)d:%(col)d: %(code)s %(text)s" "${filePath}"`,
                `pylint --output-format=text --reports=no "${filePath}"`
            ];
            let commandIndex = 0;

            const tryNextCommand = () => {
                if (commandIndex >= commands.length) {
                    reject(new Error('No Python linter available'));
                    return;
                }
                const command = commands[commandIndex];
                cp.exec(command, (error, stdout, stderr) => {
                    if (error && error.code !== 1) { // Code 1 means linting issues found
                        commandIndex++;
                        tryNextCommand();
                        return;
                    }
                    resolve(stdout || stderr);
                });
            };

            tryNextCommand();
        });
    }

    private parsePythonLinterOutput(output: string): DiagnosticLintIssue[] {
        const issues: DiagnosticLintIssue[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;

            // Parse flake8 format: filename:line:col: code message
            const flake8Match = line.match(/^(.+):(\d+):(\d+):\s*(\w+)\s+(.+)$/);
            if (flake8Match) {
                const [, , lineNum, colNum, code, message] = flake8Match;
                issues.push({
                    message: `${code}: ${message}`,
                    severity: code.startsWith('E') ? 'error' : 'warning',
                    line: parseInt(lineNum),
                    column: parseInt(colNum),
                    endLine: parseInt(lineNum),
                    endColumn: parseInt(colNum) + 10,
                    source: 'flake8',
                    code
                });
                continue;
            }

            // Parse pylint format: filename:line:col: severity: message
            const pylintMatch = line.match(/^(.+):(\d+):(\d+):\s*(\w+):\s*(.+)$/);
            if (pylintMatch) {
                const [, , lineNum, colNum, severity, message] = pylintMatch;
                issues.push({
                    message,
                    severity: severity.toLowerCase() === 'error' ? 'error' : 'warning',
                    line: parseInt(lineNum),
                    column: parseInt(colNum),
                    endLine: parseInt(lineNum),
                    endColumn: parseInt(colNum) + 10,
                    source: 'pylint',
                    code: severity
                });
            }
        }

        return issues;
    }
}