/**
 * 基础样式 - HTML, body, reset 等
 */
export const BASE_STYLES = `
html {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
}

*,
*::before,
*::after {
    box-sizing: border-box;
}

body {
    width: 100%;
    max-width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 0; margin: 0;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    display: flex; flex-direction: column; height: 100vh;
    overflow: hidden;
}

body.history-mode #top-toolbar {
    display: none;
}
`;
