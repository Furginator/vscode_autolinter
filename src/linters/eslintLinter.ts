// src/linters/eslintLinter.ts
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class ESLintLinter {
    public async lint(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const result = await this.runESLint(uri.fsPath);
            return this.parseESLintOutput(result);
        } catch (error) {
            console.warn('ESLint failed:', error);
            return diagnostics;
        }
    }

    private runESLint(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
            const cwd = workspaceFolder?.uri.fsPath || path.dirname(filePath);
            
            // Try npx eslint first, then global eslint
            const commands = [
                `npx eslint "${filePath}" --format json`,
                `eslint "${filePath}" --format json`
            ];

            let commandIndex = 0;
            const tryNextCommand = () => {
                if (commandIndex >= commands.length) {
                    reject(new Error('ESLint not available'));
                    return;
                }

                const command = commands[commandIndex];
                cp.exec(command, { cwd }, (error, stdout, stderr) => {
                    if (error && !stdout) { // If there's an error but no output, try next command
                        commandIndex++;
                        tryNextCommand();
                        return;
                    }
                    resolve(stdout);
                });
            };

            tryNextCommand();
        });
    }

    private parseESLintOutput(output: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const results = JSON.parse(output);
            
            if (Array.isArray(results) && results.length > 0) {
                const fileResult = results[0];
                
                if (fileResult.messages) {
                    for (const message of fileResult.messages) {
                        const range = new vscode.Range(
                            (message.line || 1) - 1,
                            (message.column || 1) - 1,
                            (message.endLine || message.line || 1) - 1,
                            (message.endColumn || message.column + 1 || 1) - 1
                        );

                        const severity = message.severity === 2 ? 
                            vscode.DiagnosticSeverity.Error : 
                            vscode.DiagnosticSeverity.Warning;

                        const diagnostic = new vscode.Diagnostic(
                            range,
                            message.message,
                            severity
                        );

                        if (message.ruleId) {
                            diagnostic.code = message.ruleId;
                            diagnostic.source = 'eslint';
                        }

                        diagnostics.push(diagnostic);
                    }
                }
            }
        } catch (parseError) {
            console.warn('Failed to parse ESLint output:', parseError);
        }

        return diagnostics;
    }
}