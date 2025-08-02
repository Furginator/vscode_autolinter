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
exports.TypeScriptLinter = void 0;
// src/linters/typescriptLinter.ts - TypeScript specific linter
const vscode = __importStar(require("vscode"));
const ts = __importStar(require("typescript"));
class TypeScriptLinter {
    constructor() {
        this.program = null;
        this.initializeProgram();
    }
    initializeProgram() {
        if (!vscode.workspace.workspaceFolders)
            return;
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const configPath = ts.findConfigFile(workspaceRoot, ts.sys.fileExists, 'tsconfig.json');
        if (configPath) {
            const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
            const compilerOptions = ts.parseJsonConfigFileContent(configFile.config, ts.sys, workspaceRoot);
            this.program = ts.createProgram(compilerOptions.fileNames, compilerOptions.options);
        }
    }
    async lint(uri) {
        if (!this.program)
            return [];
        const sourceFile = this.program.getSourceFile(uri.fsPath);
        if (!sourceFile)
            return [];
        const diagnostics = [];
        // Get TypeScript compiler diagnostics
        const tsDiagnostics = [
            ...this.program.getSemanticDiagnostics(sourceFile),
            ...this.program.getSyntacticDiagnostics(sourceFile)
        ];
        for (const diagnostic of tsDiagnostics) {
            if (diagnostic.file && diagnostic.start !== undefined) {
                const startPos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const endPos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + (diagnostic.length || 0));
                const range = new vscode.Range(startPos.line, startPos.character, endPos.line, endPos.character);
                const severity = diagnostic.category === ts.DiagnosticCategory.Error
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;
                diagnostics.push(new vscode.Diagnostic(range, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), severity));
            }
        }
        return diagnostics;
    }
}
exports.TypeScriptLinter = TypeScriptLinter;
//# sourceMappingURL=typescriptLinter.js.map