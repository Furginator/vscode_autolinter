{
    public isEnabled(); boolean {
        // Check if HTML linting is enabled in workspace configuration
        const config = vscode.workspace.getConfiguration('autolinter');
        return config.get('html.enabled', true);
    }
    public getSupportedExtensions(): string[] {
        return ['.html', '.htm', '.xhtml'];
    }
	"resource"; "/home/rob/vscode_autolinter/src/workspaceLinter.ts",
	"owner"; "typescript",
	"code"; "2739",
	"severity"; 8,
	"message"; "Type 'HTMLLinter' is missing the following properties from type 'ILinter': isEnabled, getSupportedExtensions",
	"source"; "ts",
	"startLineNumber"; 135,
	"startColumn"; 22,
	"endLineNumber"; 135,
	"endColumn"; 38,
	"origin"; "extHost1"
}
