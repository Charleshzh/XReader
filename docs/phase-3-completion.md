# Phase 3 完成报告：阅读器核心

**日期**: 2026-05-22  
**分支**: `main` (commit `364b578`)  
**状态**: ✅ 全部 10 项任务完成

---

## 1. 交付清单

| # | 任务 | 状态 |
|---|------|------|
| 1 | 安装 pdfjs-dist + 阅读器依赖 | ✅ |
| 2 | ReaderPage 路由 + 从 BookshelfPage 导航 | ✅ |
| 3 | readerStore: 章节加载/进度/设置 | ✅ |
| 4 | ReaderShell: 统一阅读器外壳布局 | ✅ |
| 5 | HtmlContentView: EPUB/TXT 渲染 (滚动/翻页) | ✅ |
| 6 | PdfContentView: pdf.js 集成 (翻页/缩放) | ✅ |
| 7 | ChapterTOC 章节目录侧边栏 | ✅ |
| 8 | ReaderSettings: 字体/行距/主题面板 | ✅ |
| 9 | 阅读进度记录与恢复 | ✅ |
| 10 | 集成验证: 三种格式阅读流程 | ✅ |

---

## 2. 架构设计

### 2.1 页面流转

```
BookshelfPage ──(点击书籍)──→ /reader/:bookId
                                  │
                          ReaderPage (格式判断)
                             ┌────┴────┐
                         EPUB/TXT    PDF
                             │         │
                    HtmlContentView  PdfContentView
                             │         │
                    (HTML dangerously  (pdf.js Canvas
                     SetInnerHTML)     逐页渲染)
```

### 2.2 组件树

```
ReaderPage
├── ReaderShell (外壳)
│   ├── TopBar: 返回 + 书名·章节名 + 目录/设置按钮
│   ├── Content: HtmlContentView | PdfContentView
│   └── BottomBar: ◀上一章 | N/M | 下一章▶
├── ChapterTOC (左侧滑出)
│   ├── 标题栏 + 关闭按钮
│   ├── 章节列表 (高亮当前章)
│   └── 章数统计
└── ReaderSettings (右侧滑出)
    ├── 字号: 14/16/18/20/22/24/28
    ├── 行高: 1.4/1.6/1.8/2.0/2.2/2.5
    ├── 主题: ☀亮色 / ☾暗色 / 护眼(sepia)
    └── 模式: 滚动 / 翻页
```

---

## 3. 组件详解

### 3.1 ReaderShell

- **顶栏**: 返回箭头 → `navigate("/")`、书名·章节名（居中）、目录📋按钮、设置⚙按钮
- **内容区**: `flex-1 overflow-hidden`，由子组件填充
- **底栏**: 上一章/下一章按钮（首尾禁用）、`N/M` 进度指示
- **键盘**: ArrowLeft/Right 在翻页模式下切换章节
- **主题**: 三套 CSS 类 → `bg-white` / `bg-gray-900` / `bg-amber-50`

### 3.2 HtmlContentView (EPUB/TXT)

- **渲染**: `dangerouslySetInnerHTML` 渲染 Rust 后端提取的 HTML
- **滚动模式**: `overflow-y: auto`，防抖 500ms 上报滚动位置 → `save_progress`
- **翻页模式**: `overflow-y: hidden`（键盘翻章由 ReaderShell 处理）
- **样式**: CS Custom Properties `--margin-h` / `--margin-v` 动态设置边距
- **内容切换**: 章节切换时自动 `scrollTop = 0`

### 3.3 PdfContentView (PDF)

- **库**: pdfjs-dist 5.7.284
- **加载**: `convertFileSrc(filePath)` → Tauri asset protocol → pdfjsLib.getDocument
- **渲染**: page.render({ canvasContext, viewport }) → Canvas 逐页绘制
- **控制**: 缩放/缩小(±0.2, 0.5-3x)、上/下页
- **状态**: loading → error → rendered 三态
- **主题**: 背景色跟随全局主题

### 3.4 ChapterTOC

- **位置**: 左侧 fixed 滑出 (z-40, w-72)
- **列表**: 点击章节 → `loadChapter(index)` + 关闭侧栏
- **高亮**: 当前章节 `bg-accent font-medium text-primary`
- **遮罩**: 无遮罩（内容区自然被推开）

### 3.5 ReaderSettings

