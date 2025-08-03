// src/linters/javascriptLinter.ts - JavaScript linting using ESLint
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LintIssue } from '../diagnosticProvider';
import { ILinter } from '../workspaceLinter';
import { ConfigManager } from '../config/configManager';

/**
 * ESLint result interface (simplified)
 */
interface ESLintResult {
    filePath: string;
    messages: ESLintMessage[];
    errorCount: number;
    warningCount: number;
    fixableErrorCount: number;
    fixableWarningCount: number;
}

/**
 * ESLint message interface
 */
interface ESLintMessage {
    ruleId: string | null;
    severity: 1 | 2; // 1 = warning, 2 = error
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    nodeType?: string;
    source?: string;
}

/**
 * JavaScript linter implementation using ESLint
 * Provides comprehensive JavaScript/JSX linting with configurable rules
 */
export class JavaScriptLinter implements ILinter {
    private configManager: ConfigManager;
    private eslintModule: any = null;
    private isESLintAvailable = false;

    constructor() {
        this.configManager = ConfigManager.getInstance();
        this.initializeESLint();
    }

    /**
     * Initialize ESLint module
     */
    private async initializeESLint(): Promise<void> {
        try {
            // Try to load ESLint from workspace node_modules first
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                const eslintPath = path.join(workspaceRoot, 'node_modules', 'eslint');
                
                if (fs.existsSync(eslintPath)) {
                    this.eslintModule = require(eslintPath);
                    this.isESLintAvailable = true;
                    console.log('JavaScriptLinter: Loaded ESLint from workspace');
                    return;
                }
            }

            // Fallback to global ESLint
            this.eslintModule = require('eslint');
            this.isESLintAvailable = true;
            console.log('JavaScriptLinter: Loaded global ESLint');

        } catch (error) {
            console.warn('JavaScriptLinter: ESLint not available:', error);
            this.isESLintAvailable = false;
        }
    }

    /**
     * Check if the linter is enabled and available
     */
    public isEnabled(): boolean {
        const config = this.configManager.getConfiguration();
        return config.javascript.enabled && 
               config.javascript.useESLint && 
               this.isESLintAvailable;
    }

    /**
     * Get supported file extensions
     */
    public getSupportedExtensions(): string[] {
        const config = this.configManager.getConfiguration();
        const extensions = ['js', 'mjs'];
        
        if (config.javascript.enableJSX) {
            extensions.push('jsx');
        }
        
        return extensions;
    }

    /**
     * Lint a JavaScript file
     */
    public async lint(uri: vscode.Uri): Promise<LintIssue[]> {
        if (!this.isEnabled()) {
            return [];
        }

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            
            if (!text.trim()) {
                return []; // Skip empty files
            }

            // Get ESLint configuration
            const eslintConfig = await this.getESLintConfig(uri);
            
            // Create ESLint instance
            const ESLint = this.eslintModule.ESLint;
            const eslint = new ESLint({
                baseConfig: eslintConfig,
                useEslintrc: this.configManager.getConfiguration().javascript.useProjectESLintConfig,
                cwd: this.getWorkspaceRoot()
            });

            // Check if file should be ignored
            const isPathIgnored = await eslint.isPathIgnored(uri.fsPath);
            if (isPathIgnored) {
                return [];
            }

            // Lint the file
            const results: ESLintResult[] = await eslint.lintText(text, {
                filePath: uri.fsPath
            });

            // Convert ESLint results to LintIssues
            return this.convertESLintResults(results);

        } catch (error) {
            console.error(`JavaScriptLinter: Error linting ${uri.fsPath}:`, error);
            
            // Return a diagnostic error instead of failing silently
            return [{
                message: `ESLint error: ${error instanceof Error ? error.message : String(error)}`,
                severity: 'error',
                line: 1,
                column: 1,
                source: 'javascript',
                code: 'eslint-error'
            }];
        }
    }

    /**
     * Get ESLint configuration for the current workspace
     */
    private async getESLintConfig(uri: vscode.Uri): Promise<any> {
        const config = this.configManager.getConfiguration().javascript;
        
        // If custom config path is specified, try to load it
        if (config.eslintConfigPath) {
            try {
                const configPath = this.resolveConfigPath(config.eslintConfigPath);
                if (fs.existsSync(configPath)) {
                    return require(configPath);
                }
            } catch (error) {
                console.warn('JavaScriptLinter: Failed to load custom ESLint config:', error);
            }
        }

        // Return default configuration
        return this.getDefaultESLintConfig();
    }

    /**
     * Get default ESLint configuration
     */
    private getDefaultESLintConfig(): any {
        const config = this.configManager.getConfiguration().javascript;
        
        return {
            env: {
                browser: true,
                es2021: true,
                node: true
            },
            extends: [
                'eslint:recommended'
            ],
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: config.enableJSX
                }
            },
            rules: {
                // Basic rules - can be expanded based on preferences
                'no-unused-vars': 'warn',
                'no-undef': 'error',
                'no-console': 'warn',
                'no-debugger': 'warn',
                'prefer-const': 'warn',
                'no-var': 'warn',
                'eqeqeq': 'warn',
                'curly': 'warn'
            }
        };
    }

    /**
     * Resolve configuration file path
     */
    private resolveConfigPath(configPath: string): string {
        if (path.isAbsolute(configPath)) {
            return configPath;
        }

        const workspaceRoot = this.getWorkspaceRoot();
        return path.resolve(workspaceRoot, configPath);
    }

    /**
     * Get workspace root directory
     */
    private getWorkspaceRoot(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return process.cwd();
    }

    /**
     * Convert ESLint results to LintIssues
     */
    private convertESLintResults(results: ESLintResult[]): LintIssue[] {
        const issues: LintIssue[] = [];

        for (const result of results) {
            for (const message of result.messages) {
                issues.push({
                    message: message.message,
                    severity: this.mapESLintSeverity(message.severity),
                    line: message.line,
                    column: message.column,
                    endLine: message.endLine,
                    endColumn: message.endColumn,
                    source: 'javascript',
                    code: message.ruleId || 'unknown',
                    ruleId: message.ruleId || undefined
                });
            }
        }

        return issues;
    }

    /**
     * Map ESLint severity to our severity format
     */
    private mapESLintSeverity(severity: 1 | 2): 'error' | 'warning' | 'info' {
        switch (severity) {
            case 2:
                return 'error';
            case 1:
                return 'warning';
            default:
                return 'warning';
        }
    }

    /**
     * Check if ESLint is available in the workspace
     */
    public async checkESLintAvailability(): Promise<{
        available: boolean;
        version?: string;
        configPath?: string;
        issues: string[];
    }> {
        const issues: string[] = [];
        
        if (!this.isESLintAvailable) {
            issues.push('ESLint is not installed. Run: npm install eslint --save-dev');
            return { available: false, issues };
        }

        try {
            // Get ESLint version
            const ESLint = this.eslintModule.ESLint;
            const version = this.eslintModule.version || 'unknown';

            // Check for configuration
            const workspaceRoot = this.getWorkspaceRoot();
            const configFiles = [
                '.eslintrc.js',
                '.eslintrc.json',
                '.eslintrc.yml',
                '.eslintrc.yaml',
                'eslint.config.js'
            ];

            let configPath: string | undefined;
            for (const configFile of configFiles) {
                const fullPath = path.join(workspaceRoot, configFile);
                if (fs.existsSync(fullPath)) {
                    configPath = fullPath;
                    break;
                }
            }

            if (!configPath) {
                issues.push('No ESLint configuration file found. Consider creating .eslintrc.js');
            }

            return {
                available: true,
                version,
                configPath,
                issues
            };

        } catch (error) {
            issues.push(`Error checking ESLint: ${error}`);
            return { available: false, issues };
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        // Nothing to dispose for now
        console.log('JavaScriptLinter: Disposed');
    }
}