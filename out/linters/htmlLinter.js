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
exports.HTMLLinter = void 0;
// src/linters/htmlLinter.ts
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class HTMLLinter {
    async lint(uri) {
        const diagnostics = [];
        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            return this.validateHTML(content);
        }
        catch (error) {
            console.warn('HTML linting failed:', error);
            return diagnostics;
        }
    }
    validateHTML(content) {
        const diagnostics = [];
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
    checkUnclosedTags(line, lineNumber, diagnostics) {
        // Simple check for unclosed tags (this is basic - a real parser would be better)
        const openTags = line.match(/<[^\/][^>]*[^\/]>/g) || [];
        const closeTags = line.match(/<\/[^>]+>/g) || [];
        const selfClosingTags = line.match(/<[^>]*\/>/g) || [];
        // This is a simplified check - real HTML validation would need a proper parser
        if (openTags.length > closeTags.length + selfClosingTags.length) {
            const range = new vscode.Range(lineNumber, 0, lineNumber, line.length);
            diagnostics.push(new vscode.Diagnostic(range, 'Possible unclosed HTML tag', vscode.DiagnosticSeverity.Warning));
        }
    }
    checkMissingAltAttributes(line, lineNumber, diagnostics) {
        const imgTags = line.match(/<img[^>]*>/gi);
        if (imgTags) {
            for (const imgTag of imgTags) {
                if (!imgTag.includes('alt=')) {
                    const startIndex = line.indexOf(imgTag);
                    const range = new vscode.Range(lineNumber, startIndex, lineNumber, startIndex + imgTag.length);
                    diagnostics.push(new vscode.Diagnostic(range, 'Image missing alt attribute for accessibility', vscode.DiagnosticSeverity.Warning));
                }
            }
        }
    }
    checkDeprecatedTags(line, lineNumber, diagnostics) {
        const deprecatedTags = ['font', 'center', 'big', 'small', 'tt'];
        for (const tag of deprecatedTags) {
            const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
            const matches = line.match(regex);
            if (matches) {
                for (const match of matches) {
                    const startIndex = line.indexOf(match);
                    const range = new vscode.Range(lineNumber, startIndex, lineNumber, startIndex + match.length);
                    diagnostics.push(new vscode.Diagnostic(range, `Deprecated HTML tag: ${tag}`, vscode.DiagnosticSeverity.Warning));
                }
            }
        }
    }
    checkMissingDoctype(content, lineNumber, diagnostics) {
        if (lineNumber === 0 && !content.toLowerCase().includes('<!doctype')) {
            const range = new vscode.Range(0, 0, 0, 0);
            diagnostics.push(new vscode.Diagnostic(range, 'Missing DOCTYPE declaration', vscode.DiagnosticSeverity.Information));
        }
    }
}
exports.HTMLLinter = HTMLLinter;
//# sourceMappingURL=htmlLinter.js.map