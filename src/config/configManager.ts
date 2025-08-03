// src/config/configManager.ts - Central configuration management system
import * as vscode from 'vscode';

/**
 * Main configuration interface for AutoLinter
 */
export interface AutoLinterConfig {
    // Global settings
    enabled: boolean;
    autoStart: boolean;
    lintOnSave: boolean;
    lintOnOpen: boolean;
    showStatusBar: boolean;
    
    // Performance settings
    debounceMs: number;
    maxFiles: number;
    severity: 'error' | 'warning' | 'info';
    
    // File handling
    enabledLanguages: string[];
    excludePatterns: string[];
    
    // Language-specific settings
    typescript: TypeScriptConfig;
    javascript: JavaScriptConfig;
    python: PythonConfig;
    css: CSSConfig;
    html: HTMLConfig;
}

/**
 * TypeScript linter configuration
 */
export interface TypeScriptConfig {
    enabled: boolean;
    strictMode: boolean;
    noImplicitAny: boolean;
    noImplicitReturns: boolean;
    noUnusedLocals: boolean;
    noUnusedParameters: boolean;
    checkJs: boolean;
    excludePatterns: string[];
}

/**
 * JavaScript linter configuration
 */
export interface JavaScriptConfig {
    enabled: boolean;
    useESLint: boolean;
    eslintConfigPath?: string;
    useProjectESLintConfig: boolean;
    enableJSX: boolean;
    excludePatterns: string[];
}

/**
 * Python linter configuration
 */
export interface PythonConfig {
    enabled: boolean;
    linter: 'pylint' | 'flake8' | 'pycodestyle' | 'mypy' | 'auto';
    maxLineLength: number;
    ignoreCodes: string[];
    enableTypeChecking: boolean;
    excludePatterns: string[];
}

/**
 * CSS linter configuration
 */
export interface CSSConfig {
    enabled: boolean;
    linter: 'stylelint' | 'csslint' | 'auto';
    enableSCSS: boolean;
    enableLess: boolean;
    configPath?: string;
    excludePatterns: string[];
}

/**
 * HTML linter configuration
 */
export interface HTMLConfig {
    enabled: boolean;
    validateAttributes: boolean;
    validateStructure: boolean;
    allowCustomElements: boolean;
    excludePatterns: string[];
}

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
    affectedKeys: string[];
    previousConfig: AutoLinterConfig;
    newConfig: AutoLinterConfig;
}

/**
 * Central configuration manager for AutoLinter extension
 * Provides cached, type-safe access to all configuration settings
 */
export class ConfigManager implements vscode.Disposable {
    private static instance: ConfigManager;
    private currentConfig: AutoLinterConfig;
    private configChangeEmitter = new vscode.EventEmitter<ConfigurationChangeEvent>();
    private disposables: vscode.Disposable[] = [];
    private configurationWatcher: vscode.Disposable;

    // Event for configuration changes
    public readonly onConfigurationChanged = this.configChangeEmitter.event;

    private constructor() {
        // Load initial configuration
        this.currentConfig = this.loadConfiguration();
        
        // Watch for configuration changes
        this.configurationWatcher = vscode.workspace.onDidChangeConfiguration(
            this.handleConfigurationChange.bind(this)
        );
        
        this.disposables.push(this.configurationWatcher, this.configChangeEmitter);
        
        console.log('ConfigManager: Initialized with configuration');
    }

    /**
     * Get singleton instance of ConfigManager
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Get current configuration (cached)
     */
    public getConfiguration(): AutoLinterConfig {
        return { ...this.currentConfig }; // Return copy to prevent mutations
    }

    /**
     * Get configuration for a specific language
     */
    public getLanguageConfig<T extends keyof AutoLinterConfig>(language: T): AutoLinterConfig[T] {
        return this.currentConfig[language];
    }

    /**
     * Check if a specific language is enabled
     */
    public isLanguageEnabled(language: string): boolean {
        if (!this.currentConfig.enabled) {
            return false;
        }

        // Check if language is in enabled languages list
        if (!this.currentConfig.enabledLanguages.includes(language)) {
            return false;
        }

        // Check language-specific enabled flag
        switch (language) {
            case 'typescript':
                return this.currentConfig.typescript.enabled;
            case 'javascript':
                return this.currentConfig.javascript.enabled;
            case 'python':
                return this.currentConfig.python.enabled;
            case 'css':
                return this.currentConfig.css.enabled;
            case 'html':
                return this.currentConfig.html.enabled;
            default:
                return false;
        }
    }

    /**
     * Get global exclude patterns combined with language-specific ones
     */
    public getExcludePatterns(language?: string): string[] {
        const globalPatterns = [...this.currentConfig.excludePatterns];
        
        if (language) {
            const languageConfig = this.getLanguageConfig(language as keyof AutoLinterConfig);
            if (languageConfig && typeof languageConfig === 'object' && 'excludePatterns' in languageConfig) {
                const langPatterns = (languageConfig as any).excludePatterns || [];
                globalPatterns.push(...langPatterns);
            }
        }
        
        return [...new Set(globalPatterns)]; // Remove duplicates
    }

