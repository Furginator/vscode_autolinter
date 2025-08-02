// src/linters/cssLinter.ts
import * as vscode from 'vscode';
import * as fs from 'fs';

export class CSSLinter {
    public async lint(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            return this.validateCSS(content);
        } catch (error) {
            console.warn('CSS linting failed:', error);
            return diagnostics;
        }
    }

    private validateCSS(content: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            this.checkBrackets(line, i, diagnostics);
            this.checkSemicolons(line, i, diagnostics);
            this.checkColors(line, i, diagnostics);
            this.checkVendorPrefixes(line, i, diagnostics);
        }

        return diagnostics;
    }

    private checkBrackets(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        const openBrackets = (line.match(/\{/g) || []).length;
        const closeBrackets = (line.match(/\}/g) || []).length;
        
        if (openBrackets !== closeBrackets && line.trim()) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Mismatched brackets',
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private checkSemicolons(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        // Check for missing semicolons in property declarations
        const propertyRegex = /^\s*[a-zA-Z-]+\s*:\s*[^;]+[^;}]\s*$/;
        if (propertyRegex.test(line) && !line.includes('}')) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Missing semicolon',
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    private checkColors(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        // Check for invalid hex colors
        const hexColorRegex = /#[0-9a-fA-F]{0,6}/g;
        const matches = line.match(hexColorRegex);
        
        if (matches) {
            for (const match of matches) {
                if (match.length !== 4 && match.length !== 7) { // #RGB or #RRGGBB
                    const startIndex = line.indexOf(match);
                    const range = new vscode.Range(
                        lineNumber, startIndex,
                        lineNumber, startIndex + match.length
                    );
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Invalid hex color format',
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }
        }
    }

    private checkVendorPrefixes(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        // Check for outdated vendor prefixes
        const outdatedPrefixes = ['-moz-border-radius', '-webkit-border-radius', '-ms-filter'];
        
        for (const prefix of outdatedPrefixes) {
            if (line.includes(prefix)) {
                const startIndex = line.indexOf(prefix);
                const range = new vscode.Range(
                    lineNumber, startIndex,
                    lineNumber, startIndex + prefix.length
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Outdated vendor prefix: ${prefix}`,
                    vscode.DiagnosticSeverity.Information
                ));
            }
        }
    }
}