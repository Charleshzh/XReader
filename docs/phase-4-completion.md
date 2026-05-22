# Phase 4 完成报告：书签/笔记 + 阅读统计

**日期**: 2026-05-22  
**分支**: `main` (commit `a2a299a`)  
**状态**: ✅ 全部 8 项任务完成

> Historical snapshot: this document records the project state when Phase 4 was completed. For the current verified status, see `README.md`.

---

## 1. 交付清单

| #   | 任务                                                 | 状态 |
| --- | ---------------------------------------------------- | ---- |
| 1   | Rust: bookmarks CRUD 命令 (add/list/delete)          | ✅   |
| 2   | Rust: annotations CRUD 命令 (add/update/list/delete) | ✅   |
| 3   | Rust: reading stats 命令 (log_session/get_stats)     | ✅   |
| 4   | 前端: 书签按钮 + 书签列表面板                        | ✅   |
| 5   | 前端: 文本选择高亮 + 笔记编辑                        | ✅   |
| 6   | 前端: 阅读计时器 + 字数统计                          | ✅   |
| 7   | 前端: StatsPage 统计面板 + recharts 图表             | ✅   |
| 8   | 集成验证: 标注→统计全流程                            | ✅   |

---

## 2. Rust 后端新增 (9 个命令)

### 2.1 书签 (Bookmarks)

| 命令              | 参数                                      | 返回                | SQL                                       |
| ----------------- | ----------------------------------------- | ------------------- | ----------------------------------------- |
| `add_bookmark`    | `book_id, chapter_index, position, label` | `BookmarkItem`      | INSERT                                    |
| `list_bookmarks`  | `book_id`                                 | `Vec<BookmarkItem>` | SELECT … ORDER BY chapter_index, position |
| `delete_bookmark` | `id`                                      | `()`                | DELETE WHERE id                           |

### 2.2 笔记/高亮 (Annotations)

| 命令                     | 参数                                                                      | 返回                  | SQL                          |
| ------------------------ | ------------------------------------------------------------------------- | --------------------- | ---------------------------- |
| `add_annotation`         | `book_id, chapter_index, start_position, end_position, text, note, color` | `AnnotationItem`      | INSERT                       |
| `list_annotations`       | `book_id, chapter_index`                                                  | `Vec<AnnotationItem>` | SELECT … WHERE chapter_index |
| `update_annotation_note` | `id, note`                                                                | `()`                  | UPDATE SET note, updated_at  |
| `delete_annotation`      | `id`                                                                      | `()`                  | DELETE WHERE id              |

### 2.3 阅读统计 (Reading Stats)

| 命令                  | 参数                            | 返回           | SQL                                          |
| --------------------- | ------------------------------- | -------------- | -------------------------------------------- |
| `log_reading_session` | `book_id, date, seconds, words` | `()`           | UPSERT (ON CONFLICT DO UPDATE)               |
| `get_reading_stats`   | `days`                          | `StatsSummary` | SUM 汇总 + SELECT … ORDER BY date DESC LIMIT |

### 2.4 数据模型

```rust
pub struct BookmarkItem {
    pub id: String,           // UUID v4
    pub book_id: String,
    pub chapter_index: i64,
    pub position: f64,        // 0.0–1.0
    pub label: String,        // 用户命名
    pub created_at: i64,      // Unix 秒
}

pub struct AnnotationItem {
    pub id: String,           // UUID v4
    pub book_id: String,
    pub chapter_index: i64,
    pub start_position: f64,
    pub end_position: f64,
    pub text: String,         // 选中文本
    pub note: String,         // 用户笔记
    pub color: String,        // yellow/green/blue/pink/orange
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct StatsSummary {
    pub total_seconds: i64,
    pub total_words: i64,
    pub daily: Vec<DailyStats>,  // { date, read_seconds, read_words }
}
```

---

## 3. 前端架构

### 3.1 新增依赖

| 包       | 版本  | 用途           |
| -------- | ----- | -------------- |
| recharts | 3.8.1 | 阅读统计柱状图 |

### 3.2 新增组件

