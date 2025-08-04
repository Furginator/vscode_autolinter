// src/linters/cssLinter.ts - CSS specific linter
import * as vscode from 'vscode';
import * as fs from 'fs';
import { ILinter } from '../workspaceLinter';
import { LintIssue as DiagnosticLintIssue } from '../diagnosticProvider';

export class CSSLinter implements ILinter {
    public isEnabled(): boolean {
        return vscode.workspace.getConfiguration('autolinter').get('css.enabled', true);
    }

    public getSupportedExtensions(): string[] {
        return ['css', 'scss', 'sass', 'less'];
    }

    public async lint(uri: vscode.Uri): Promise<DiagnosticLintIssue[]> {
        const issues: DiagnosticLintIssue[] = [];

        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            return this.validateCSS(content);
        } catch (error) {
            console.warn('CSS linting failed:', error);
            return issues;
        }
    }

    private validateCSS(content: string): DiagnosticLintIssue[] {
        const issues: DiagnosticLintIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            this.checkBrackets(line, i, issues);
            this.checkSemicolons(line, i, issues);
            this.checkColors(line, i, issues);
            this.checkVendorPrefixes(line, i, issues);
        }

        return issues;
    }

    private checkBrackets(line: string, lineNumber: number, issues: DiagnosticLintIssue[]) {
        const openBrackets = (line.match(/\{/g) || []).length;
        const closeBrackets = (line.match(/\}/g) || []).length;

        if (openBrackets !== closeBrackets && line.trim()) {
            issues.push({
                message: 'Mismatched brackets',
                severity: 'error',
                line: lineNumber + 1,
                column: 1,
                endLine: lineNumber + 1,
                endColumn: line.length + 1,
                source: 'css'
            });
        }
    }

    private checkSemicolons(line: string, lineNumber: number, issues: DiagnosticLintIssue[]) {
        const propertyRegex = /^\s*[a-zA-Z-]+\s*:\s*[^;]+[^;}]\s*$/;
        if (propertyRegex.test(line) && !line.includes('}')) {
            issues.push({
                message: 'Missing semicolon',
                severity: 'warning',
                line: lineNumber + 1,
                column: 1,
                endLine: lineNumber + 1,
                endColumn: line.length + 1,
                source: 'css'
            });
        }
    }

    private checkColors(line: string, lineNumber: number, issues: DiagnosticLintIssue[]) {
        const hexColorRegex = /#[0-9a-fA-F]{0,6}/g;
        const matches = line.match(hexColorRegex);

        if (matches) {
            for (const match of matches) {
                if (match.length !== 4 && match.length !== 7) { // #RGB or #RRGGBB
                    const startIndex = line.indexOf(match);
                    issues.push({
                        message: 'Invalid hex color format',
                        severity: 'error',
                        line: lineNumber + 1,
                        column: startIndex + 1,
                        endLine: lineNumber + 1,
                        endColumn: startIndex + match.length + 1,
                        source: 'css'
                    });
                }
            }
        }
    }

    private checkVendorPrefixes(line: string, lineNumber: number, issues: DiagnosticLintIssue[]) {
        const outdatedPrefixes = ['-moz-border-radius', '-webkit-border-radius', '-ms-filter'];

        for (const prefix of outdatedPrefixes) {
            if (line.includes(prefix)) {
                const startIndex = line.indexOf(prefix);
                issues.push({
                    message: `Outdated vendor prefix: ${prefix}`,
                    severity: 'info',
                    line: lineNumber + 1,
                    column: startIndex + 1,
                    endLine: lineNumber + 1,
                    endColumn: startIndex + prefix.length + 1,
                    source: 'css'
                });
            }
        }
    }
}