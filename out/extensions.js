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
exports.deactivate = exports.activate = void 0;
// src/extension.ts - Main extension entry point
const vscode = __importStar(require("vscode"));
const workspaceLinter_1 = require("./workspaceLinter");
const diagnosticProvider_1 = require("./diagnosticProvider");
function activate(context) {
    console.log('Workspace Linter extension is now active');
    const diagnosticProvider = new diagnosticProvider_1.DiagnosticProvider();
    const workspaceLinter = new workspaceLinter_1.WorkspaceLinter(diagnosticProvider);
    // Register commands
    const startLintingCommand = vscode.commands.registerCommand('workspace-linter.startLinting', () => workspaceLinter.startLinting());
    const stopLintingCommand = vscode.commands.registerCommand('workspace-linter.stopLinting', () => workspaceLinter.stopLinting());
    const lintNowCommand = vscode.commands.registerCommand('workspace-linter.lintNow', () => workspaceLinter.lintWorkspace());
    // Register file system watcher
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx,py,html,css,scss,sass,json,yaml,yml,md,vue,svelte,astro}');
    watcher.onDidCreate(uri => workspaceLinter.lintFile(uri));
    watcher.onDidChange(uri => workspaceLinter.lintFile(uri));
    watcher.onDidDelete(uri => diagnosticProvider.clearDiagnostics(uri));
    // Auto-start linting on activation
    workspaceLinter.startLinting();
    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(check) Workspace Linter";
    statusBarItem.command = 'workspace-linter.lintNow';
    statusBarItem.show();
    context.subscriptions.push(startLintingCommand, stopLintingCommand, lintNowCommand, watcher, statusBarItem, diagnosticProvider);
}
exports.activate = activate;
function deactivate() {
    console.log('Workspace Linter extension is now deactivated');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extensions.js.map