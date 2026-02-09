# 前后端连接配置审计报告

生成时间: 2026-02-09
审计范围: 事件名称、状态名称、API端点、变量命名一致性

---

## 一、前端发送到后端的事件 (Frontend → Backend)

### 1.1 输入相关事件

| 事件名称 | 位置 | 后端处理 | 状态 |
|---------|------|---------|------|
| `userInput` | `src/scripts/input/input-events.ts` | `CodexProvider.ts:151` | ✅ 匹配 |
| `pickAttachments` | `src/webviewScriptInput.ts` | `CodexProvider.ts:160` | ✅ 匹配 |
| `cancel` | `src/scripts/input/input-events.ts` | `CodexProvider.ts:165` | ✅ 匹配 |

### 1.2 Session 相关事件

| 事件名称 | 位置 | 后端处理 | 状态 |
|---------|------|---------|------|
| `session-list-request` | `src/webviewScriptInput.ts` | `CodexProvider.ts:170` | ✅ 匹配 |
| `session-create` | `src/webviewScriptInput.ts` | `CodexProvider.ts:175` | ✅ 匹配 |
| `session-switch` | `src/webviewScriptInput.ts` | `CodexProvider.ts:188` | ✅ 匹配 |
| `session-provider-update` | `src/webviewScriptInput.ts` | `CodexProvider.ts:203` | ✅ 匹配 |
| `session-rename` | `src/webviewScriptInput.ts` | `CodexProvider.ts:215` | ✅ 匹配 |
| `session-rename-request` | `src/webviewScriptInput.ts` | `CodexProvider.ts:222` | ✅ 匹配 |
| `session-delete` | `src/webviewScriptInput.ts` | `CodexProvider.ts:232` | ✅ 匹配 |
| `session-delete-request` | `src/webviewScriptInput.ts` | `CodexProvider.ts:249` | ✅ 匹配 |
| `session-export` | `src/webviewScriptInput.ts` | `CodexProvider.ts:268` | ✅ 匹配 |
| `session-multi-delete` | `src/webviewScriptInput.ts` | `CodexProvider.ts:273` | ✅ 匹配 |
| `session-multi-export` | `src/webviewScriptInput.ts` | `CodexProvider.ts:292` | ✅ 匹配 |

---

## 二、后端发送到前端的事件 (Backend → Frontend)

### 2.1 初始化相关

| 事件名称 | 后端位置 | 前端处理 | 状态 |
|---------|---------|---------|------|
| `provider-init` | `CodexProvider.ts:321` | `webviewScriptInput.ts:878` | ✅ 匹配 |

### 2.2 Session 相关

| 事件名称 | 后端位置 | 前端处理 | 状态 |
|---------|---------|---------|------|
| `session-list` | `session-manager.ts:443` | `webviewScriptInput.ts:887` | ✅ 匹配 |
| `session-active` | `session-manager.ts:449` | `webviewScriptInput.ts:896` | ✅ 匹配 |
| `session-error` | `session-manager.ts:521` | `webviewScriptInput.ts:569` (addMessage) | ✅ 匹配 |

### 2.3 流式响应相关

| 事件名称 | 后端位置 | 前端处理 | 状态 |
|---------|---------|---------|------|
| `stream-start` | `executor.ts:104` | `webviewScriptInput.ts:475` (addMessage) | ✅ 匹配 |
| `stream-update` | `executor.ts:238` | `webviewScriptInput.ts:497` (addMessage) | ✅ 匹配 |
| `stream-end` | `executor.ts:多处` | `webviewScriptInput.ts:505` (addMessage) | ✅ 匹配 |

### 2.4 消息相关

| 事件名称 | 后端位置 | 前端处理 | 状态 |
|---------|---------|---------|------|
| `system` | `executor.ts:110-116` | `webviewScriptInput.ts:561` (addMessage) | ✅ 匹配 |
| `done` | `executor.ts:多处` | `webviewScriptInput.ts:473` (addMessage) | ✅ 匹配 |
| `user` | - | `webviewScriptInput.ts:577` (addMessage) | ⚠️ 前端未使用 |
| `bot-complex` | - | `webviewScriptInput.ts:581` (addMessage) | ⚠️ 前端未使用 |
| `bot` | - | `webviewScriptInput.ts:595` (addMessage) | ⚠️ 前端未使用 |

