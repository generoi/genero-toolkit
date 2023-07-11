import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Activate the extension
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "genero-toolkit" is now active!');

    // Define the icon paths for light and dark themes
    const generoIcon = {
        light: path.join(__filename, '..', '..', 'resources', 'icon-light.png'),
        dark: path.join(__filename, '..', '..', 'resources', 'icon-dark.png')
    };

    // ID for the Genero Commands tree
    const generoCommandsTreeId = 'generoCommands';

    // Create the Genero Commands tree view
    const generoCommandsProvider = new GeneroCommandsTreeDataProvider();
    const generoCommandsTree = vscode.window.createTreeView(generoCommandsTreeId, {
        treeDataProvider: generoCommandsProvider
    });
    context.subscriptions.push(generoCommandsTree);

    // Create the root tree item for Genero Commands
    const generoCommandsItem = new vscode.TreeItem(
        'Genero Commands',
        vscode.TreeItemCollapsibleState.Collapsed
    );
    generoCommandsItem.iconPath = generoIcon;
    generoCommandsItem.id = generoCommandsTreeId;

    context.subscriptions.push(generoCommandsItem as vscode.Disposable);

    // Register the command to open the Genero Guide
    vscode.commands.registerCommand('genero-toolkit.openGuide', () => {
        // Create a webview panel to display the Genero Guide
        const panel = vscode.window.createWebviewPanel(
            'generoGuideView', // Unique identifier for the panel
            'Genero - Guide', // Title displayed in the panel's header
            vscode.ViewColumn.One, // Desired column of the panel
            {
                enableScripts: true // Allow running scripts in the webview
            }
        );

        // Get the path to the HTML file for the webview
        const webViewPath = vscode.Uri.file(path.join(context.extensionPath, 'webview', 'index.html'));
        const webViewUri = panel.webview.asWebviewUri(webViewPath);

        // Set the HTML content of the webview
        panel.webview.html = getWebViewContent(webViewUri);
    });

    // Function to retrieve the HTML content for the webview
    function getWebViewContent(webViewUri: vscode.Uri): string {
        // Retrieve the content of the HTML file for the webview
        const markdownContent = fs.readFileSync(webViewUri.fsPath, 'utf8');

        // Convert the Markdown content to HTML
        const htmlContent = convertMarkdownToHtml(markdownContent);

        return htmlContent;
    }

    // Function to convert Markdown content to HTML
    function convertMarkdownToHtml(markdownContent: string): string {
        // Use a Markdown-to-HTML library or function to convert the Markdown content to HTML
        // Here's an example using the 'markdown-it' library
        const markdownIt = require('markdown-it')();
        const htmlContent = markdownIt.render(markdownContent);

        return htmlContent;
    }

    // Register the command to run a Genero command
    vscode.commands.registerCommand('genero-toolkit.runCommand', (command: string) => {
        const activeTerminal = vscode.window.activeTerminal;
        if (activeTerminal) {
            executeCommandWithProgress(command, activeTerminal);
        } else {
            const newTerminal = vscode.window.createTerminal();
            executeCommandWithProgress(command, newTerminal);
        }
    });

    // Register a file system watcher for genero.json
    const generoJsonPath = path.join(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '', '.vscode', 'genero.json');
    const generoJsonWatcher = vscode.workspace.createFileSystemWatcher(generoJsonPath);
    context.subscriptions.push(generoJsonWatcher);

    // Handle file change events
    generoJsonWatcher.onDidChange(handleGeneroJsonChange);
    generoJsonWatcher.onDidCreate(handleGeneroJsonChange);

    function handleGeneroJsonChange() {
        generoCommandsProvider.refresh();
    }
}

// Deactivate the extension
export function deactivate() {}

// Function to execute a command with progress
async function executeCommandWithProgress(command: string, terminal: vscode.Terminal) {
    const openTerminalCommand: vscode.Command = {
        command: 'workbench.action.terminal.focus',
        title: 'Open Terminal'
    };

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Running Command...',
            cancellable: false
        },
        async (progress, token) => {
            progress.report({ message: 'Executing command...' });

            try {
                // Execute your command logic here
                // Replace the code below with your actual command execution code
                terminal.sendText(command);
                progress.report({
                    increment: 100,
                    message: `Completed! [Open Terminal](command:${openTerminalCommand.command})`
                });
                await new Promise((resolve) => setTimeout(resolve, 5000)); // Delay before progress bar disappears
            } catch (error) {
                progress.report({ message: 'Command execution failed!' });
                vscode.window.showErrorMessage(`Command execution failed: ${error}`);
            } finally {
                if (!vscode.window.terminals.includes(terminal)) {
                    terminal.dispose(); // Dispose the terminal when progress is complete and the link is not clicked
                }
            }
        }
    );
}

// Tree data provider class for Genero Commands tree
class GeneroCommandsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<
        vscode.TreeItem | undefined | null | void
    >();

    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData
        .event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        return new Promise((resolve) => {
            if (!element) {
                // Root level, return the commands
                const commands = this.getGeneroCommands();
                resolve(commands);
            } else {
                // No children for command items
                resolve([]);
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    private getGeneroCommands(): vscode.TreeItem[] {
        const generoJsonPath = path.join(
            vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
            '.vscode',
            'genero.json'
        );

        if (fs.existsSync(generoJsonPath)) {
            const generoCommands = fs.readFileSync(generoJsonPath, 'utf8');

            try {
                const parsedCommands = JSON.parse(generoCommands);
                const commandNames = Object.keys(parsedCommands);
                const commandItems: vscode.TreeItem[] = [];

                for (const commandName of commandNames) {
                    const command = parsedCommands[commandName];
                    const commandItem = new vscode.TreeItem(command.title, vscode.TreeItemCollapsibleState.None);
                    commandItem.command = {
                        command: 'genero-toolkit.runCommand',
                        title: 'Run Command',
                        arguments: [command.cmd]
                    };
                    commandItems.push(commandItem);
                }

                return commandItems;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to parse genero.json: ${error}`);
            }
        }

        return [];
    }
}
