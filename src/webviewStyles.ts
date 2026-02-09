/**
 * WebView 样式主入口
 * 从各个模块组合生成完整的 WEBVIEW_STYLES
 */
import { BASE_STYLES } from './styles/base.js';
import { TOOLBAR_STYLES } from './styles/toolbar.js';
import { CHAT_STYLES } from './styles/chat.js';
import { INPUT_STYLES } from './styles/input.js';
import { HISTORY_STYLES } from './styles/history.js';

export const WEBVIEW_STYLES = `
<style>
${BASE_STYLES}
${TOOLBAR_STYLES}
${CHAT_STYLES}
${INPUT_STYLES}
${HISTORY_STYLES}
</style>
`;