    /**
     * Check if extension is globally enabled
     */
    public isEnabled(): boolean {
        return this.currentConfig.enabled;
    }

    /**
     * Get maximum number of files to process
     */
    public getMaxFiles(): number {
        return this.currentConfig.maxFiles;
    }

    /**
     * Get debounce delay in milliseconds
     */
    public getDebounceMs(): number {
        return this.currentConfig.debounceMs;
    }

    /**
     * Get default severity level
     */
    public getDefaultSeverity(): 'error' | 'warning' | 'info' {
        return this.currentConfig.severity;
    }

    /**
     * Check if linting on save is enabled
     */
    public isLintOnSaveEnabled(): boolean {
        return this.currentConfig.enabled && this.currentConfig.lintOnSave;
    }

    /**
     * Check if linting on open is enabled
     */
    public isLintOnOpenEnabled(): boolean {
        return this.currentConfig.enabled && this.currentConfig.lintOnOpen;
    }

    /**
     * Check if auto-start is enabled
     */
    public isAutoStartEnabled(): boolean {
        return this.currentConfig.enabled && this.currentConfig.autoStart;
    }

    /**
     * Check if status bar should be shown
     */
    public isStatusBarEnabled(): boolean {
        return this.currentConfig.showStatusBar;
    }

    /**
     * Get enabled languages list
     */
    public getEnabledLanguages(): string[] {
        return [...this.currentConfig.enabledLanguages];
    }

