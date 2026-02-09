import * as assert from 'assert';
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webviewHtml';

suite('webviewHtml', () => {
    test('顶部工具栏默认标题应为 codeR', () => {
        const html = buildHtml();
        assert.ok(html.includes('id="toolbar-title" class="toolbar-title">codeR</span>'));
    });

    test('历史筛选不应展示附件路径过滤器', () => {
        const html = buildHtml();
        assert.ok(!html.includes('id="history-workspace-filter"'));
    });

    test('provider-select 首屏不应默认禁用', () => {
        const html = buildHtml();
        assert.ok(!/id="provider-select"[^>]*\sdisabled(\s|>)/.test(html));
    });

    test('provider-select 菜单不应使用位移或缩放动画', () => {
        const html = buildHtml();
        const baseMenuStyle = extractCssBlock(html, '.provider-select-menu');
        const openUpMenuStyle = extractCssBlock(html, '.provider-select-wrap.open-up .provider-select-menu');
        const openMenuStyle = extractCssBlock(html, '.provider-select-wrap.open .provider-select-menu');

        assert.ok(baseMenuStyle.includes('transition: opacity 0.2s ease'));
        assert.ok(!baseMenuStyle.includes('transform:'));
        assert.ok(!openUpMenuStyle.includes('transform:'));
        assert.ok(!openMenuStyle.includes('transform:'));
        assert.ok(!baseMenuStyle.includes('translateY('));
        assert.ok(!baseMenuStyle.includes('scale('));
        assert.ok(!openUpMenuStyle.includes('translateY('));
        assert.ok(!openUpMenuStyle.includes('scale('));
        assert.ok(!openMenuStyle.includes('translateY('));
        assert.ok(!openMenuStyle.includes('scale('));
    });

    test('Recent Tasks 头部不应被默认隐藏', () => {
        const html = buildHtml();
        assert.ok(!html.includes('body:not(.home-mode) .session-header'));
    });

    test('应绑定模型切换、会话新建和历史页入口事件', () => {
        const html = buildHtml();
        assert.ok(html.includes("providerSelectTrigger.addEventListener('click'"));
        assert.ok(html.includes("addSessionBtn.addEventListener('click'"));
        assert.ok(html.includes("sessionViewAllBtn.addEventListener('click'"));
        assert.ok(html.includes("historyBackBtn.addEventListener('click'"));
        assert.ok(html.includes("historyMultiSelectBtn.addEventListener('click'"));
        assert.ok(html.includes("historyMultiDeleteBtn.addEventListener('click'"));
        assert.ok(html.includes("historyMultiExportBtn.addEventListener('click'"));
    });
});

function extractCssBlock(html: string, selector: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`);
    const match = html.match(pattern);
    return match ? match[1] : '';
}

function buildHtml(): string {
    const fakeWebview = {
        cspSource: 'vscode-webview://test',
        asWebviewUri(uri: vscode.Uri) {
            return uri;
        },
    } as unknown as vscode.Webview;

    return getWebviewHtml(fakeWebview, vscode.Uri.file('/tmp/codexr-test-extension'), 'codex');
}