| 组件            | 文件                                    | 行数 | 功能                             |
| --------------- | --------------------------------------- | ---- | -------------------------------- |
| BookmarkPanel   | `components/reader/BookmarkPanel.tsx`   | 97   | 右侧滑出书签面板：添加/删除/跳转 |
| AnnotationPanel | `components/reader/AnnotationPanel.tsx` | 136  | 右侧滑出笔记面板：查看/编辑/删除 |
| StatsPage       | `pages/StatsPage.tsx`                   | 118  | /stats 路由页面：统计卡片 + 图表 |

### 3.3 修改组件

| 文件                | 修改内容                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| `ReaderShell.tsx`   | 新增书签📑+笔记🖍按钮、`handleBack()` 自动调用 `endSession()`、10 秒阅读计时器 |
| `ReaderPage.tsx`    | 条件渲染 `BookmarkPanel` / `AnnotationPanel`                                   |
| `BookshelfPage.tsx` | 新增统计📊按钮 → `navigate(/stats)`                                            |
| `App.tsx`           | 新增 `/stats` 路由                                                             |
| `readerStore.ts`    | 扩展至 205 行：Bookmark/Annotation/Session/Stats 全部状态和操作                |

### 3.4 组件布局 (ReaderPage 增强)

```
ReaderPage
├── ReaderShell
│   ├── TopBar: ←Back | Title·Chapter | 📋📑🖍⚙  (新增书签/笔记按钮)
│   ├── Content: HtmlContentView | PdfContentView
│   └── BottomBar: ◀Prev | N/M | Next▶
├── ChapterTOC (左侧, z-40)
├── ReaderSettings (右侧, z-40)
├── BookmarkPanel (右侧, z-40)      ← 新增
└── AnnotationPanel (右侧, z-40)    ← 新增
```

### 3.5 BookmarkPanel

- **位置**: 固定右侧滑出 (w-72, z-40)
- **添加**: 文本输入框 + 添加按钮，空值默认 "书签 N"，Enter 快捷添加
- **列表**: 书签名称 + 章节号，点击跳转并关闭面板
- **删除**: 每行右侧垃圾图标
- **空态**: 居中提示 "暂无书签"
- **底部**: 书签总数统计

### 3.6 AnnotationPanel

- **列表**: 当前章节所有高亮笔记，色点 + 文本预览
- **选中态**: `bg-accent` 高亮，展开笔记编辑器
- **编辑器**: textarea 编辑笔记文本 + 保存/删除按钮
- **颜色**: 5 色 (黄/绿/蓝/粉/橙)，圆形色块指示
- **空态**: Highlighter 图标 + "选中文本后点击高亮" 提示
- **底部**: 笔记总数统计

### 3.7 阅读会话计时器

```typescript
// ReaderShell.tsx
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
useEffect(() => {
  timerRef.current = setInterval(() => {
    useReaderStore.setState((s) => ({
      sessionSeconds: s.sessionSeconds + 10,
    }));
  }, 10000);
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, []);
```

- 每 10 秒递增 `sessionSeconds`
- 返回书架时调用 `endSession()` → `log_reading_session` IPC
- 字数由内容变化触发 `addWords()` 累积

### 3.8 StatsPage (/stats)

- **时间筛选**: 下拉选择 7/14/30/90 天
- **汇总卡片** (3 列):
  - 🕐 总阅读时长: `h m` 格式
  - 📄 总阅读字数: `k`/`万` 格式
  - 📖 日均阅读: 平均时长
- **图表**: recharts `BarChart`，每日阅读分钟柱状图
  - ResponsiveContainer 自适应宽度
  - Tooltip 显示分钟数 + 日期
  - 主色 `hsl(var(--primary))`
- **空态**: "暂无数据"

---

## 4. readerStore 扩展

新增状态字段:

```
bookmarks: BookmarkItem[]      // 当前书籍全部书签
bookmarksOpen: boolean         // 书签面板开关
annotations: AnnotationItem[]  // 当前章节笔记
annotationsOpen: boolean       // 笔记面板开关
selectedAnnotation: AnnotationItem | null  // 选中笔记
sessionSeconds: number         // 本次会话阅读秒数
sessionWords: number           // 本次会话阅读字数
isReading: boolean             // 是否正在阅读
```

新增操作:

```
addBookmark(label)
loadBookmarks()
deleteBookmark(id)
toggleBookmarks()

addAnnotation(text, note, color, start, end)
loadAnnotations()
updateAnnotationNote(id, note)
deleteAnnotation(id)
selectAnnotation(a)
toggleAnnotations()

startSession()
endSession()          // → log_reading_session IPC
addWords(words)

getStats(days)        // → get_reading_stats IPC
```