    /**
     * Update a specific configuration value
     * This updates the VS Code settings, which will trigger a configuration change event
     */
    public async updateConfiguration<T extends keyof AutoLinterConfig>(
        key: T, 
        value: AutoLinterConfig[T], 
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('autolinter');
            await config.update(key as string, value, target);
            console.log(`ConfigManager: Updated ${key as string} to`, value);
        } catch (error) {
            console.error(`ConfigManager: Failed to update ${key as string}:`, error);
            throw new Error(`Failed to update configuration: ${error}`);
        }
    }

    /**
     * Reset configuration to defaults
     */
    public async resetConfiguration(
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('autolinter');
            const inspect = config.inspect('');
            
            if (inspect) {
                // Reset all known configuration keys
                const keysToReset = [
                    'enabled', 'autoStart', 'lintOnSave', 'lintOnOpen', 'showStatusBar',
                    'debounceMs', 'maxFiles', 'severity', 'enabledLanguages', 'excludePatterns',
                    'typescript', 'javascript', 'python', 'css', 'html'
                ];
                
                for (const key of keysToReset) {
                    await config.update(key, undefined, target);
                }
            }
            
            console.log('ConfigManager: Configuration reset to defaults');
        } catch (error) {
            console.error('ConfigManager: Failed to reset configuration:', error);
            throw new Error(`Failed to reset configuration: ${error}`);
        }
    }

    /**
     * Validate configuration and return any issues
     */
    public validateConfiguration(): string[] {
        const issues: string[] = [];
        const config = this.currentConfig;

        // Validate numeric values
        if (config.debounceMs < 100 || config.debounceMs > 5000) {
            issues.push('debounceMs must be between 100 and 5000 milliseconds');
        }

        if (config.maxFiles < 10 || config.maxFiles > 10000) {
            issues.push('maxFiles must be between 10 and 10000');
        }

        // Validate severity
        if (!['error', 'warning', 'info'].includes(config.severity)) {
            issues.push('severity must be one of: error, warning, info');
        }

        // Validate enabled languages
        const validLanguages = ['typescript', 'javascript', 'python', 'css', 'html'];
        const invalidLanguages = config.enabledLanguages.filter(lang => !validLanguages.includes(lang));
        if (invalidLanguages.length > 0) {
            issues.push(`Invalid languages in enabledLanguages: ${invalidLanguages.join(', ')}`);
        }

        // Validate Python configuration
        const validPythonLinters = ['pylint', 'flake8', 'pycodestyle', 'mypy', 'auto'];
        if (!validPythonLinters.includes(config.python.linter)) {
            issues.push(`Invalid Python linter: ${config.python.linter}`);
        }

        // Validate CSS configuration
        const validCSSLinters = ['stylelint', 'csslint', 'auto'];
        if (!validCSSLinters.includes(config.css.linter)) {
            issues.push(`Invalid CSS linter: ${config.css.linter}`);
        }

        return issues;
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadConfiguration(): AutoLinterConfig {
        const config = vscode.workspace.getConfiguration('autolinter');

        // Load with defaults
        return {
            // Global settings
            enabled: config.get('enabled', true),
            autoStart: config.get('autoStart', true),
            lintOnSave: config.get('lintOnSave', true),
            lintOnOpen: config.get('lintOnOpen', true),
            showStatusBar: config.get('showStatusBar', true),

            // Performance settings
            debounceMs: config.get('debounceMs', 300),
            maxFiles: config.get('maxFiles', 1000),
            severity: config.get('severity', 'warning') as 'error' | 'warning' | 'info',

            // File handling
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

            // Language configurations
            typescript: {
                enabled: config.get('typescript.enabled', true),
                strictMode: config.get('typescript.strictMode', false),
                noImplicitAny: config.get('typescript.noImplicitAny', true),
                noImplicitReturns: config.get('typescript.noImplicitReturns', true),
                noUnusedLocals: config.get('typescript.noUnusedLocals', false),
                noUnusedParameters: config.get('typescript.noUnusedParameters', false),
                checkJs: config.get('typescript.checkJs', false),
                excludePatterns: config.get('typescript.excludePatterns', [])
            },

            javascript: {
                enabled: config.get('javascript.enabled', true),
                useESLint: config.get('javascript.useESLint', true),
                eslintConfigPath: config.get('javascript.eslintConfigPath'),
                useProjectESLintConfig: config.get('javascript.useProjectESLintConfig', true),
                enableJSX: config.get('javascript.enableJSX', true),
                excludePatterns: config.get('javascript.excludePatterns', [])
            },

            python: {
                enabled: config.get('python.enabled', true),
                linter: config.get('python.linter', 'auto') as 'pylint' | 'flake8' | 'pycodestyle' | 'mypy' | 'auto',
                maxLineLength: config.get('python.maxLineLength', 88),
                ignoreCodes: config.get('python.ignoreCodes', []),
                enableTypeChecking: config.get('python.enableTypeChecking', false),
                excludePatterns: config.get('python.excludePatterns', [])
            },

            css: {
                enabled: config.get('css.enabled', true),
                linter: config.get('css.linter', 'auto') as 'stylelint' | 'csslint' | 'auto',
                enableSCSS: config.get('css.enableSCSS', true),
                enableLess: config.get('css.enableLess', true),
                configPath: config.get('css.configPath'),
                excludePatterns: config.get('css.excludePatterns', [])
            },

            html: {
                enabled: config.get('html.enabled', true),
                validateAttributes: config.get('html.validateAttributes', true),
                validateStructure: config.get('html.validateStructure', true),
                allowCustomElements: config.get('html.allowCustomElements', false),
                excludePatterns: config.get('html.excludePatterns', [])
            }
        };
    }

    /**
     * Handle VS Code configuration changes
     */
    private handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
        if (!event.affectsConfiguration('autolinter')) {
            return;
        }

        const previousConfig = { ...this.currentConfig };
        const newConfig = this.loadConfiguration();
        
        // Find which keys changed
        const affectedKeys = this.getChangedKeys(previousConfig, newConfig);
        
        if (affectedKeys.length === 0) {
            return; // No relevant changes
        }

        // Update cached configuration
        this.currentConfig = newConfig;

        // Validate new configuration
        const validationIssues = this.validateConfiguration();
        if (validationIssues.length > 0) {
            console.warn('ConfigManager: Configuration validation issues:', validationIssues);
            vscode.window.showWarningMessage(
                `AutoLinter configuration issues: ${validationIssues.join(', ')}`
            );
        }

        // Emit configuration change event
        this.configChangeEmitter.fire({
            affectedKeys,
            previousConfig,
            newConfig: { ...newConfig }
        });

        console.log(`ConfigManager: Configuration changed, affected keys: ${affectedKeys.join(', ')}`);
    }

    /**
     * Compare configurations and return changed keys
     */
    private getChangedKeys(prev: AutoLinterConfig, current: AutoLinterConfig): string[] {
        const changedKeys: string[] = [];

        // Simple comparison for top-level keys
        const topLevelKeys: (keyof AutoLinterConfig)[] = [
            'enabled', 'autoStart', 'lintOnSave', 'lintOnOpen', 'showStatusBar',
            'debounceMs', 'maxFiles', 'severity'
        ];

        for (const key of topLevelKeys) {
            if (prev[key] !== current[key]) {
                changedKeys.push(key as string);
            }
        }

        // Array comparison for enabledLanguages and excludePatterns
        if (JSON.stringify(prev.enabledLanguages) !== JSON.stringify(current.enabledLanguages)) {
            changedKeys.push('enabledLanguages');
        }

        if (JSON.stringify(prev.excludePatterns) !== JSON.stringify(current.excludePatterns)) {
            changedKeys.push('excludePatterns');
        }

        // Object comparison for language configurations
        const languageKeys: (keyof AutoLinterConfig)[] = ['typescript', 'javascript', 'python', 'css', 'html'];
        for (const key of languageKeys) {
            if (JSON.stringify(prev[key]) !== JSON.stringify(current[key])) {
                changedKeys.push(key as string);
            }
        }

        return changedKeys;
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        try {
            // Dispose all disposables
            for (const disposable of this.disposables) {
                disposable.dispose();
            }
            this.disposables = [];

            console.log('ConfigManager: Disposed successfully');
        } catch (error) {
            console.error('ConfigManager: Error during disposal:', error);
        }
    }

    /**
     * Static method to reset singleton (mainly for testing)
     */
    public static reset(): void {
        if (ConfigManager.instance) {
            ConfigManager.instance.dispose();
            ConfigManager.instance = undefined as any;
        }
    }
}