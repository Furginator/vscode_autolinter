// src/linters/typescriptLinter.ts - TypeScript specific linter
import * as vscode from 'vscode';
import * as ts from 'typescript';
import * as fs from 'fs';

export class TypeScriptLinter {
    private program: ts.Program | null = null;

    constructor() {
        this.initializeProgram();
    }

    private initializeProgram() {
        if (!vscode.workspace.workspaceFolders) return;
        
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const configPath = ts.findConfigFile(workspaceRoot, ts.sys.fileExists, 'tsconfig.json');
        
        if (configPath) {
            const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
            const compilerOptions = ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                workspaceRoot
            );
            
            this.program = ts.createProgram(compilerOptions.fileNames, compilerOptions.options);
        }
    }

    public isEnabled(): boolean {
        // Check if TypeScript is enabled in workspace configuration
        const config = vscode.workspace.getConfiguration('autolinter');
        return config.get('typescript.enabled', true);
    }

    public getSupportedExtensions(): string[] {
        return ['.ts', '.tsx'];
    }

    public async lint(uri: vscode.Uri): Promise<vscode.Diagnostic[]> {
        if (!this.program) return [];
        
        const sourceFile = this.program.getSourceFile(uri.fsPath);
        if (!sourceFile) return [];
        
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Get TypeScript compiler diagnostics
        const tsDiagnostics = [
            ...this.program.getSemanticDiagnostics(sourceFile),
            ...this.program.getSyntacticDiagnostics(sourceFile)
        ];

        for (const diagnostic of tsDiagnostics) {
            if (diagnostic.file && diagnostic.start !== undefined) {
                const startPos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                const endPos = diagnostic.file.getLineAndCharacterOfPosition(
                    diagnostic.start + (diagnostic.length || 0)
                );

                const range = new vscode.Range(
                    startPos.line,
                    startPos.character,
                    endPos.line,
                    endPos.character
                );

                const severity = diagnostic.category === ts.DiagnosticCategory.Error
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;

                diagnostics.push(new vscode.Diagnostic(
                    range,
                    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                    severity
                ));
            }
        }

        return diagnostics;
    }
}