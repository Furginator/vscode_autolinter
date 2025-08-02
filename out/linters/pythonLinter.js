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
exports.PythonLinter = void 0;
// src/linters/pythonLinter.ts
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
class PythonLinter {
    async lint(uri) {
        const diagnostics = [];
        try {
            // Try to run flake8 or pylint
            const result = await this.runPythonLinter(uri.fsPath);
            return this.parsePythonLinterOutput(result, uri);
        }
        catch (error) {
            console.warn('Python linting failed:', error);
            return diagnostics;
        }
    }
    runPythonLinter(filePath) {
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
    parsePythonLinterOutput(output, uri) {
        const diagnostics = [];
        const lines = output.split('\n');
        for (const line of lines) {
            if (!line.trim())
                continue;
            // Parse flake8 format: filename:line:col: code message
            const flake8Match = line.match(/^(.+):(\d+):(\d+):\s*(\w+)\s+(.+)$/);
            if (flake8Match) {
                const [, , lineNum, colNum, code, message] = flake8Match;
                const range = new vscode.Range(parseInt(lineNum) - 1, parseInt(colNum) - 1, parseInt(lineNum) - 1, parseInt(colNum) + 10);
                const severity = code.startsWith('E') ?
                    vscode.DiagnosticSeverity.Error :
                    vscode.DiagnosticSeverity.Warning;
                diagnostics.push(new vscode.Diagnostic(range, `${code}: ${message}`, severity));
                continue;
            }
            // Parse pylint format
            const pylintMatch = line.match(/^(.+):(\d+):(\d+):\s*(\w+):\s*(.+)$/);
            if (pylintMatch) {
                const [, , lineNum, colNum, severity, message] = pylintMatch;
                const range = new vscode.Range(parseInt(lineNum) - 1, parseInt(colNum) - 1, parseInt(lineNum) - 1, parseInt(colNum) + 10);
                const vsSeverity = severity === 'error' ?
                    vscode.DiagnosticSeverity.Error :
                    vscode.DiagnosticSeverity.Warning;
                diagnostics.push(new vscode.Diagnostic(range, message, vsSeverity));
            }
        }
        return diagnostics;
    }
}
exports.PythonLinter = PythonLinter;
//# sourceMappingURL=pythonLinter.js.map