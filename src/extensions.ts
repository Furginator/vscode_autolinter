// src/extensions.ts - Main extension entry point
import * as vscode from 'vscode';
import { WorkspaceLinter } from './workspaceLinter';
import { DiagnosticProvider } from './diagnosticProvider';

// Global extension state
let diagnosticProvider: DiagnosticProvider;
let workspaceLinter: WorkspaceLinter;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        console.log('VS Code AutoLinter: Activating extension...');
        
        // Initialize core services
        diagnosticProvider = new DiagnosticProvider();
        workspaceLinter = new WorkspaceLinter(diagnosticProvider);
        
        // Register extension commands
        registerCommands(context);
        
        // Set up file system monitoring
        setupFileSystemWatchers(context);
        
        // Set up editor event listeners
        setupEditorEventListeners(context);
        
        // Initialize status bar
        setupStatusBar(context);
        
        // Auto-start linting for current workspace
        await initializeWorkspaceLinting();
        
        console.log('VS Code AutoLinter: Extension activated successfully');
        
    } catch (error) {
        console.error('VS Code AutoLinter: Failed to activate extension:', error);
        vscode.window.showErrorMessage(`AutoLinter activation failed: ${error}`);
    }
}

export async function deactivate(): Promise<void> {
    try {
        console.log('VS Code AutoLinter: Deactivating extension...');
        
        // Stop any ongoing linting operations
        if (workspaceLinter) {
            await workspaceLinter.stopLinting();
        }
        
        // Clear all diagnostics
        if (diagnosticProvider) {
            diagnosticProvider.clearAllDiagnostics();
        }
        
        console.log('VS Code AutoLinter: Extension deactivated successfully');
        
    } catch (error) {
        console.error('VS Code AutoLinter: Error during deactivation:', error);
    }
}

function registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
        vscode.commands.registerCommand(
            'autolinter.startLinting',
            async () => {
                try {
                    await workspaceLinter.startLinting();
                    updateStatusBar('$(check) AutoLinter: Active');
                    vscode.window.showInformationMessage('AutoLinter started');
                } catch (error) {
                    handleCommandError('start linting', error);
                }
            }
        ),
        
        vscode.commands.registerCommand(
            'autolinter.stopLinting',
            async () => {
                try {
                    await workspaceLinter.stopLinting();
                    updateStatusBar('$(x) AutoLinter: Stopped');
                    vscode.window.showInformationMessage('AutoLinter stopped');
                } catch (error) {
                    handleCommandError('stop linting', error);
                }
            }
        ),
        
        vscode.commands.registerCommand(
            'autolinter.lintWorkspace',
            async () => {
                try {
                    updateStatusBar('$(sync~spin) AutoLinter: Scanning...');
                    await workspaceLinter.lintWorkspace();
                    updateStatusBar('$(check) AutoLinter: Complete');
                } catch (error) {
                    handleCommandError('lint workspace', error);
                    updateStatusBar('$(alert) AutoLinter: Error');
                }
            }
        ),
        
        vscode.commands.registerCommand(
            'autolinter.lintCurrentFile',
            async () => {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('No active file to lint');
                    return;
                }
                
                try {
                    await workspaceLinter.lintFile(activeEditor.document.uri);
                    vscode.window.showInformationMessage('Current file linted');
                } catch (error) {
                    handleCommandError('lint current file', error);
                }
            }
        ),
        
        vscode.commands.registerCommand(
            'autolinter.clearDiagnostics',
            () => {
                try {
                    diagnosticProvider.clearAllDiagnostics();
                    vscode.window.showInformationMessage('All diagnostics cleared');
                } catch (error) {
                    handleCommandError('clear diagnostics', error);
                }
            }
        )
    ];
    
    context.subscriptions.push(...commands);
}