---

## 5. Tauri IPC 命令总览 (Phase 1-4)

| #   | 命令                     | Phase |
| --- | ------------------------ | ----- |
| 1   | `greet`                  | 1     |
| 2   | `get_app_version`        | 1     |
| 3   | `import_book`            | 2     |
| 4   | `list_books`             | 2     |
| 5   | `delete_book`            | 2     |
| 6   | `get_chapter_content`    | 2     |
| 7   | `get_chapters`           | 3     |
| 8   | `save_progress`          | 3     |
| 9   | `add_bookmark`           | 4     |
| 10  | `list_bookmarks`         | 4     |
| 11  | `delete_bookmark`        | 4     |
| 12  | `add_annotation`         | 4     |
| 13  | `update_annotation_note` | 4     |
| 14  | `list_annotations`       | 4     |
| 15  | `delete_annotation`      | 4     |
| 16  | `log_reading_session`    | 4     |
| 17  | `get_reading_stats`      | 4     |

---

## 6. 验证结果

| 检查项             | 结果                        |
| ------------------ | --------------------------- |
| `cargo check`      | ✅                          |
| `cargo test`       | ✅                          |
| `tsc --noEmit`     | ✅ 零错误                   |
| `eslint`           | ✅ 0 errors                 |
| `prettier --check` | ✅ all files formatted      |
| `vite build`       | ✅ 2440 modules → 1073KB JS |
| `tauri build`      | ✅ .exe + .msi + .nsis      |

---

## 7. 新增/修改文件清单

### 新增 (3 文件)

```
src/components/reader/BookmarkPanel.tsx   书签面板 (97 行)
src/components/reader/AnnotationPanel.tsx 笔记面板 (136 行)
src/pages/StatsPage.tsx                   统计页面 (118 行)
```

### 修改 (7 文件)

```
src-tauri/src/commands.rs     +290 行 (9 个新命令)
src-tauri/src/lib.rs          +9 行 (注册新命令)
src/stores/readerStore.ts     从 137 行 → 205 行
src/components/reader/ReaderShell.tsx  +35 行 (按钮/计时器/handleBack)
src/pages/ReaderPage.tsx      +5 行 (面板渲染)
src/pages/BookshelfPage.tsx   +6 行 (统计按钮)
src/App.tsx                   +2 行 (/stats 路由)
```

---

## 8. 技术决策记录

1. **书签/笔记按 book_id 隔离**: 每个命令都带 `book_id` 参数，切换书籍时重新加载
2. **笔记按章节过滤**: `list_annotations` 仅返回当前章节笔记，减少数据传输
3. **UPSERT 统计累积**: `ON CONFLICT(book_id, date) DO UPDATE SET read_seconds = read_seconds + ?3` 允许同一天多次阅读自动累加
4. **10 秒计时粒度**: 平衡精度与性能，避免每秒触发 setState
5. **书签 position 暂存 0**: MVP 阶段书签仅记录章节级位置，精确页内位置待 Phase 7 翻页模式完善
6. **recharts 类型 workaround**: Tooltip formatter 使用 `unknown` 类型绕过 recharts v3 的 strict type 兼容问题
7. **会话在返回时结束**: `handleBack()` 先 `endSession()` 再 `navigate("/")`，确保数据持久化
8. **annotationsOpen 互斥**: 所有面板 (toc/settings/bookmarks/annotations) 打开时自动关闭其他面板

---

## 9. 下一步：Phase 5 — 书源规则引擎

预计工时 90-140h，最核心、最复杂的模块：

**5a: Tokenizer + RuleCompiler (20-30h)**

- 实现 `@` / `||` / `##` / `{{ }}` / `{$.}` 分词器
- 编译为 RuleSegment AST
- 编译缓存

**5b: RuleEvaluator 六大求值器 (40-60h)**

- CssEval (scraper)
- XpathEval (sxd-xpath)
- JsonEval (jsonpath-rust)
- RegexEval (regex)
- JsEval (rquickjs)
- TmplEval (变量替换)

**5c: SourcePipeline 四大管线 (15-25h)**

- Search / BookInfo / ChapterList / ChapterContent

**5d: 书源管理 UI (15-25h)**

- 导入/导出 Legado JSON
- 发现页 (ruleExplore)
