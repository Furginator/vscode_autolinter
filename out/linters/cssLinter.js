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
exports.CSSLinter = void 0;
// src/linters/cssLinter.ts
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class CSSLinter {
    async lint(uri) {
        const diagnostics = [];
        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            return this.validateCSS(content);
        }
        catch (error) {
            console.warn('CSS linting failed:', error);
            return diagnostics;
        }
    }
    validateCSS(content) {
        const diagnostics = [];
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
    checkBrackets(line, lineNumber, diagnostics) {
        const openBrackets = (line.match(/\{/g) || []).length;
        const closeBrackets = (line.match(/\}/g) || []).length;
        if (openBrackets !== closeBrackets && line.trim()) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            diagnostics.push(new vscode.Diagnostic(range, 'Mismatched brackets', vscode.DiagnosticSeverity.Error));
        }
    }
    checkSemicolons(line, lineNumber, diagnostics) {
        // Check for missing semicolons in property declarations
        const propertyRegex = /^\s*[a-zA-Z-]+\s*:\s*[^;]+[^;}]\s*$/;
        if (propertyRegex.test(line) && !line.includes('}')) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            diagnostics.push(new vscode.Diagnostic(range, 'Missing semicolon', vscode.DiagnosticSeverity.Warning));
        }
    }
    checkColors(line, lineNumber, diagnostics) {
        // Check for invalid hex colors
        const hexColorRegex = /#[0-9a-fA-F]{0,6}/g;
        const matches = line.match(hexColorRegex);
        if (matches) {
            for (const match of matches) {
                if (match.length !== 4 && match.length !== 7) { // #RGB or #RRGGBB
                    const startIndex = line.indexOf(match);
                    const range = new vscode.Range(lineNumber, startIndex, lineNumber, startIndex + match.length);
                    diagnostics.push(new vscode.Diagnostic(range, 'Invalid hex color format', vscode.DiagnosticSeverity.Error));
                }
            }
        }
    }
    checkVendorPrefixes(line, lineNumber, diagnostics) {
        // Check for outdated vendor prefixes
        const outdatedPrefixes = ['-moz-border-radius', '-webkit-border-radius', '-ms-filter'];
        for (const prefix of outdatedPrefixes) {
            if (line.includes(prefix)) {
                const startIndex = line.indexOf(prefix);
                const range = new vscode.Range(lineNumber, startIndex, lineNumber, startIndex + prefix.length);
                diagnostics.push(new vscode.Diagnostic(range, `Outdated vendor prefix: ${prefix}`, vscode.DiagnosticSeverity.Information));
            }
        }
    }
}
exports.CSSLinter = CSSLinter;
//# sourceMappingURL=cssLinter.js.map