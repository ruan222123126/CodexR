# Input Modules

这个目录包含从 `webviewScriptInput.ts` 重构出的模块，用于更好的代码组织和可维护性。

## 模块说明

### 1. attachment-manager.ts
负责附件管理功能，包括：
- `mergeAttachments()` - 合并附件列表
- `removeAttachmentByIndex()` - 根据索引移除附件
- `renderAttachments()` - 渲染附件列表 UI
- `formatAttachmentSize()` - 格式化附件大小显示

### 2. drop-handler.ts
处理文件拖放功能，包括：
- `setDropState()` - 设置拖放状态
- `buildAttachmentsFromDrop()` - 从拖放文件构建附件列表
- `handleDropEvent()` - 处理拖放事件
- `isFileDrag()` - 检查是否为文件拖拽
- 拖放事件监听器（dragenter, dragover, dragleave, drop）

### 3. input-events.ts
处理输入框相关事件，包括：
- `send()` - 发送用户输入消息
- 发送按钮点击处理器
- 输入框键盘事件处理器（Enter 键发送）
- 粘贴事件处理器（支持粘贴文件作为附件）

## 使用方式

主文件 `webviewScriptInput.ts` 通过导入这些模块并组合到 `WEBVIEW_SCRIPT_INPUT` 常量中：

```typescript
import { ATTACHMENT_MANAGER_SCRIPT, DROP_HANDLER_SCRIPT, INPUT_EVENTS_SCRIPT } from './scripts/input';

export const WEBVIEW_SCRIPT_INPUT = `
    ${ATTACHMENT_MANAGER_SCRIPT}
    ${DROP_HANDLER_SCRIPT}
    // ... 其他辅助函数 ...
    ${INPUT_EVENTS_SCRIPT}
    // ... 事件监听器设置 ...
`;
```

## 原始文件大小对比

- 重构前 `webviewScriptInput.ts`: ~52.8 KB
- 重构后 `webviewScriptInput.ts`: ~44 KB
- `attachment-manager.ts`: ~4.4 KB
- `drop-handler.ts`: ~4.3 KB
- `input-events.ts`: ~3.4 KB
- `index.ts`: ~0.5 KB

总代码量基本保持一致，但结构更清晰，更易于维护和测试。
