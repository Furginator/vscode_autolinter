// src/workspaceLinter.ts - Main linting orchestrator
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagnosticProvider, LintIssue } from './diagnosticProvider';
import { TypeScriptLinter } from './linters/typescriptLinter';
import { PythonLinter } from './linters/pythonLinter';
import { ESLintLinter } from './linters/eslintLinter';
import { HTMLLinter } from './linters/htmlLinter';
import { CSSLinter } from './linters/cssLinter';

/**
 * Interface for linter implementations
 */
export interface ILinter {
    lint(uri: vscode.Uri): Promise<LintIssue[]>;
    isEnabled(): boolean;
    getSupportedExtensions(): string[];
    dispose?(): void;
}

/**
 * Linting queue item
 */
interface LintQueueItem {
    uri: vscode.Uri;
    priority: number; // Higher number = higher priority
    timestamp: number;
}

/**
 * Linting statistics
 */
interface LintingStats {
    filesProcessed: number;
    totalTime: number;
    averageTimePerFile: number;
    lastLintTime: Date;
    errorsFound: number;
    warningsFound: number;
}

/**
 * Main workspace linting orchestrator
 * Manages file discovery, linter coordination, and performance optimization
 */
export class WorkspaceLinter implements vscode.Disposable {
    private isLinting = false;
    private isInitialized = false;
    private linters: Map<string, ILinter> = new Map();
    private diagnosticProvider: DiagnosticProvider;
    private lintingQueue: LintQueueItem[] = [];
    private isProcessingQueue = false;
    private lintingStats: LintingStats;
    private periodicLintTimer?: NodeJS.Timeout;
    private gitignorePatterns: string[] = [];
    private gitignoreCacheTime = 0;
    private readonly gitignoreCacheDuration = 30000; // 30 seconds

    // Configuration cache
    private configCache: {
        enabledLanguages: string[];
        excludePatterns: string[];
        maxFiles: number;
        debounceMs: number;
        autoStart: boolean;
        lintOnSave: boolean;
        lintOnOpen: boolean;
    } | null = null;

    constructor(diagnosticProvider: DiagnosticProvider) {
        this.diagnosticProvider = diagnosticProvider;
        this.lintingStats = {
            filesProcessed: 0,
            totalTime: 0,
            averageTimePerFile: 0,
            lastLintTime: new Date(),
            errorsFound: 0,
            warningsFound: 0
        };

        this.initialize();
    }

    /**
     * Initialize the workspace linter
     */
    private async initialize(): Promise<void> {
        try {
            await this.loadConfiguration();
            await this.initializeLinters();
            await this.loadGitignorePatterns();
            this.isInitialized = true;
            
            console.log('WorkspaceLinter: Initialized successfully');
        } catch (error) {
            console.error('WorkspaceLinter: Failed to initialize:', error);
            vscode.window.showErrorMessage(`Failed to initialize WorkspaceLinter: ${error}`);
        }
    }

    /**
     * Load configuration from VS Code settings
     */
    private async loadConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('autolinter');
        
