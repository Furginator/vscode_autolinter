// src/extension.ts - Main extension entry point
import * as vscode from 'vscode';
import { WorkspaceLinter } from './workspaceLinter';
import { DiagnosticProvider } from './diagnosticProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Workspace Linter extension is now active');

    const diagnosticProvider = new DiagnosticProvider();
    const workspaceLinter = new WorkspaceLinter(diagnosticProvider);

    // Register commands
    const startLintingCommand = vscode.commands.registerCommand(
        'workspace-linter.startLinting',
        () => workspaceLinter.startLinting()
    );

    const stopLintingCommand = vscode.commands.registerCommand(
        'workspace-linter.stopLinting',
        () => workspaceLinter.stopLinting()
    );

    const lintNowCommand = vscode.commands.registerCommand(
        'workspace-linter.lintNow',
        () => workspaceLinter.lintWorkspace()
    );

    // Register file system watcher
    const watcher = vscode.workspace.createFileSystemWatcher(
        '**/*.{ts,tsx,js,jsx,py,html,css,scss,sass,json,yaml,yml,md,vue,svelte,astro}'
    );

    watcher.onDidCreate(uri => workspaceLinter.lintFile(uri));
    watcher.onDidChange(uri => workspaceLinter.lintFile(uri));
    watcher.onDidDelete(uri => diagnosticProvider.clearDiagnostics(uri));

    // Auto-start linting on activation
    workspaceLinter.startLinting();

    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.text = "$(check) Workspace Linter";
    statusBarItem.command = 'workspace-linter.lintNow';
    statusBarItem.show();

    context.subscriptions.push(
        startLintingCommand,
        stopLintingCommand,
        lintNowCommand,
        watcher,
        statusBarItem,
        diagnosticProvider
    );
}

export function deactivate() {
    console.log('Workspace Linter extension is now deactivated');
}
