// src/linters/htmlLinter.ts
import * as vscode from 'vscode';
import * as fs from 'fs';

export class HTMLLinter {
    public async lint(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            return this.validateHTML(content);
        } catch (error) {
            console.warn('HTML linting failed:', error);
            return diagnostics;
        }
    }

    private validateHTML(content: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for common HTML issues
            this.checkUnclosedTags(line, i, diagnostics);
            this.checkMissingAltAttributes(line, i, diagnostics);
            this.checkDeprecatedTags(line, i, diagnostics);
            this.checkMissingDoctype(content, i, diagnostics);
        }

        return diagnostics;
    }

    private checkUnclosedTags(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        // Simple check for unclosed tags (this is basic - a real parser would be better)
        const openTags = line.match(/<[^\/][^>]*[^\/]>/g) || [];
        const closeTags = line.match(/<\/[^>]+>/g) || [];
        const selfClosingTags = line.match(/<[^>]*\/>/g) || [];

        // This is a simplified check - real HTML validation would need a proper parser
        if (openTags.length > closeTags.length + selfClosingTags.length) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Possible unclosed HTML tag',
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    private checkMissingAltAttributes(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        const imgTags = line.match(/<img[^>]*>/gi);
        if (imgTags) {
            for (const imgTag of imgTags) {
                if (!imgTag.includes('alt=')) {
                    const startIndex = line.indexOf(imgTag);
                    const range = new vscode.Range(
                        lineNumber, startIndex,
                        lineNumber, startIndex + imgTag.length
                    );
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Image missing alt attribute for accessibility',
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    private checkDeprecatedTags(line: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        const deprecatedTags = ['font', 'center', 'big', 'small', 'tt'];
        
        for (const tag of deprecatedTags) {
            const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
            const matches = line.match(regex);
            
            if (matches) {
                for (const match of matches) {
                    const startIndex = line.indexOf(match);
                    const range = new vscode.Range(
                        lineNumber, startIndex,
                        lineNumber, startIndex + match.length
                    );
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Deprecated HTML tag: ${tag}`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    private checkMissingDoctype(content: string, lineNumber: number, diagnostics: vscode.Diagnostic[]) {
        if (lineNumber === 0 && !content.toLowerCase().includes('<!doctype')) {
            const range = new vscode.Range(0, 0, 0, 0);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Missing DOCTYPE declaration',
                vscode.DiagnosticSeverity.Information
            ));
        }
    }
}