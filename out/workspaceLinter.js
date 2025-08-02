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
exports.WorkspaceLinter = void 0;
// src/workspaceLinter.ts - Main linting orchestrator
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const typescriptLinter_1 = require("./linters/typescriptLinter");
const pythonLinter_1 = require("./linters/pythonLinter");
const eslintLinter_1 = require("./linters/eslintLinter");
const htmlLinter_1 = require("./linters/htmlLinter");
const cssLinter_1 = require("./linters/cssLinter");
class WorkspaceLinter {
    constructor(diagnosticProvider) {
        this.isLinting = false;
        this.linters = new Map();
        this.diagnosticProvider = diagnosticProvider;
        this.initializeLinters();
    }
    initializeLinters() {
        this.linters.set('typescript', new typescriptLinter_1.TypeScriptLinter());
        this.linters.set('javascript', new eslintLinter_1.ESLintLinter());
        this.linters.set('python', new pythonLinter_1.PythonLinter());
        this.linters.set('html', new htmlLinter_1.HTMLLinter());
        this.linters.set('css', new cssLinter_1.CSSLinter());
    }
    async startLinting() {
        if (this.isLinting)
            return;
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
    stopLinting() {
        this.isLinting = false;
        this.diagnosticProvider.clearAllDiagnostics();
        vscode.window.showInformationMessage('Stopped workspace-wide linting');
    }
    async lintWorkspace() {
        if (!vscode.workspace.workspaceFolders)
            return;
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const files = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx,py,html,css,scss,sass}', // Removed json,yaml,yml,md,vue,svelte,astro
        '{**/node_modules/**,**/dist/**,**/build/**,**/out/**,**/.git/**,**/coverage/**,**/.vscode/**,**/lib/**,**/venv/**,**/__pycache__/**}');
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Linting workspace files...",
            cancellable: true
        }, async (progress, token) => {
            const totalFiles = files.length;
            let processedFiles = 0;
            for (const file of files) {
                if (token.isCancellationRequested)
                    break;
                if (!this.shouldLintFile(file))
                    continue; // Add this line
                await this.lintFile(file);
                processedFiles++;
                progress.report({
                    increment: (100 / totalFiles),
                    message: `${processedFiles}/${totalFiles} files processed`
                });
            }
        });
    }
    async lintFile(uri) {
        const ext = path.extname(uri.fsPath).slice(1);
        const linter = this.getLinterForExtension(ext);
        if (!linter)
            return;
        try {
            const diagnostics = await linter.lint(uri);
            this.diagnosticProvider.setDiagnostics(uri, diagnostics);
        }
        catch (error) {
            console.error(`Error linting ${uri.fsPath}:`, error);
        }
    }
    getLinterForExtension(ext) {
        const linterMap = {
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
    shouldLintFile(uri) {
        const filePath = uri.fsPath;
        // Exclude common directories
        const excludePatterns = [
            '/node_modules/',
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
            '/tmp/'
        ];
        return !excludePatterns.some(pattern => filePath.includes(pattern));
    }
}
exports.WorkspaceLinter = WorkspaceLinter;
//# sourceMappingURL=workspaceLinter.js.map