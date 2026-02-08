# 思考状态样式更新说明

## 更新时间
2026-02-08

## 更新内容
为 CodexR 输入框添加了思考状态（AI 处理中）的视觉反馈，参考了示例 React 组件的样式。

## 主要更改

### 1. CSS 样式更新

#### 思考状态下的输入容器
- 背景色变为 `#111`
- 边框颜色变为灰色半透明
- 阴影效果调整
- 添加了 `.obsidian-input-container.thinking` 类

#### 思考状态下的输入框
- 禁用状态下的文字颜色变暗
- 光标变为等待样式（`cursor: wait`）
- 占位符文字变暗

#### 思考状态下的发送/停止按钮
- 背景变为灰色半透明
- 图标从箭头变为正方形（停止图标）
- 添加脉冲背景动画
- 鼠标悬停时显示红色边框（表示取消操作）
- 添加了 `.obsidian-send-btn.thinking` 类

#### 进度条装饰
- 思考状态下显示底部渐变进度条
- 使用脉冲动画效果

#### 状态指示器
- 显示 "Ready" 或 "Thinking" 状态
- 包含脉冲动画的小圆点
- 显示提示文字（如 "Click to stop"）

### 2. HTML 结构更新

#### 新增元素
- `#input-container` - 输入容器（用于添加样式类）
- `#add-btn` - 添加按钮（需要禁用）
- `#send-btn-content` - 发送按钮内容容器（用于放置动画背景）
- `#send-icon` - 发送/停止图标
- `#status-text` - 状态文字
- `#hint-text` - 提示文字
- `.obsidian-progress-bar` - 进度条
- `.obsidian-status-bar` - 状态栏容器

### 3. JavaScript 功能更新

#### 新增变量
- `isThinking` - 跟踪当前是否处于思考状态

#### 新增函数
- `setThinkingState(thinking)` - 切换思考状态的 UI 更新
  - 添加/移除 `.thinking` CSS 类
  - 启用/禁用输入框和按钮
  - 更新按钮图标和样式
  - 更新状态文字
  - 管理动画背景元素

#### 修改现有函数
- `send()` - 现在支持停止功能
  - 如果处于思考状态，发送 `cancel` 消息
  - 否则发送用户输入

#### 消息处理更新
- `stream-start` - 调用 `setThinkingState(true)`
- `stream-end` - 调用 `setThinkingState(false)`

### 4. TypeScript 后端更新

#### 新增方法
- `cancelExecution()` - 取消当前执行的 codex 命令
  - 终止子进程
  - 发送取消通知到 webview

#### 消息处理
- 添加对 `cancel` 消息类型的处理

## 视觉效果

### 正常状态
- 半透明背景，带有毛玻璃效果
- 白色发送按钮
- 状态显示 "Ready"

### 思考状态
- 深色背景 (#111)
- 输入框禁用，占位符显示 "AI is processing..."
- 发送按钮变为停止按钮（灰色，带脉冲动画）
- 鼠标悬停时显示红色边框
- 底部显示渐变进度条
- 状态显示 "Thinking"（带脉冲圆点）
- 提示文字 "Click to stop"

## 编译和打包

```bash
cd /mnt/Files/CodexR
npm run compile       # 编译 TypeScript
npx vsce package      # 打包 VS Code 扩展
```

## 安装和使用

1. 在 VS Code 中，打开 Extensions 面板
2. 点击 `...` 菜单，选择 "Install from VSIX..."
3. 选择生成的 `codexsidebar-0.0.1.vsix` 文件
4. 重新加载窗口
5. 打开侧边栏的 Codex ChatR 视图
6. 输入问题并观察思考状态的视觉反馈

## 文件更改

- `src/CodexProvider.ts` - 所有更改都在此文件中
  - CSS 样式（约 150 行）
  - HTML 结构（约 10 行）
  - JavaScript 逻辑（约 50 行）
  - TypeScript 后端（约 20 行）

## 注意事项

1. 所有样式都使用 VS Code 主题变量，确保在不同主题下都能正常显示
2. 动画效果使用 CSS `@keyframes` 实现
3. 停止功能通过终止子进程实现
4. 状态切换通过添加/移除 CSS 类实现，性能高效
