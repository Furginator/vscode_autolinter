"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESLintLinter = void 0;
// src/linters/eslintLinter.ts
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
class ESLintLinter {
    async lint(uri) {
        const diagnostics = [];
        try {
            const result = await this.runESLint(uri.fsPath);
            return this.parseESLintOutput(result);
        }
        catch (error) {
            console.warn('ESLint failed:', error);
            return diagnostics;
        }
    }
    runESLint(filePath) {
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
    parseESLintOutput(output) {
        const diagnostics = [];
        try {
            const results = JSON.parse(output);
            if (Array.isArray(results) && results.length > 0) {
                const fileResult = results[0];
                if (fileResult.messages) {
                    for (const message of fileResult.messages) {
                        const range = new vscode.Range((message.line || 1) - 1, (message.column || 1) - 1, (message.endLine || message.line || 1) - 1, (message.endColumn || message.column + 1 || 1) - 1);
                        const severity = message.severity === 2 ?
                            vscode.DiagnosticSeverity.Error :
                            vscode.DiagnosticSeverity.Warning;
                        const diagnostic = new vscode.Diagnostic(range, message.message, severity);
                        if (message.ruleId) {
                            diagnostic.code = message.ruleId;
                            diagnostic.source = 'eslint';
                        }
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
        catch (parseError) {
            console.warn('Failed to parse ESLint output:', parseError);
        }
        return diagnostics;
    }
}
exports.ESLintLinter = ESLintLinter;
//# sourceMappingURL=eslinterLinter.js.map