### 2.5 附件相关

| 事件名称 | 后端位置 | 前端处理 | 状态 |
|---------|---------|---------|------|
| `attachments-update` | `attachment-manager.ts:76` | `webviewScriptInput.ts:919` | ✅ 匹配 |

---

## 三、Provider 类型一致性

### 3.1 后端定义 (`src/providers/types.ts`)

```typescript
export type ProviderType = 'claude' | 'pi' | 'codex';
```

### 3.2 前端使用 (`src/webviewScriptInput.ts`)

```typescript
function getProviderLabel(provider) {
    if (provider === 'claude') return 'Claude';
    if (provider === 'pi') return 'Pi';
    return 'Codex';
}

function normalizeProvider(provider) {
    if (provider === 'claude') return 'claude';
    if (provider === 'pi') return 'pi';
    return 'codex';
}
```

### 3.3 后端 normalizeProvider (`src/providers/config.ts`)

```typescript
static normalizeProvider(value: unknown): ProviderType {
    if (value === 'claude') return 'claude';
    if (value === 'pi') return 'pi';
    return 'codex';
}
```

**状态**: ✅ Provider 类型定义和 normalizeProvider 函数完全一致

---

## 四、发现的问题

### ❌ 问题 1: `updatedAtAt` 拼写错误

**位置**: `src/webviewScriptInput.ts:151`

**问题代码**:
```typescript
const rightUpdated = Number(right && right.updatedAtAt ? right.updatedAt : 0);
```

**分析**:
- 条件检查 `right.updatedAtAt` 但实际访问的是 `right.updatedAt`
- 这看起来是复制粘贴 `leftUpdated` 时的错误
- 会话对象只有 `updatedAt` 属性，没有 `updatedAtAt`

**影响**: 该条件永远为 false，导致 `rightUpdated` 在某些情况下可能无法正确获取值

**建议修复**:
```typescript
const rightUpdated = Number(right && right.updatedAt ? right.updatedAt : 0);
```

---

### ⚠️ 问题 2: `historySortValue` 和 `historySortOrder` 变量冗余

**位置**: `src/webviewScriptInput.ts`

**变量定义** (`src/webviewScript.ts:51`):
```typescript
let historySortOrder = 'updated-desc';
// ...
let historySortValue = 'updated-desc';
```

**使用分析**:

1. `historySortOrder` 只在初始化时定义，后续代码中**从未被读取**
2. `historySortValue` 在多处使用，并被赋值
3. 第846行有 `historySortOrder = historySortValue;` 的赋值，但该值后续从未被使用

**影响**:
- `historySortOrder` 是无用的变量
- 可能造成代码维护者困惑

**建议修复**: 删除 `historySortOrder` 变量

---

### ⚠️ 问题 3: 未使用的消息类型

**位置**: `src/webviewScriptInput.ts` addMessage 函数

**问题**:
- `type === 'user'` (行577): 后端从未发送此类型
- `type === 'bot-complex'` (行581): 后端从未发送此类型
- `type === 'bot'` (行595): 后端从未发送此类型

这些代码可能是遗留代码或为了未来扩展预留的。

---

## 五、配置项名称检查

### 5.1 VSCode 配置项 (`package.json`)

```json
"codexSidebar": {
    "defaultProvider": "codex",
    "parserMode": "v2",
    "showToolUsageIndicator": true,
    "codexThinkingNoiseFilterEnabled": true,
    "codexAutoResumeSession": true
}
```

### 5.2 Config 类访问 (`src/providers/config.ts`)