        this.configCache = {
            enabledLanguages: config.get('enabledLanguages', ['typescript', 'javascript', 'python', 'html', 'css']),
            excludePatterns: config.get('excludePatterns', [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/out/**',
                '**/.git/**',
                '**/*.min.js',
                '**/*.min.css'
            ]),
            maxFiles: config.get('maxFiles', 1000),
            debounceMs: config.get('debounceMs', 300),
            autoStart: config.get('autoStart', true),
            lintOnSave: config.get('lintOnSave', true),
            lintOnOpen: config.get('lintOnOpen', true)
        };
    }

    /**
     * Initialize all available linters
     */
    private async initializeLinters(): Promise<void> {
        const linterInstances: Array<[string, ILinter]> = [
            ['typescript', new TypeScriptLinter()],
            ['javascript', new ESLintLinter()],
            ['python', new PythonLinter()],
            ['html', new HTMLLinter()],
            ['css', new CSSLinter()]
        ];

        // Only initialize enabled linters
        for (const [name, linter] of linterInstances) {
            if (this.configCache?.enabledLanguages.includes(name)) {
                try {
                    if (linter.isEnabled()) {
                        this.linters.set(name, linter);
                        console.log(`WorkspaceLinter: Initialized ${name} linter`);
                    } else {
                        console.warn(`WorkspaceLinter: ${name} linter is disabled`);
                    }
                } catch (error) {
                    console.error(`WorkspaceLinter: Failed to initialize ${name} linter:`, error);
                }
            }
        }

        console.log(`WorkspaceLinter: Initialized ${this.linters.size} linters`);
    }

    /**
     * Start workspace-wide linting
     */
    public async startLinting(): Promise<void> {
        if (!this.isInitialized) {
            console.warn('WorkspaceLinter: Not initialized, waiting...');
            await this.initialize();
        }

        if (this.isLinting) {
            console.log('WorkspaceLinter: Already linting');
            return;
        }

        try {
            this.isLinting = true;
            console.log('WorkspaceLinter: Starting workspace-wide linting');
            
            // Initial workspace lint
            await this.lintWorkspace();
            
            // Set up periodic re-linting if configured
            this.setupPeriodicLinting();
            
            vscode.window.showInformationMessage('AutoLinter: Started workspace linting');
            
        } catch (error) {
            this.isLinting = false;
            console.error('WorkspaceLinter: Failed to start linting:', error);
            vscode.window.showErrorMessage(`Failed to start linting: ${error}`);
        }
    }

    /**
     * Stop workspace-wide linting
     */
    public async stopLinting(): Promise<void> {
        try {
            this.isLinting = false;
            
            // Clear periodic timer
            if (this.periodicLintTimer) {
                clearInterval(this.periodicLintTimer);
                this.periodicLintTimer = undefined;
            }

            // Clear the queue
            this.lintingQueue = [];
            this.isProcessingQueue = false;

            // Clear all diagnostics
            this.diagnosticProvider.clearAllDiagnostics();
            
            console.log('WorkspaceLinter: Stopped linting');
            vscode.window.showInformationMessage('AutoLinter: Stopped linting');
            
        } catch (error) {
            console.error('WorkspaceLinter: Error stopping linting:', error);
        }
    }

    /**
     * Lint entire workspace
     */
    public async lintWorkspace(): Promise<void> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            console.log('WorkspaceLinter: No workspace folders found');
            return;
        }

        try {
            const startTime = Date.now();
            console.log('WorkspaceLinter: Starting workspace lint');

            // Refresh gitignore patterns
            await this.loadGitignorePatterns();

            // Find all files to lint
            const files = await this.discoverFiles();
            
            if (files.length === 0) {
                console.log('WorkspaceLinter: No files found to lint');
                return;
            }

            // Check file limit
            if (files.length > (this.configCache?.maxFiles || 1000)) {
                const response = await vscode.window.showWarningMessage(
                    `Found ${files.length} files to lint (limit: ${this.configCache?.maxFiles}). This might take a while. Continue?`,
                    'Yes', 'Lint First 1000', 'Cancel'
                );
                
                if (response === 'Cancel') {
                    return;
                } else if (response === 'Lint First 1000') {
                    files.splice(1000);
                }
            }

            // Process files with progress indication
            await this.processFilesWithProgress(files);
            
            // Update statistics
            const endTime = Date.now();
            this.updateLintingStats(files.length, endTime - startTime);
            
            console.log(`WorkspaceLinter: Completed workspace lint in ${endTime - startTime}ms`);
            
        } catch (error) {
            console.error('WorkspaceLinter: Error during workspace lint:', error);
            vscode.window.showErrorMessage(`Workspace linting failed: ${error}`);
        }
    }

    /**
     * Lint a single file
     */
    public async lintFile(uri: vscode.Uri): Promise<void> {
        if (!this.shouldLintFile(uri)) {
            return;
        }

        // Add to queue with high priority for single file requests
        this.addToQueue(uri, 100);
    }

    /**
     * Get current linting statistics
     */
    public getStats(): LintingStats {
        return { ...this.lintingStats };
    }

    /**
     * Check if currently linting
     */
    public isCurrentlyLinting(): boolean {
        return this.isLinting;
    }

    /**
     * Discover files to lint in the workspace
     */
    private async discoverFiles(): Promise<vscode.Uri[]> {
        // Build file pattern from supported extensions
        const extensions = this.getSupportedExtensions();
        const pattern = `**/*.{${extensions.join(',')}}`;

        console.log(`WorkspaceLinter: Searching for files with pattern: ${pattern}`);

        // Find files
        const allFiles = await vscode.workspace.findFiles(pattern, undefined);
        
        // Filter files
        const filteredFiles = allFiles.filter(uri => this.shouldLintFile(uri));
        
        console.log(`WorkspaceLinter: Found ${allFiles.length} files, filtered to ${filteredFiles.length}`);
        
        return filteredFiles;
    }

    /**
     * Get all supported file extensions from enabled linters
     */
    private getSupportedExtensions(): string[] {
        const extensions = new Set<string>();
        
        for (const linter of this.linters.values()) {
            for (const ext of linter.getSupportedExtensions()) {
                extensions.add(ext);
            }
        }
        
        return Array.from(extensions);
    }

    /**
     * Process files with progress indication
     */
    private async processFilesWithProgress(files: vscode.Uri[]): Promise<void> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "AutoLinter: Processing files...",
            cancellable: true
        }, async (progress, token) => {
            const totalFiles = files.length;
            let processedFiles = 0;

            // Add all files to queue
            for (const file of files) {
                if (token.isCancellationRequested) break;
                this.addToQueue(file, 1); // Low priority for batch processing
            }

            // Process queue
            while (this.lintingQueue.length > 0 && !token.isCancellationRequested) {
                await this.processQueue();
                processedFiles = totalFiles - this.lintingQueue.length;
                
                progress.report({
                    increment: (100 / totalFiles),
                    message: `${processedFiles}/${totalFiles} files processed`
                });
            }
        });
    }

    /**
     * Add file to linting queue
     */
    private addToQueue(uri: vscode.Uri, priority: number): void {
        // Remove existing entry for this file
        this.lintingQueue = this.lintingQueue.filter(item => item.uri.fsPath !== uri.fsPath);
        
        // Add new entry
        this.lintingQueue.push({
            uri,
            priority,
            timestamp: Date.now()
        });

        // Sort by priority (highest first)
        this.lintingQueue.sort((a, b) => b.priority - a.priority);

        // Start processing if not already running
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    /**
     * Process the linting queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.lintingQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Process items in batches to avoid blocking
            const batchSize = 5;
            const batch = this.lintingQueue.splice(0, batchSize);

            for (const item of batch) {
                try {
                    await this.lintSingleFile(item.uri);
                } catch (error) {
                    console.error(`WorkspaceLinter: Error linting ${item.uri.fsPath}:`, error);
                }
            }

            // Continue processing if there are more items
            if (this.lintingQueue.length > 0) {
                // Small delay to prevent blocking
                setTimeout(() => {
                    this.isProcessingQueue = false;
                    this.processQueue();
                }, 10);
            } else {
                this.isProcessingQueue = false;
            }

        } catch (error) {
            console.error('WorkspaceLinter: Error processing queue:', error);
            this.isProcessingQueue = false;
        }
    }

    /**
     * Lint a single file immediately
     */
    private async lintSingleFile(uri: vscode.Uri): Promise<void> {
        const ext = path.extname(uri.fsPath).slice(1).toLowerCase();
        const linter = this.getLinterForExtension(ext);
        
        if (!linter) {
            console.log(`WorkspaceLinter: No linter found for extension: ${ext}`);
            return;
        }

        try {
            const startTime = Date.now();
            const issues = await linter.lint(uri);
            const endTime = Date.now();

            this.diagnosticProvider.setDiagnostics(uri, issues);
            
            console.log(`WorkspaceLinter: Linted ${uri.fsPath} in ${endTime - startTime}ms (${issues.length} issues)`);
            
        } catch (error) {
            console.error(`WorkspaceLinter: Error linting ${uri.fsPath}:`, error);
            // Clear diagnostics on error to avoid stale results
            this.diagnosticProvider.clearDiagnostics(uri);
        }
    }

    /**
     * Get appropriate linter for file extension
     */
    private getLinterForExtension(ext: string): ILinter | undefined {
        const linterMap: { [key: string]: string } = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'mjs': 'javascript',
            'py': 'python',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'css',
            'sass': 'css',
            'less': 'css'
        };

        const linterName = linterMap[ext];
        return linterName ? this.linters.get(linterName) : undefined;
    }

    /**
     * Check if file should be linted
     */
    private shouldLintFile(uri: vscode.Uri): boolean {
        const filePath = uri.fsPath;
        const relativePath = vscode.workspace.asRelativePath(uri);

        // Check gitignore patterns
        if (this.matchesGitignore(filePath, this.gitignorePatterns)) {
            return false;
        }

        // Check exclude patterns from configuration
        if (this.configCache?.excludePatterns) {
            for (const pattern of this.configCache.excludePatterns) {
                // Simple glob matching - could be enhanced with a proper glob library
                if (this.matchesPattern(relativePath, pattern)) {
                    return false;
                }
            }
        }

        // Check if extension is supported
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const supportedExtensions = this.getSupportedExtensions();
        
        return supportedExtensions.includes(ext);
    }

    /**
     * Simple pattern matching for exclude patterns
     */
    private matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }

    /**
     * Load gitignore patterns with caching
     */
    private async loadGitignorePatterns(): Promise<void> {
        const now = Date.now();
        
        // Use cache if still valid
        if (now - this.gitignoreCacheTime < this.gitignoreCacheDuration) {
            return;
        }

        this.gitignorePatterns = [];
        
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        try {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const gitignorePath = path.join(workspaceRoot, '.gitignore');
            
            if (fs.existsSync(gitignorePath)) {
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
                const lines = gitignoreContent.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    // Skip empty lines and comments
                    if (trimmed && !trimmed.startsWith('#')) {
                        this.gitignorePatterns.push(trimmed);
                    }
                }
                
                console.log(`WorkspaceLinter: Loaded ${this.gitignorePatterns.length} gitignore patterns`);
            }
            
            this.gitignoreCacheTime = now;
            
        } catch (error) {
            console.warn('WorkspaceLinter: Failed to read .gitignore:', error);
        }
    }

    /**
     * Check if file matches gitignore patterns
     */
    private matchesGitignore(filePath: string, gitignorePatterns: string[]): boolean {
        const relativePath = vscode.workspace.asRelativePath(filePath);
        
        for (const pattern of gitignorePatterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Setup periodic linting
     */
    private setupPeriodicLinting(): void {
        // Clear existing timer
        if (this.periodicLintTimer) {
            clearInterval(this.periodicLintTimer);
        }

        // Note: Removed automatic periodic linting as it can be resource intensive
        // Users can manually trigger linting as needed
        console.log('WorkspaceLinter: Periodic linting disabled for performance');
    }

    /**
     * Update linting statistics
     */
    private updateLintingStats(filesProcessed: number, totalTime: number): void {
        this.lintingStats.filesProcessed += filesProcessed;
        this.lintingStats.totalTime += totalTime;
        this.lintingStats.averageTimePerFile = this.lintingStats.totalTime / this.lintingStats.filesProcessed;
        this.lintingStats.lastLintTime = new Date();

        // Update error/warning counts from diagnostic provider
        const stats = this.diagnosticProvider.getStats();
        this.lintingStats.errorsFound = stats.errorCount;
        this.lintingStats.warningsFound = stats.warningCount;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        try {
            // Stop linting
            this.isLinting = false;
            
            // Clear timers
            if (this.periodicLintTimer) {
                clearInterval(this.periodicLintTimer);
            }

            // Clear queue
            this.lintingQueue = [];
            this.isProcessingQueue = false;

            // Dispose linters
            for (const linter of this.linters.values()) {
                if (linter.dispose) {
                    linter.dispose();
                }
            }
            this.linters.clear();

            console.log('WorkspaceLinter: Disposed successfully');
            
        } catch (error) {
            console.error('WorkspaceLinter: Error during disposal:', error);
        }
    }
}