- **字号**: 7 个预设按钮 (14-28px)
- **行高**: 6 个预设按钮 (1.4-2.5x)
- **主题**: 3 个图标卡片 (Sun/Moon/BookOpen)，选中高亮 `border-primary`
- **模式**: 滚动/翻页双按钮切换
- **尺寸**: 右侧 fixed (z-40, w-72)

---

## 4. 状态管理 (readerStore)

```typescript
interface ReaderState {
  book: BookItem | null;         // 当前书籍
  chapters: ChapterInfo[];       // 章节列表
  currentChapter: number;        // 当前章节索引
  content: string;               // 当前章节 HTML 内容
  loading: boolean;
  settings: ReaderSettings;      // 字体/行距/主题/模式
  tocOpen: boolean;              // 目录侧栏
  settingsOpen: boolean;         // 设置面板

  openBook(book): Promise<void>;    // 打开书籍 → 加载章节列表 + 第1章
  loadChapter(index): Promise<void>; // 加载指定章节
  nextChapter / prevChapter();       // 上/下章
  saveProgress(idx, pos);            // 保存进度到 SQLite
  updateSettings(partial);           // 更新设置
  toggleToc / toggleSettings();      // 切换面板
}
```

---

## 5. Rust 后端新增

### 5.1 get_chapters 命令

```
输入: book_id (String)
输出: Vec<{ index: usize, title: String }>
流程: 查 DB → 获取 file_path → FormatRegistry 匹配 → format.get_chapters()
```

### 5.2 save_progress 命令

```
输入: book_id, chapter_index (i64), position (f64)
流程: INSERT … ON CONFLICT DO UPDATE → reading_progress 表
```

### 5.3 BookListItem 扩展

新增 `file_path: String` 字段，前端 `BookItem` 同步新增，供 PdfContentView 构造 asset URL。

---

## 6. 验证结果

| 检查项 | 结果 |
|--------|------|
| `cargo check` | ✅ |
| `cargo test` | ✅ |
| `tsc --noEmit` | ✅ 零错误 |
| ESLint | ✅ |
| `vite build` | ✅ 1789 modules → 702KB JS + 2.1MB pdf.worker |
| `tauri build` | ✅ .exe + .msi + .nsis |

---

## 7. 新增文件清单 (10 文件)

```
src/types/reader.ts                    ReaderSettings + ChapterInfo 类型
src/stores/readerStore.ts              Zustand 阅读器状态管理
src/pages/ReaderPage.tsx               阅读器页面 (格式路由)
src/components/reader/ReaderShell.tsx   统一外壳 (顶栏/底栏/键盘)
src/components/reader/HtmlContentView.tsx  EPUB/TXT HTML 渲染
src/components/reader/PdfContentView.tsx   pdf.js Canvas 渲染
src/components/reader/ChapterTOC.tsx    章节目录侧栏
src/components/reader/ReaderSettings.tsx 阅读设置面板
```

### 修改文件

```
src/App.tsx                           新增 /reader/:bookId 路由
src/pages/BookshelfPage.tsx           navigate → 打开阅读器
src/types/book.ts                     新增 file_path 字段
src-tauri/src/commands.rs             新增 get_chapters + save_progress
src-tauri/src/db/queries.rs           BookListItem 新增 file_path
src-tauri/src/lib.rs                  注册新命令
```

---

## 8. 技术决策记录

1. **无 epub.js 依赖**: Rust 后端已提取章节 HTML，前端直接渲染，避免 epub.js 的 iframe 限制和 React 19 兼容问题
2. **pdf.js v5**: 最新稳定版，支持 `canvasContext` API，Worker 内联打包 (~2MB)
3. **CSS Custom Properties 动态样式**: `--margin-h` / `--margin-v` 在 style 属性中设置，避免 className 爆炸
4. **防抖 save_progress 500ms**: 避免滚动时频繁 IPC 调用
5. **asset protocol 加载 PDF**: `convertFileSrc(file_path)` 生成 `asset://localhost/…` URL，pdf.js 通过 fetch 加载

---

## 9. 下一步：Phase 4 — 书签/笔记 + 阅读统计

预计工时 30-50h，核心任务：

- 书签添加/管理 UI
- 文本选择与高亮 (EPUB/TXT)
- 笔记编辑面板
- 书签/笔记列表与跳转、导出 JSON/Markdown
- 阅读时长追踪 (会话计时 + 日/周/月汇总)
- 阅读字数统计与每日目标
- 统计图表展示 (recharts)
