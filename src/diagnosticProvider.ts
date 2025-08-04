// src/diagnosticProvider.ts - Central diagnostic coordination and VS Code integration
import * as vscode from 'vscode';

/**
 * Represents a linting issue from any linter
 */
export interface LintIssue {
    message: string;
    severity: 'error' | 'warning' | 'info';
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    source: string;  // e.g., 'typescript', 'eslint', 'python'
    code?: string | number;
    ruleId?: string;
}

/**
 * Statistics about diagnostics
 */
export interface DiagnosticStats {
    totalFiles: number;
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    fileStats: Map<string, { errors: number; warnings: number; info: number }>;
}

/**
 * Central diagnostic provider for the AutoLinter extension
 * Manages all VS Code diagnostic collections and provides unified interface
 */
export class DiagnosticProvider implements vscode.Disposable {
    private readonly diagnosticCollection: vscode.DiagnosticCollection;
    private readonly diagnosticStats: DiagnosticStats;
    private readonly fileWatchers: Map<string, vscode.FileSystemWatcher>;
    
    constructor() {
        // Create a single diagnostic collection for all linters
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('autolinter');
        
        // Initialize statistics tracking
        this.diagnosticStats = {
            totalFiles: 0,
            totalIssues: 0,
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            fileStats: new Map()
        };
        
        this.fileWatchers = new Map();
        
        // Listen to file deletions to clean up diagnostics
        this.setupFileWatchers();
    }

    /**
     * Set diagnostics for a specific file
     * @param uri File URI
     * @param issues Array of lint issues
     */
    public setDiagnostics(uri: vscode.Uri, issues: LintIssue[]): void {
        try {
            const diagnostics = this.convertIssuesToDiagnostics(issues);
            this.diagnosticCollection.set(uri, diagnostics);
            
            // Update statistics
            this.updateFileStats(uri.fsPath, issues);
            
            console.log(`AutoLinter: Set ${diagnostics.length} diagnostics for ${uri.fsPath}`);
            
        } catch (error) {
            console.error(`Failed to set diagnostics for ${uri.fsPath}:`, error);
            vscode.window.showErrorMessage(`Failed to update diagnostics for ${uri.fsPath}`);
        }
    }

    /**
     * Add diagnostics to existing ones for a file (useful for multiple linters)
     * @param uri File URI
     * @param issues Array of lint issues to add
     */
    public addDiagnostics(uri: vscode.Uri, issues: LintIssue[]): void {
        try {
            const existingDiagnostics = this.diagnosticCollection.get(uri) || [];
            const newDiagnostics = this.convertIssuesToDiagnostics(issues);
            const combinedDiagnostics = [...existingDiagnostics, ...newDiagnostics];
            
            this.diagnosticCollection.set(uri, combinedDiagnostics);
            
            // Update statistics (recalculate from combined issues)
            const allIssues = this.convertDiagnosticsToIssues(combinedDiagnostics);
            this.updateFileStats(uri.fsPath, allIssues);
            
            console.log(`AutoLinter: Added ${newDiagnostics.length} diagnostics to ${uri.fsPath}`);
            
        } catch (error) {
            console.error(`Failed to add diagnostics for ${uri.fsPath}:`, error);
        }
    }

    /**
     * Clear diagnostics for a specific file
     * @param uri File URI
     */
    public clearDiagnostics(uri: vscode.Uri): void {
        try {
            this.diagnosticCollection.delete(uri);
            this.removeFileStats(uri.fsPath);
            
            console.log(`AutoLinter: Cleared diagnostics for ${uri.fsPath}`);
            
        } catch (error) {
            console.error(`Failed to clear diagnostics for ${uri.fsPath}:`, error);
        }
    }

    /**
     * Clear all diagnostics
     */
    public clearAllDiagnostics(): void {
        try {
            this.diagnosticCollection.clear();
            this.resetStats();
            
            console.log('AutoLinter: Cleared all diagnostics');
            
        } catch (error) {
            console.error('Failed to clear all diagnostics:', error);
        }
    }

