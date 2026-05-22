# Phase 2 完成报告：本地书籍导入与书架

**日期**: 2026-05-22  
**分支**: `main` (commit `c9e057d`)  
**状态**: ✅ 全部 8 项任务完成

---

## 1. 交付清单

| # | 任务 | 状态 |
|---|------|------|
| 1 | BookFormat trait + FormatRegistry | ✅ |
| 2 | EPUB 解析 (元数据/封面/目录/内容) | ✅ |
| 3 | TXT 编码检测 + 正则分章 | ✅ |
| 4 | PDF 元数据提取 | ✅ |
| 5 | Tauri commands: import_book / list_books / delete_book / get_chapter_content | ✅ |
| 6 | 书架 UI (网格/列表/搜索) | ✅ |
| 7 | 导入对话框 + 多文件选择 | ✅ |
| 8 | 集成验证: 编译 + 构建 + 打包 | ✅ |

---

## 2. Rust 后端架构

### 2.1 可扩展格式架构

```rust
pub trait BookFormat: Send + Sync {
    fn format_name(&self) -> &'static str;         // "epub" / "txt" / "pdf"
    fn extensions(&self) -> &[&str];               // ["epub"] / ["txt"]
    fn parse(&self, path: &Path) -> Result<BookMeta>;
    fn extract_cover(&self, path: &Path, output_dir: &Path) -> Result<Option<PathBuf>>;
    fn get_chapters(&self, path: &Path) -> Result<Vec<Chapter>>;
    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> Result<String>;
}

pub struct FormatRegistry { … }
```

- **新增格式只需实现 trait + 注册到 FormatRegistry**，零修改现有代码
- 注册表按文件扩展名匹配解析器

### 2.2 EPUB 解析 (`book/epub.rs`)

- **库**: `epub` crate v2.1.5
- **元数据**: `doc.mdata("title")`, `doc.mdata("creator")` → `MetadataItem.value`
- **封面**: `doc.get_cover()` → `Option<(Vec<u8>, String)>`，按 MIME 推断扩展名写入磁盘
- **章节目录**: `doc.spine` (Vec\<SpineItem\>)，遍历提取 `SpineItem.idref`
- **章节内容**: `doc.get_resource(&spine_id)` → HTML 原文

### 2.3 TXT 解析 (`book/txt.rs`)

- **编码检测**: `encoding_rs::Encoding::for_bom()` → 无 BOM 时 GBK 优先，失败回退 UTF-8
- **分章算法**:
  - 5 种正则模式：`第X章/节/回/卷`、`Chapter X`、`Part X`、`序章/楔子/尾声/番外`、`第X卷/篇`
  - 按位置排序去重 → 非重叠匹配构建章节
  - 无匹配时生成单章 "正文"
- **章节渲染**: HTML `<pre>` 包裹，`html-escape` 转义

### 2.4 PDF 解析 (`book/pdf.rs`)

- MVP 阶段仅提取文件名作为标题
- 单章 "正文" 占位，正文由前端 pdf.js 渲染

### 2.5 Tauri Commands (`src/commands.rs`)

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `import_book` | `file_path: String` | `ImportResult` | 检测格式→解析→写DB→提取封面→写章节 |
| `list_books` | — | `Vec<BookListItem>` | 按 updated_at 降序 |
| `delete_book` | `id: String` | `()` | 级联删除章节/进度/书签/笔记 |
| `get_chapter_content` | `book_id, chapter_index` | `String` | 读取章节 HTML |

### 2.6 数据库查询 (`db/queries.rs`)

- `list_books` / `get_book` / `insert_book` / `delete_book` / `book_exists_by_path`
- `set_setting` / `get_setting` (键值存储)
- `BookListItem` 类型：仅向前端暴露必要字段

---

## 3. 前端架构

### 3.1 新增依赖

| 包 | 版本 | 用途 |
|----|------|------|
| react-router-dom | 7.15.1 | 路由 |
| zustand | 5.0.13 | 状态管理 |
| @tauri-apps/plugin-dialog | 2.7.1 | 文件选择器 |

### 3.2 组件树

```
App.tsx
└── BrowserRouter
    └── Routes
        └── BookshelfPage
            ├── Header (搜索框 + 视图切换 + 导入按钮)
            ├── BookCard[] (网格视图)
            ├── 列表行 (列表视图)
            ├── 空状态
            └── ImportDialog (模态)
```

### 3.3 Zustand Store (`stores/bookStore.ts`)