| 配置项 | Config 类访问 | 状态 |
|--------|--------------|------|
| `defaultProvider` | `getDefaultProvider()` | ✅ 匹配 |
| `parserMode` | `getParserMode()` | ✅ 匹配 |
| `showToolUsageIndicator` | `shouldShowToolUsageIndicator()` | ✅ 匹配 |
| `codexThinkingNoiseFilterEnabled` | `shouldEnableCodexThinkingNoiseFilter()` | ✅ 匹配 |
| `codexAutoResumeSession` | `shouldAutoResumeCodexSession()` | ✅ 匹配 |

---

## 六、总结

### ✅ 正常项

1. **事件名称**: 前后端所有事件名称完全匹配
2. **Provider 类型**: 前后端 Provider 类型定义一致
3. **normalizeProvider 函数**: 前后端实现一致
4. **VSCode 配置项**: 配置键名与 Config 类访问完全匹配

### ❌ 必须修复

1. **`updatedAtAt` 拼写错误**: 第151行，可能导致排序逻辑错误

### ⚠️ 建议优化

1. **删除 `historySortOrder`**: 无用的冗余变量
2. **清理未使用的消息类型**: `user`, `bot-complex`, `bot` (可选，可能是预留代码)

---

## 七、修复建议代码

### 修复问题 1: updatedAtAt 拼写错误

```typescript
// 文件: src/webviewScriptInput.ts
// 行号: 151

// 修复前:
const rightUpdated = Number(right && right.updatedAtAt ? right.updatedAt : 0);

// 修复后:
const rightUpdated = Number(right && right.updatedAt ? right.updatedAt : 0);
```

### 修复问题 2: 删除 historySortOrder

```typescript
// 文件: src/webviewScript.ts
// 行号: 51

// 删除这一行:
let historySortOrder = 'updated-desc';

// 同时删除 src/webviewScriptInput.ts:846 的赋值:
historySortOrder = historySortValue;
```

---

## 八、验证步骤

1. 修复后测试会话列表排序功能
2. 验证历史页面按时间排序正常工作
3. 检查浏览器控制台是否有 JavaScript 错误
4. 测试所有 Session 相关操作（创建、切换、删除、导出）

---

## 九、验证和修复状态（2026-02-09 更新）

### ✅ 已验证的问题

| 问题 | 验证结果 | 说明 |
|------|---------|------|
| 问题1: updatedAtAt 拼写错误 | ✅ 无此问题 | 代码实际使用 `right.updatedAt`，审计报告误报 |
| 问题2: historySortOrder 冗余 | ✅ 已移除 | 该变量不存在，已被清理或从未存在 |
| 问题3: 未使用消息类型 | ✅ 预留代码 | 这些是向后兼容的预留处理逻辑 |

### ✅ 已修复的问题

| 问题 | 文件 | 行号 | 修复状态 |
|与其他问题（如前述 updatedAtAt 拼写错误、historySortOrder 冗余、未使用消息类型等）无直接关联，但属于潜在风险清理的一部分，有助于提升代码健壮性。

---
## 扩展检查
### 问题 2: timeout 处理 flushTimer 清除
| 问题 | 文件 | 行号 | 修复状态 |
|------|------|------|----------|
| 问题 2 | src/providers/executor.ts | 355-377 | ✅ 已修复 |

**修复内容**:
在 `endedByTimeout = true` 后添加 flushTimer 清除逻辑：
```typescript
endedByTimeout = true;
if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
}
child.kill();
```

### ⏸️ 待验证的任务

| 任务 | 说明 |
|------|------|
| TypeScript 编译检查 | 需运行 `npx tsc --noEmit` |
| ESLint 检查 | 需运行 `npm run lint` |

### 📝 修复总结

**已执行修复**:
- ✅ 在 `src/providers/executor.ts` 的 timeout 处理中添加 flushTimer 清除逻辑

**影响分析**:
- 该修复为防御性编程，提升代码健壮性
- 原代码中 `child.on('close')` 会清除 flushTimer，因此实际影响较小
- 修复后确保在 kill 子进程前主动清除定时器，避免潜在内存泄漏
