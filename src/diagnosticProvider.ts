// src/diagnosticProvider.ts - Manages VS Code diagnostics
import * as vscode from 'vscode';

export class DiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('workspace-linter');
    }

    public setDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) {
        this.diagnosticCollection.set(uri, diagnostics);
    }

    public clearDiagnostics(uri: vscode.Uri) {
        this.diagnosticCollection.delete(uri);
    }

    public clearAllDiagnostics() {
        this.diagnosticCollection.clear();
    }

    public dispose() {
        this.diagnosticCollection.dispose();
    }
}