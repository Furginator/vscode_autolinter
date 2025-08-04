# VS Code AutoLinter

An intelligent, modular automated linter extension for Visual Studio Code that provides real-time code quality analysis across multiple programming languages.

## 🎯 Project Vision

Create a unified linting experience that automatically detects file types, applies appropriate linters, and provides actionable feedback with minimal configuration.

## 🏗️ Architecture Overview

The project structure is detailed in `tree.txt` in the root directory, which outlines the directory layout and key files. To view the structure, check `tree.txt` or run `tree -a --dirsfirst -I "node_modules|.git|out"` in the project root.

Key components:
- `src/config/`: Configuration management system
- `src/diagnostics/`: VS Code diagnostics integration
- `src/linters/`: Language-specific linters
- `src/test/`: Test suites
- `src/utils/`: Shared utilities
- `src/diagnosticProvider.ts`: Central diagnostic coordination
- `src/extensions.ts`: Main extension entry point
- `src/workspaceLinter.ts`: Workspace-wide linting orchestration

## 🔧 Development Progress

### ✅ Completed

* Basic project structure setup (src/ directory created)
* package.json - Extension manifest with commands, menus, configuration, scripts, and dependencies
* extensions.ts - Extension activation/deactivation, command registration, file system watchers, editor event listeners, status bar
* tsconfig.json - TypeScript compiler configuration
* diagnosticProvider.ts - Diagnostic collection, management, statistics tracking, and LintIssue/ILinter interfaces
* workspaceLinter.ts - Workspace-wide linting orchestration with linting queue, gitignore support, and performance stats
* linters/typescriptLinter.ts - TypeScript linting using the TypeScript compiler
* linters/javascriptLinter.ts - JavaScript linting using ESLint with workspace/global support
* linters/pythonLinter.ts - Python linting using flake8 or pylint
* linters/htmlLinter.ts - HTML linting using htmlhint
* linters/cssLinter.ts - CSS linting with basic checks for brackets, semicolons, colors, and vendor prefixes
* config/configManager.ts - Temporary stub for configuration management

### 🚧 In Progress - Phase 2: Configuration System

* config/configManager.ts - Full implementation for settings management, validation, and persistence (next to implement)

### 📋 Planned Implementation Order

#### Phase 1: Core Infrastructure

1. extensions.ts - Extension activation, deactivation, command registration (completed)
2. diagnosticProvider.ts - Diagnostic collection, management, and VS Code integration (completed)
3. workspaceLinter.ts - File discovery, linter coordination, performance management (completed)

#### Phase 2: Configuration System

1. config/configManager.ts - Settings management, validation, and persistence
2. config/linterConfig.ts - Linter-specific configuration schemas
3. config/settingsValidator.ts - Configuration validation and defaults

#### Phase 3: Utility Layer

1. utils/fileUtils.ts - File system operations, type detection
2. utils/performanceMonitor.ts - Performance tracking and optimization
3. utils/logger.ts - Structured logging system

#### Phase 4: Language Linters

1. linters/typescriptLinter.ts - TypeScript compiler diagnostics (completed)
2. linters/javascriptLinter.ts - JavaScript linting using ESLint (completed)
3. linters/pythonLinter.ts - Python code analysis (completed)
4. linters/htmlLinter.ts - HTML template validation (completed)
5. linters/cssLinter.ts - CSS/SCSS linting with basic checks, to be enhanced with stylelint (completed)

#### Phase 5: Advanced Features

1. diagnostics/diagnosticManager.ts - Advanced diagnostic handling
2. diagnostics/quickFixProvider.ts - Automated fix suggestions

#### Phase 6: Testing & Polish

1. Comprehensive test suite
2. Performance optimization
3. Documentation completion
4. Extension marketplace preparation

## 🚀 Key Features (Planned)

* Automatic Language Detection: Detects file types and applies appropriate linters
* Real-time Analysis: Instant feedback with debounced file change handling
* Unified Configuration: Single system for all linters
* Performance Optimized: Efficient file watching, linting queue, and batch processing
* Extensible Architecture: Pluggable linters
* Rich Diagnostics: Detailed error messages with statistics
* Workspace Integration: Project-wide linting with exclude patterns and gitignore support

## 🛠️ Technical Implementation

### Core Principles

- Modular Design: Independent, pluggable linters
- Performance First: Non-blocking operations with debouncing and queueing
- User Experience: Clear feedback via status bar and diagnostics
- Reliability: Robust error handling

### Technology Stack

- Language: TypeScript
- Platform: VS Code Extension API
- Testing: VS Code Test Framework
- Build: TypeScript Compiler
- Linting: ESLint for JavaScript, TypeScript compiler for TypeScript, flake8/pylint for Python, htmlhint for HTML, custom checks for CSS

## 📝 Current Focus

Implementing the configuration system. With core infrastructure and all linters complete, next is the full implementation of `config/configManager.ts` to handle settings like ESLint/htmlhint config paths and enabled languages.

## Getting Started

1. Clone the repository: `git clone https://github.com/Furginator/vscode_autolinter.git`
2. Install dependencies: `npm install`
3. Install linters:
   - Python: `pip install flake8 pylint`
   - HTML: `npm install htmlhint -g`
   - JavaScript: `npm install eslint --save-dev`
4. Compile the extension: `npm run compile`
5. Debug in VSCode: Press `F5`
6. Test commands like "AutoLinter: Start Linting" or "AutoLinter: Lint Current File" on `.ts`, `.js`, `.py`, `.html`, or `.css` files

## License
MIT