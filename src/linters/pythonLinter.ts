// src/linters/pythonLinter.ts
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class PythonLinter {
    public async lint(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            // Try to run flake8 or pylint
            const result = await this.runPythonLinter(uri.fsPath);
            return this.parsePythonLinterOutput(result, uri);
        } catch (error) {
            console.warn('Python linting failed:', error);
            return diagnostics;
        }
    }

    private runPythonLinter(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Try flake8 first, then pylint
            const commands = [
                'flake8 --format="%(path)s:%(row)d:%(col)d: %(code)s %(text)s" ' + filePath,
                'pylint --output-format=text --reports=no ' + filePath
            ];

            let commandIndex = 0;
            const tryNextCommand = () => {
                if (commandIndex >= commands.length) {
                    reject(new Error('No Python linter available'));
                    return;
                }

                const command = commands[commandIndex];
                cp.exec(command, (error, stdout, stderr) => {
                    if (error && error.code !== 1) { // Code 1 just means there are linting errors
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

    private parsePythonLinterOutput(output: string, uri: vscode.Uri): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;

            // Parse flake8 format: filename:line:col: code message
            const flake8Match = line.match(/^(.+):(\d+):(\d+):\s*(\w+)\s+(.+)$/);
            if (flake8Match) {
                const [, , lineNum, colNum, code, message] = flake8Match;
                const range = new vscode.Range(
                    parseInt(lineNum) - 1, parseInt(colNum) - 1,
                    parseInt(lineNum) - 1, parseInt(colNum) + 10
                );
                
                const severity = code.startsWith('E') ? 
                    vscode.DiagnosticSeverity.Error : 
                    vscode.DiagnosticSeverity.Warning;

                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `${code}: ${message}`,
                    severity
                ));
                continue;
            }

            // Parse pylint format
            const pylintMatch = line.match(/^(.+):(\d+):(\d+):\s*(\w+):\s*(.+)$/);
            if (pylintMatch) {
                const [, , lineNum, colNum, severity, message] = pylintMatch;
                const range = new vscode.Range(
                    parseInt(lineNum) - 1, parseInt(colNum) - 1,
                    parseInt(lineNum) - 1, parseInt(colNum) + 10
                );
                
                const vsSeverity = severity === 'error' ? 
                    vscode.DiagnosticSeverity.Error : 
                    vscode.DiagnosticSeverity.Warning;

                diagnostics.push(new vscode.Diagnostic(
                    range,
                    message,
                    vsSeverity
                ));
            }
        }

        return diagnostics;
    }
}