```typescript
interface BookState {
  books: BookItem[];
  loading: boolean;
  viewMode: "grid" | "list";
  loadBooks: () => Promise<void>;
  importBook: (filePath: string) => Promise<ImportResult>;
  deleteBook: (id: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
}
```

### 3.4 UI 特性

- **网格视图**: 2-6 列响应式 (sm:3 md:4 lg:5 xl:6)
- **列表视图**: 单列紧凑行，格式缩写 + 标题 + 作者 + 删除
- **封面显示**: `convertFileSrc()` → Tauri asset protocol 加载本地图片；无封面时渐变占位符
- **格式徽标**: EPUB=蓝 BookOpen, TXT=绿 FileText, PDF=红 FileType
- **hover 删除**: BookCard 右上角垃圾图标，opacity 过渡
- **搜索**: 实时过滤书名+作者，带清除按钮
- **空状态**: 书架为空时引导导入

---

## 4. 验证结果

| 检查项 | 结果 |
|--------|------|
| `cargo check` | ✅ 零错误零警告 |
| `cargo test` | ✅ pass |
| `cargo clippy` | ✅ 无诊断 |
| `tsc --noEmit` | ✅ 类型检查通过 |
| ESLint | ✅ 0 errors |
| `vite build` | ✅ 1780 modules → 274KB JS + 15KB CSS |
| `tauri build` | ✅ .exe + .msi + .nsis 生成 |

### 产物

| 文件 | 大小 |
|------|------|
| `xreader.exe` | release 优化编译 |
| `XReader_0.1.0_x64_en-US.msi` | WiX 打包 |
| `XReader_0.1.0_x64-setup.exe` | NSIS 打包 |

---

## 5. 新增/修改文件清单

### 新增 (10 文件)

```
src-tauri/src/book/epub.rs        EPUB 解析器 (110 行)
src-tauri/src/book/format.rs      BookFormat trait + FormatRegistry (80 行)
src-tauri/src/book/pdf.rs         PDF 解析器 (65 行)
src-tauri/src/book/txt.rs         TXT 解析器 + 编码检测 + 分章 (203 行)
src-tauri/src/commands.rs         Tauri IPC 命令 (168 行)
src/types/book.ts                 TS 类型定义
src/stores/bookStore.ts           Zustand 状态管理
src/components/bookshelf/BookCard.tsx    书架卡片
src/components/bookshelf/ImportDialog.tsx 导入对话框
src/pages/BookshelfPage.tsx       书架页面
```

### 修改 (8 文件)

```
src-tauri/src/lib.rs              注册 commands + dialog plugin
src-tauri/src/book/mod.rs         导出所有格式 + create_registry()
src-tauri/src/db/mod.rs           pub mod → 公开子模块
src-tauri/src/db/queries.rs       完整 CRUD + BookListItem
src-tauri/Cargo.toml              新增 7 个 crate
src-tauri/capabilities/default.json  添加 dialog:default
src/App.tsx                       react-router-dom 路由
package.json                     新增依赖
```

---

## 6. 技术决策记录

1. **`anyhow::Result` 统一错误处理**：BookFormat trait 返回 `anyhow::Result<T>`，Tauri commands 层 `.map_err(|e| e.to_string())` 转换为前端友好的字符串错误
2. **TXT 无第三方编码检测**：仅用 `encoding_rs::Encoding::for_bom()` + GBK/UTF-8 双 fallback，不引入 `chardetng`（减少编译时间）
3. **PDF MVP 仅文件名**：完整 PDF 元数据解析需深入的 lopdf API 集成，推迟至 Phase 3（前端 pdf.js 渲染时一并处理）
4. **`SpineItem.idref.clone()` 绕过 borrow checker**：`get_resource(&mut self)` 需要可变借用，先 clone 出 `idref` 再调用
5. **`convertFileSrc()` 加载本地封面**：Tauri asset protocol 允许前端 `<img>` 直接加载文件系统路径
6. **章节写入 DB**：import 时同步写入 chapters 表，后续 Phase 3 阅读器可直接查询

---

## 7. 下一步：Phase 3 — 阅读器核心

预计工时 70-90h，核心任务：

- epub.js 集成与 React 组件封装
- pdf.js 集成与 PDF 基础阅读组件
- TXT 阅读器组件（分页渲染）
- 统一阅读器外壳：分页/滚动模式切换
- 字体/行距/页边距/主题设置面板
- 阅读进度记录与恢复
- 章节目录导航 (TOC)
- 交付：可完整阅读 EPUB、TXT 和 PDF 书籍