    /**
     * Get diagnostics for a specific file
     * @param uri File URI
     * @returns Array of diagnostics or undefined if none
     */
    public getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] | undefined {
        return this.diagnosticCollection.get(uri);
    }

    /**
     * Get all diagnostics as a map of URI to diagnostics
     */
    public getAllDiagnostics(): [vscode.Uri, vscode.Diagnostic[]][] {
        const result: [vscode.Uri, vscode.Diagnostic[]][] = [];
        this.diagnosticCollection.forEach((uri, diagnostics) => {
            result.push([uri, [...diagnostics]]);
        });
        return result;
    }

    /**
     * Get current diagnostic statistics
     */
    public getStats(): DiagnosticStats {
        return { ...this.diagnosticStats };
    }

    /**
     * Get diagnostic count for a specific file
     * @param filePath File path
     */
    public getFileStats(filePath: string): { errors: number; warnings: number; info: number } | undefined {
        return this.diagnosticStats.fileStats.get(filePath);
    }

    /**
     * Check if a file has any diagnostics
     * @param uri File URI
     */
    public hasDiagnostics(uri: vscode.Uri): boolean {
        const diagnostics = this.diagnosticCollection.get(uri);
        return diagnostics !== undefined && diagnostics.length > 0;
    }

    /**
     * Filter diagnostics by severity
     * @param uri File URI
     * @param severity Diagnostic severity to filter by
     */
    public getDiagnosticsBySeverity(uri: vscode.Uri, severity: vscode.DiagnosticSeverity): vscode.Diagnostic[] {
        const diagnostics = this.diagnosticCollection.get(uri);
        if (!diagnostics) {
            return [];
        }
        return diagnostics.filter(diagnostic => diagnostic.severity === severity);
    }

    /**
     * Convert LintIssue array to VS Code Diagnostic array
     */
    private convertIssuesToDiagnostics(issues: LintIssue[]): vscode.Diagnostic[] {
        return issues.map(issue => this.convertIssueToDiagnostic(issue));
    }

    /**
     * Convert a single LintIssue to VS Code Diagnostic
     */
    private convertIssueToDiagnostic(issue: LintIssue): vscode.Diagnostic {
        // Create range for the diagnostic
        const startLine = Math.max(0, issue.line - 1); // VS Code uses 0-based lines
        const startColumn = Math.max(0, issue.column - 1); // VS Code uses 0-based columns
        const endLine = issue.endLine ? Math.max(0, issue.endLine - 1) : startLine;
        const endColumn = issue.endColumn ? Math.max(0, issue.endColumn - 1) : startColumn + 1;

        const range = new vscode.Range(
            new vscode.Position(startLine, startColumn),
            new vscode.Position(endLine, endColumn)
        );

        // Create the diagnostic
        const diagnostic = new vscode.Diagnostic(
            range,
            issue.message,
            this.mapSeverity(issue.severity)
        );

        // Set additional properties
        diagnostic.source = `AutoLinter (${issue.source})`;
        
        if (issue.code !== undefined) {
            diagnostic.code = issue.code;
        }

        if (issue.ruleId) {
            diagnostic.code = {
                value: issue.ruleId,
                target: vscode.Uri.parse(`https://example.com/rules/${issue.ruleId}`) // Can be customized per linter
            };
        }

        return diagnostic;
    }

    /**
     * Convert VS Code Diagnostics back to LintIssues (for statistics)
     */
    private convertDiagnosticsToIssues(diagnostics: readonly vscode.Diagnostic[]): LintIssue[] {
        return diagnostics.map(diagnostic => ({
            message: diagnostic.message,
            severity: this.mapDiagnosticSeverityToString(diagnostic.severity || vscode.DiagnosticSeverity.Warning),
            line: diagnostic.range.start.line + 1, // Convert back to 1-based
            column: diagnostic.range.start.character + 1,
            endLine: diagnostic.range.end.line + 1,
            endColumn: diagnostic.range.end.character + 1,
            source: diagnostic.source?.replace('AutoLinter (', '').replace(')', '') || 'unknown',
            code: typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code
        }));
    }

    /**
     * Map LintIssue severity to VS Code DiagnosticSeverity
     */
    private mapSeverity(severity: 'error' | 'warning' | 'info'): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Warning;
        }
    }

    /**
     * Map VS Code DiagnosticSeverity back to string
     */
    private mapDiagnosticSeverityToString(severity: vscode.DiagnosticSeverity): 'error' | 'warning' | 'info' {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error:
                return 'error';
            case vscode.DiagnosticSeverity.Warning:
                return 'warning';
            case vscode.DiagnosticSeverity.Information:
            case vscode.DiagnosticSeverity.Hint:
                return 'info';
            default:
                return 'warning';
        }
    }

    /**
     * Update statistics for a specific file
     */
    private updateFileStats(filePath: string, issues: LintIssue[]): void {
        // Remove old stats for this file
        this.removeFileStats(filePath);

        // Calculate new stats
        const fileStats = {
            errors: issues.filter(issue => issue.severity === 'error').length,
            warnings: issues.filter(issue => issue.severity === 'warning').length,
            info: issues.filter(issue => issue.severity === 'info').length
        };

        // Update file stats
        this.diagnosticStats.fileStats.set(filePath, fileStats);

        // Recalculate total stats
        this.recalculateTotalStats();
    }

    /**
     * Remove statistics for a specific file
     */
    private removeFileStats(filePath: string): void {
        this.diagnosticStats.fileStats.delete(filePath);
        this.recalculateTotalStats();
    }

    /**
     * Recalculate total statistics from all file stats
     */
    private recalculateTotalStats(): void {
        this.diagnosticStats.totalFiles = this.diagnosticStats.fileStats.size;
        this.diagnosticStats.errorCount = 0;
        this.diagnosticStats.warningCount = 0;
        this.diagnosticStats.infoCount = 0;

        for (const fileStats of this.diagnosticStats.fileStats.values()) {
            this.diagnosticStats.errorCount += fileStats.errors;
            this.diagnosticStats.warningCount += fileStats.warnings;
            this.diagnosticStats.infoCount += fileStats.info;
        }

        this.diagnosticStats.totalIssues = 
            this.diagnosticStats.errorCount + 
            this.diagnosticStats.warningCount + 
            this.diagnosticStats.infoCount;
    }

    /**
     * Reset all statistics
     */
    private resetStats(): void {
        this.diagnosticStats.totalFiles = 0;
        this.diagnosticStats.totalIssues = 0;
        this.diagnosticStats.errorCount = 0;
        this.diagnosticStats.warningCount = 0;
        this.diagnosticStats.infoCount = 0;
        this.diagnosticStats.fileStats.clear();
    }

    /**
     * Setup file system watchers to clean up diagnostics for deleted files
     */
    private setupFileWatchers(): void {
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                const pattern = new vscode.RelativePattern(folder, '**/*');
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                
                watcher.onDidDelete(uri => {
                    this.clearDiagnostics(uri);
                });

                this.fileWatchers.set(folder.uri.fsPath, watcher);
            }
        }
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        try {
            // Dispose diagnostic collection
            this.diagnosticCollection.dispose();

            // Dispose file watchers
            for (const watcher of this.fileWatchers.values()) {
                watcher.dispose();
            }
            this.fileWatchers.clear();

            // Reset stats
            this.resetStats();

            console.log('AutoLinter: DiagnosticProvider disposed successfully');

        } catch (error) {
            console.error('Error disposing DiagnosticProvider:', error);
        }
    }
}