function setupFileSystemWatchers(context: vscode.ExtensionContext): void {
    // Watch for file changes in supported languages
    const watcher = vscode.workspace.createFileSystemWatcher(
        '**/*.{ts,tsx,js,jsx,py,html,css,scss,sass,json,yaml,yml,md,vue,svelte,astro}'
    );
    
    // Handle file events with debouncing
    let fileChangeTimeout: NodeJS.Timeout;
    
    const handleFileChange = (uri: vscode.Uri) => {
        clearTimeout(fileChangeTimeout);
        fileChangeTimeout = setTimeout(async () => {
            try {
                await workspaceLinter.lintFile(uri);
            } catch (error) {
                console.error(`Failed to lint file ${uri.fsPath}:`, error);
            }
        }, 300); // 300ms debounce
    };
    
    watcher.onDidCreate(handleFileChange);
    watcher.onDidChange(handleFileChange);
    watcher.onDidDelete(uri => {
        try {
            diagnosticProvider.clearDiagnostics(uri);
        } catch (error) {
            console.error(`Failed to clear diagnostics for ${uri.fsPath}:`, error);
        }
    });
    
    context.subscriptions.push(watcher);
}

function setupEditorEventListeners(context: vscode.ExtensionContext): void {
    // Listen to document open events
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(
        async (document) => {
            if (shouldLintDocument(document)) {
                try {
                    await workspaceLinter.lintFile(document.uri);
                } catch (error) {
                    console.error(`Failed to lint opened document ${document.uri.fsPath}:`, error);
                }
            }
        }
    );
    
    // Listen to document save events
    const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument(
        async (document) => {
            if (shouldLintDocument(document)) {
                try {
                    await workspaceLinter.lintFile(document.uri);
                } catch (error) {
                    console.error(`Failed to lint saved document ${document.uri.fsPath}:`, error);
                }
            }
        }
    );
    
    // Listen to document close events
    const onDidCloseTextDocument = vscode.workspace.onDidCloseTextDocument(
        (document) => {
            try {
                // Optionally clear diagnostics for closed documents
                // diagnosticProvider.clearDiagnostics(document.uri);
            } catch (error) {
                console.error(`Failed to handle document close ${document.uri.fsPath}:`, error);
            }
        }
    );
    
    context.subscriptions.push(
        onDidOpenTextDocument,
        onDidSaveTextDocument,
        onDidCloseTextDocument
    );
}

function setupStatusBar(context: vscode.ExtensionContext): void {
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    
    statusBarItem.command = 'autolinter.lintWorkspace';
    statusBarItem.tooltip = 'Click to lint entire workspace';
    updateStatusBar('$(check) AutoLinter: Ready');
    statusBarItem.show();
    
    context.subscriptions.push(statusBarItem);
}

async function initializeWorkspaceLinting(): Promise<void> {
    // Only start linting if workspace folders exist
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        updateStatusBar('$(sync~spin) AutoLinter: Initializing...');
        await workspaceLinter.startLinting();
        updateStatusBar('$(check) AutoLinter: Active');
    } else {
        updateStatusBar('$(info) AutoLinter: No workspace');
    }
}

function shouldLintDocument(document: vscode.TextDocument): boolean {
    // Skip untitled documents and certain schemes
    if (document.isUntitled || document.uri.scheme !== 'file') {
        return false;
    }
    
    // Check if file extension is supported
    const supportedExtensions = [
        'ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'scss', 'sass',
        'json', 'yaml', 'yml', 'md', 'vue', 'svelte', 'astro'
    ];
    
    const fileExtension = document.uri.fsPath.split('.').pop()?.toLowerCase();
    return supportedExtensions.includes(fileExtension || '');
}

function updateStatusBar(text: string): void {
    if (statusBarItem) {
        statusBarItem.text = text;
    }
}

function handleCommandError(commandName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`AutoLinter: Failed to ${commandName}:`, error);
    vscode.window.showErrorMessage(`Failed to ${commandName}: ${errorMessage}`);
}