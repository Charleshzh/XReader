# XReader - 桌面端小说阅读器 技术方案

## 1. 需求概述

| 维度 | 决策 |
|------|------|
| 目标平台 | Windows / macOS / Linux 桌面端 |
| 内容来源 | 本地文件导入 + 网络书源抓取（类 Legado/阅读 规则引擎） |
| 技术栈 | Tauri v2 + React + TypeScript |
| 核心功能 | 书架管理、阅读渲染、书签/笔记、书源抓取、跨设备云同步 |
| 项目定位 | 正式产品 MVP |

## 2. 竞品调研总结

### 2.1 开源方案

| 项目 | 平台 | 技术栈 | 亮点 | 不足 |
|------|------|--------|------|------|
| **Koodo Reader** | 桌面+Web | Electron + React + TypeScript | 格式支持全(EPUB/PDF/MOBI/AZW3)，高亮/笔记/主题齐全 | Electron 体积大(~120MB)，无书源抓取 |
| **Readest** | 全平台 | Tauri v2 + Next.js 15 | 最轻量桌面方案(~10MB)，分页/滚动/TTS，云同步 | 无书源抓取，侧重 EPUB/PDF |
| **Legado (阅读)** | Android | Kotlin + MVVM + Room | 最成熟的书源规则引擎，可自定义 XPath/CSS/JS 规则抓取任意网站 | 仅 Android，无桌面版 |
| **Foliate** | Linux/桌面 | GTK + foliate-js | 自研渲染引擎，分页精准 | GTK 绑定，跨平台性差 |
| **CoolReader** | 跨平台 | C++ | 格式支持广泛，轻量核心 | UI 老旧，无书源功能 |

### 2.2 商业方案

| 产品 | 模式 | 技术特点 |
|------|------|----------|
| 微信读书 | 社交+付费 | 微信生态登录，腾讯云版权库，AI 朗读 |
| 番茄小说 | 免费+广告 | 字节推荐引擎，精准广告投放，短剧联动 |
| Kindle | 付费电子书 | 封闭生态，Whispersync 同步 |

### 2.3 结论

- **桌面端缺少"本地阅读 + 书源抓取"结合的产品**：Koodo Reader/Readest 只做本地，Legado 只有移动端
- **最佳参考组合**：Readest 的 Tauri 架构 + Legado 的书源规则引擎 + Koodo Reader 的笔记/高亮 UX
- **差异化空间**：填补桌面端书源抓取阅读器的空白

## 3. 技术架构

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         React 18 + TypeScript               │
│  ┌──────────────────────────────────────┐   │
│  │  UI Components (Tailwind + shadcn/ui) │   │
│  │  ┌──────────┐ ┌──────────────────┐   │   │
│  │  │ 书架管理  │ │   阅读器视图      │   │   │
│  │  │ Bookshelf │ │   Reader View    │   │   │
│  │  └──────────┘ └──────────────────┘   │   │
│  │  ┌──────────┐ ┌──────────────────┐   │   │
│  │  │ 书源管理  │ │   设置/同步       │   │   │
│  │  │ Sources   │ │   Settings/Sync  │   │   │
│  │  └──────────┘ └──────────────────┘   │   │
│  └──────────────────────────────────────┘   │
│         Zustand (State Management)          │
│         epub.js (EPUB Rendering)            │
├─────────────────────────────────────────────┤
│              Tauri IPC Bridge                │
├─────────────────────────────────────────────┤
│                  Backend (Rust)              │
│  ┌──────────────┐ ┌────────────────────┐    │
│  │  Book Engine  │ │   Source Engine     │    │
│  │  - EPUB解析   │ │   - 规则引擎        │    │
│  │  - TXT解析    │ │   - HTTP爬虫        │    │
│  │  - 元数据提取  │ │   - HTML解析(CSS/XPath)│  │
│  │  - 封面生成   │ │   - 正文提取         │    │
│  └──────┬───────┘ └────────┬───────────┘    │
│         │                  │                │
│  ┌──────┴──────────────────┴───────────┐    │
│  │           Data Layer                 │    │
│  │  ┌──────────┐  ┌──────────────────┐ │    │
│  │  │  SQLite   │  │   File System    │ │    │
│  │  │ (rusqlite)│  │   (Tauri FS API) │ │    │
│  │  └──────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │          Sync Engine (optional)      │    │
│  │  - WebDAV / REST API                │    │
│  │  - 进度/书签/笔记/书源 增量同步        │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│            Tauri v2 Native Shell             │
│  (Windows: WebView2 / macOS: WKWebView)     │
└─────────────────────────────────────────────┘
```

## 4. 关键技术选型

### 4.1 前端

| 库 | 用途 | 理由 |
|----|------|------|
| React 18 + TypeScript | UI 框架 | 生态最丰富，与 Tauri 配合成熟 |
| Tailwind CSS | 样式 | 原子化 CSS，暗色/亮色主题切换方便 |
| shadcn/ui | UI 组件库 | 基于 Radix，可访问性好，可定制 |
| Zustand | 状态管理 | 轻量(1KB)，无 boilerplate，适合中等复杂度 |
| epub.js | EPUB 渲染 | 最成熟的浏览器端 EPUB 渲染库 |
| @tauri-apps/api | Tauri 桥接 | 官方前端 SDK |

### 4.2 后端 (Rust)

| Crate | 用途 | 理由 |
|-------|------|------|
| rusqlite (bundled) | 本地数据库 | 嵌入式，性能好，Tauri 官方推荐 |
| epub | EPUB 元数据解析 | 纯 Rust，提取目录/封面/元数据 |
| encoding_rs + chardetng | TXT 编码检测 | 中文小说 TXT 编码混乱(GBK/UTF-8/Big5) |
| scraper | CSS 选择器 HTML 解析 | 基于 html5ever，JSOUP Default 规则 (`class.*`, `id.*`, `tag.*`) |
| sxd-document + sxd-xpath | XPath 解析 | W3C XPath 1.0 支持 (`xpath.*` 规则) |
| jsonpath-rust | JSONPath 查询 | `json.*` 规则支持 |
| regex | 正则 | `regex.*` 规则 + replaceRegex 清洗 |
| rquickjs | 嵌入式 JS 引擎 | 执行 `js:` 规则、`@js:` 后缀提取、`{{ }}` 模板 |
| reqwest + cookie_store | HTTP 客户端 | 异步，支持 Cookie/代理/重定向/编码 |
| encoding_rs + chardetng | TXT 编码检测 + 网页编码处理 | 中文小说编码混乱 (GBK/UTF-8/Big5) |
| rusqlite (bundled) | 本地数据库 | 嵌入式，性能好 |
| epub | EPUB 元数据解析 | 纯 Rust，提取目录/封面/元数据 |
| serde + serde_json | 序列化 | 书源规则 JSON 格式与 Legado 兼容 |
| tokio | 异步运行时 | Tauri 默认异步后端 |
| url | URL 解析与拼接 | 相对路径处理 |
| uuid | ID 生成 | 书籍/章节/书签主键 |

### 4.3 为什么选 Tauri 而非其他

| 对比维度 | Tauri v2 | Electron | Flutter |
|----------|----------|----------|---------|
| 安装包体积 | 5-15MB | 80-150MB | 40-60MB |
| 内存占用 | 50-150MB | 300-600MB | 120-250MB |
| 冷启动 | 0.5-1秒 | 3-5秒 | 1-2秒 |
| Rust 后端 | 原生 | 无(Node.js) | 无(Dart) |
| 中文编码处理 | Rust(chardetng) | Node.js(iconv-lite) | Dart |
| WebView 兼容 | 系统自带 | 内置 Chromium | 自带 Skia |

> 选择 Tauri：阅读器是常驻应用，内存和启动速度很重要；Rust 处理文件解析和爬虫比 Node.js 更高效安全。

### 4.4 项目目录结构

```
xreader/
├── src-tauri/                  # Rust 后端 (Tauri)
│   ├── src/
│   │   ├── main.rs             # 入口，Tauri 命令注册
│   │   ├── lib.rs              # 库根
│   │   ├── book/               # 书籍引擎
│   │   │   ├── mod.rs
│   │   │   ├── format.rs       # BookFormat trait (可扩展接口)
│   │   │   ├── epub.rs         # EPUB 解析实现
│   │   │   ├── txt.rs          # TXT 解析实现
│   │   │   └── pdf.rs          # PDF 元数据提取
│   │   ├── source/             # 书源引擎
│   │   │   ├── mod.rs
│   │   │   ├── tokenizer.rs    # 规则分词器
│   │   │   ├── compiler.rs     # 规则编译器 → Rule AST
│   │   │   ├── evaluator/      # 求值器
│   │   │   │   ├── mod.rs
│   │   │   │   ├── css.rs      # CssEval
│   │   │   │   ├── xpath.rs    # XpathEval
│   │   │   │   ├── json.rs     # JsonEval
│   │   │   │   ├── regex.rs    # RegexEval
│   │   │   │   ├── js.rs       # JsEval (rquickjs)
│   │   │   │   └── template.rs # TmplEval ({{ }} / {$.})
│   │   │   ├── pipeline/       # 四大管线
│   │   │   │   ├── mod.rs
│   │   │   │   ├── search.rs
│   │   │   │   ├── book_info.rs
│   │   │   │   ├── chapter_list.rs
│   │   │   │   └── chapter_content.rs
│   │   │   └── http.rs         # HTTP 客户端封装
│   │   ├── db/                 # 数据层
│   │   │   ├── mod.rs
│   │   │   ├── migrations/     # SQL 迁移文件
│   │   │   ├── models.rs       # 数据模型
│   │   │   └── queries.rs      # 查询方法
│   │   ├── sync/               # 同步引擎
│   │   │   ├── mod.rs
│   │   │   └── webdav.rs
│   │   └── commands.rs         # Tauri IPC 命令集中定义
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                        # 前端 (React)
│   ├── main.tsx                # React 入口
│   ├── App.tsx                 # 根组件 + 路由
│   ├── components/             # 可复用 UI 组件
│   │   ├── ui/                 # shadcn/ui 组件
│   │   ├── reader/             # 阅读器组件
│   │   ├── bookshelf/          # 书架组件
│   │   ├── sources/            # 书源管理组件
│   │   └── settings/           # 设置组件
│   ├── pages/                  # 页面级组件
│   │   ├── BookshelfPage.tsx
│   │   ├── ReaderPage.tsx
│   │   ├── SourceManagePage.tsx
│   │   ├── DiscoverPage.tsx
│   │   ├── StatsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── stores/                 # Zustand 状态
│   │   ├── bookStore.ts
│   │   ├── readerStore.ts
│   │   ├── sourceStore.ts
│   │   └── settingsStore.ts
│   ├── hooks/                  # 自定义 hooks
│   ├── lib/                    # 工具函数
│   ├── types/                  # TypeScript 类型定义
│   └── styles/                 # 全局样式
├── tests/                      # 测试
│   ├── e2e/                    # Playwright E2E
│   └── fixtures/               # 测试 fixture (示例 EPUB/TXT)
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: build + lint + test
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

### 4.5 可扩展性架构设计

#### 4.5.1 书籍格式插件化

```rust
/// 所有书籍格式解析器必须实现此 trait
pub trait BookFormat: Send + Sync {
    /// 格式标识符: "epub", "txt", "pdf", "mobi"...
    fn format_name(&self) -> &'static str;
    /// 支持的扩展名列表
    fn extensions(&self) -> &[&str];
    /// 从文件路径解析元数据
    fn parse_metadata(&self, path: &Path) -> Result<BookMeta>;
    /// 提取封面图片路径
    fn extract_cover(&self, path: &Path, output_dir: &Path) -> Result<Option<PathBuf>>;
    /// 获取章节列表
    fn get_chapters(&self, path: &Path) -> Result<Vec<Chapter>>;
    /// 读取章节内容为 HTML
    fn read_chapter(&self, path: &Path, chapter: &Chapter) -> Result<String>;
}

/// 注册表：启动时收集所有已注册的格式解析器
pub struct FormatRegistry {
    formats: HashMap<String, Box<dyn BookFormat>>,
}
```

新增格式只需：1) 实现 `BookFormat` trait；2) 在 `FormatRegistry` 注册。无需修改任何现有代码。

#### 4.5.2 前端组件分层

```
Page (路由页面)
  └── Feature (功能容器: 数据加载 + 状态管理)
       └── UI Component (纯展示: 接收 props，触发回调)
```

- **Page 层**：只做路由和布局，不含业务逻辑
- **Feature 层**：通过 hooks 连接 Rust 后端，管理加载/空/错误状态
- **UI Component 层**：纯函数组件，仅依赖 props，可独立 Storybook 开发

#### 4.5.3 同步后端可替换

```rust
pub trait SyncBackend: Send + Sync {
    async fn upload(&self, key: &str, data: &[u8]) -> Result<()>;
    async fn download(&self, key: &str) -> Result<Vec<u8>>;
    async fn list(&self, prefix: &str) -> Result<Vec<SyncEntry>>;
}
```

默认实现 WebDAV；后期可增加 S3/OneDrive/自定义 REST。

#### 4.5.4 数据库迁移策略

使用 Rust 的 `refinery` crate 进行版本化 SQL 迁移：

```
src-tauri/src/db/migrations/
├── V1__initial_schema.sql
├── V2__add_reading_stats.sql
├── V3__add_tags.sql
└── ...
```

每次 schema 变更创建一个新迁移文件，应用启动时自动执行未应用的迁移。

## 5. 数据模型设计

### 5.1 SQLite 表结构

```sql
-- 书籍
CREATE TABLE books (
    id TEXT PRIMARY KEY,          -- UUID
    title TEXT NOT NULL,
    author TEXT,
    cover_path TEXT,              -- 本地封面路径
    file_path TEXT,               -- 源文件路径
    format TEXT,                  -- epub/txt/pdf
    source_type TEXT,             -- local/remote
    source_id TEXT,               -- 书源ID(远程书)
    source_url TEXT,              -- 书籍详情页URL
    total_chapters INTEGER,
    created_at INTEGER,
    updated_at INTEGER
);

-- 章节 (远程书籍的目录缓存)
CREATE TABLE chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    index_num INTEGER NOT NULL,
    title TEXT,
    url TEXT,                     -- 远程地址
    content_path TEXT,            -- 本地缓存路径
    word_count INTEGER,
    fetched INTEGER DEFAULT 0,    -- 是否已抓取
    UNIQUE(book_id, index_num)
);

-- 阅读进度
CREATE TABLE reading_progress (
    book_id TEXT PRIMARY KEY REFERENCES books(id),
    chapter_index INTEGER,
    position REAL,                -- 章节内位置(0.0-1.0)
    updated_at INTEGER
);

-- 书签
CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    chapter_index INTEGER,
    position REAL,
    label TEXT,
    created_at INTEGER
);

-- 笔记/高亮
CREATE TABLE annotations (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    chapter_index INTEGER,
    start_position REAL,
    end_position REAL,
    text TEXT,                    -- 选中的文本
    note TEXT,                    -- 用户笔记
    color TEXT DEFAULT 'yellow',  -- 高亮颜色
    created_at INTEGER,
    updated_at INTEGER
);

-- 书源规则
CREATE TABLE book_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    rule_json TEXT NOT NULL,      -- 完整规则 JSON (兼容 Legado 格式)
    created_at INTEGER,
    updated_at INTEGER
);

-- 同步元数据
CREATE TABLE sync_meta (
    table_name TEXT PRIMARY KEY,
    last_synced_at INTEGER,
    version INTEGER DEFAULT 0
);

-- 阅读统计
CREATE TABLE reading_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL REFERENCES books(id),
    date TEXT NOT NULL,           -- YYYY-MM-DD
    read_seconds INTEGER DEFAULT 0,
    read_words INTEGER DEFAULT 0,
    UNIQUE(book_id, date)
);

-- 应用设置 (键值对，替代 Tauri store plugin)
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### 5.2 书源规则 JSON 格式 (兼容 Legado)

```json
```json
{
  "bookSourceUrl": "https://www.example-novel.com",
  "bookSourceName": "示例书源",
  "bookSourceGroup": "示例分组",
  "bookSourceType": 0,
  "enabled": true,
  "enabledExplore": true,
  "weight": 0,
  "header": {"User-Agent": "Mozilla/5.0 ..."},
  "loginUrl": "",
  "loginCheckJs": "",

  "ruleSearch": {
    "searchUrl": "https://example.com/search?keyword={{key}}&page={{page}}",
    "bookList": "class.result-item",
    "name": "class.title@tag.a@text",
    "author": "class.author@text",
    "coverUrl": "class.cover@tag.img@src",
    "intro": "class.desc@text",
    "kind": "class.category@text",
    "wordCount": "class.wordcount@text",
    "lastChapter": "class.update@tag.a@text",
    "bookUrl": "class.title@tag.a@href"
  },

  "ruleExplore": {
    "exploreUrl": "https://example.com/rank?page={{page}}",
    "bookList": "$.data.books[*]",
    "name": "$.title",
    "author": "$.author",
    "coverUrl": "$.cover",
    "bookUrl": "/book/{{$.id}}"
  },

  "ruleBookInfo": {
    "name": "tag.h1@text",
    "author": "class.author@text",
    "coverUrl": "class.cover@tag.img@src",
    "intro": "class.desc@text",
    "kind": "class.category@text",
    "wordCount": "class.wordcount@text",
    "lastChapter": "class.update@tag.a@text",
    "tocUrl": "class.toc@tag.a@href"
  },

  "ruleToc": {
    "chapterList": "class.chapter-list@tag.li",
    "chapterName": "tag.a@text",
    "chapterUrl": "tag.a@href",
    "nextTocUrl": "class.next@tag.a@href"
  },

  "ruleContent": {
    "content": "id.content@html",
    "nextContentUrl": "class.next@tag.a@href",
    "replaceRegex": [
      {"regex": "请收藏本站.*", "replacement": ""},
      {"regex": "&nbsp;", "replacement": " "}
    ],
    "imageStyle": "FULL"
  }
}
```

> 上述 JSON 结构与 Legado 官方格式 **完全一致**，可直接导入 .txt/.json 格式书源文件。

## 6. 核心模块设计

### 6.1 书架管理
- 导入：本地文件选择器 (Tauri dialog) + 拖拽导入
- 分类：标签系统(用户自定义标签)
- 搜索：按标题/作者全文搜索
- 封面：EPUB 提取内置封面，TXT 自动生成(标题+作者)
- 视图：网格/列表切换

### 6.2 阅读渲染
- **EPUB**: 后端解压提取章节 HTML，前端 epub.js 渲染
  - 分页模式(左右翻页) + 滚动模式
  - 字体大小/行距/边距可调
  - 6 种预设主题(白/米黄/灰/黑/护眼绿/自定义)
- **TXT**: 后端按章节标题自动分章，编码检测后传文本到前端渲染
  - 正则匹配章节标题模式("第X章", "Chapter X", "X.", etc.)
- **PDF**: 使用 pdf.js 在 WebView 中渲染，支持缩放和页面导航
  - MVP 支持基础阅读（翻页/缩放），高级标注推迟到后期
- **扩展性**: 所有格式通过统一的 `BookFormat` trait 接入，新增格式只需实现 trait 即可

### 6.3 书签/笔记/高亮
- 书签：记录(chapter_index, position)，可命名
- 高亮：选区 start/end position，颜色标记
- 笔记：附加在高亮上的文本备注
- 导出：支持导出为 JSON/Markdown

### 6.4 书源规则引擎 — 与 Legado 100% 互通 [核心模块]

#### 6.4.1 兼容性承诺

**书源 JSON 文件可直接从 Legado 导出后导入 XReader，反之亦然。** 不支持任何私有扩展字段，所有规则字符串严格遵循 Legado 语法。

#### 6.4.2 Legado 规则语法完整参考

Legado 规则使用自定义 DSL，以 `@` 为分隔符、`.` 为选择器层级链：

**规则结构**：`段1@段2@...@提取属性`

每条段是三部分：`类型.值.索引`（索引从 0 开始，可省略）

| 类型 | 语法示例 | 说明 |
|------|----------|------|
| `class` | `class.title.0` | 按 class 名选取，索引指第 N 个匹配 |
| `id` | `id.content` | 按 id 选取 |
| `tag` | `tag.a.1` | 按标签名选取 |
| `text` | `text.下一章` | 按文本内容匹配选取 |
| `children` | `children` | 选取所有直接子元素，无需后续段 |
| `css` | `css.div.content>p` | 标准 CSS 选择器 |
| `xpath` | `xpath.//div[@class='content']` | 标准 W3C XPath 1.0 |
| `js` | `js.document.querySelector('.content').innerHTML` | JavaScript 表达式 |
| `regex` | `regex.第(\\d+)章.0` | 正则表达式匹配 |
| `json` | `json.$.data.books[*]` | JSONPath 表达式 |

**提取属性**（`@` 最后一段指定取什么）：

| 属性 | 说明 |
|------|------|
| `text` | 元素文本内容 |
| `textNodes` | 纯文本节点 |
| `ownText` | 仅直属文本，不含子元素文本 |
| `href` | `<a>` 链接地址 |
| `src` | `<img>/<source>` 资源地址 |
| `html` | 内部 HTML |
| `all` | 外部 HTML（含当前标签） |

**组合运算符**：

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `\|\|` | 备选规则（左侧失败走右侧） | `class.title@text\|\|tag.h1@text` |
| `##` | 注释分隔符（后面为说明文本） | `##全文阅读` |
| `{{ }}` | URL 模板变量 | `{{key}}`, `{{page}}` |
| `{$. }` | 跨步骤 JSONPath 变量 | `{$.bookId}`, `{$.tocUrl}` |

**完整示例**：`class.odd.0@tag.a.0@text||tag.dd.0@tag.h1@text##书名`

解读：先尝试取第1个 `class=odd` 元素下的第1个 `<a>` 的文本，失败则取第1个 `<dd>` 下的第1个 `<h1>` 的文本。

#### 6.4.3 Rust 端规则引擎架构

参考实现：[LegadoParser](https://github.com/821938089/LegadoParser) (Python, 54⭐)，完整支持 Legado 规则语法。我们将用 Rust 重新实现其核心逻辑。

```
┌──────────────────────────────────────────────┐
│              RuleEngine (Rust)                │
│                                               │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Tokenizer    │  │  RuleCompiler         │  │
│  │  - @ 分割     │  │  - 编译规则字符串      │  │
│  │  - || 分割    │  │  - 生成 Rule AST       │  │
│  │  - ## 分割    │  │  - 缓存编译结果        │  │
│  └──────┬───────┘  └──────────┬───────────┘  │
│         │                     │              │
│  ┌──────┴─────────────────────┴──────────┐   │
│  │           RuleEvaluator                │   │
│  │  ┌──────────┐ ┌────────┐ ┌─────────┐  │   │
│  │  │ CssEval   │ │XpathEv │ │RegexEv  │  │   │
│  │  │ (scraper) │ │(sxd)   │ │(regex)  │  │   │
│  │  └──────────┘ └────────┘ └─────────┘  │   │
│  │  ┌──────────┐ ┌────────┐ ┌─────────┐  │   │
│  │  │ JsonEval  │ │ JsEval │ │TmplEv   │  │   │
│  │  │(jsonpath) │ │(rquick)│ │(变量替换)│  │   │
│  │  └──────────┘ └────────┘ └─────────┘  │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │       SourcePipeline (四大管线)        │   │
│  │  1.Search → 2.BookInfo →              │   │
│  │  3.ChapterList → 4.ChapterContent     │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

#### 6.4.4 四大管线 API

**搜索管线**：
```
source.search("剑来", page=1)
  → 渲染 searchUrl 模板
  → HTTP GET → HTML
  → bookList 规则 + 各字段规则 → Vec<SearchResult>
```

**详情管线**：
```
source.get_book_info(book_url, vars)
  → HTTP GET → HTML
  → name/author/coverUrl/intro/kind/wordCount/tocUrl
  → BookInfo { toc_url }
```

**目录管线**：
```
source.get_chapter_list(toc_url, vars)
  → HTTP GET → HTML
  → chapterList → chapterName/chapterUrl
  → Vec<Chapter>
```

**正文管线**：
```
source.get_content(chapter_url, vars)
  → HTTP GET → HTML
  → content 规则 + replaceRegex 清洗
  → String (清洗后 HTML)
```

#### 6.4.5 规则支持矩阵

| 功能 | MVP | 说明 |
|------|-----|------|
| `class`/`id`/`tag`/`text`/`children` | ✅ | JSOUP Default 规则 |
| `css` CSS选择器 | ✅ | 通过 scraper crate |
| `xpath` XPath 1.0 | ✅ | 通过 sxd-xpath |
| `json` JSONPath | ✅ | 通过 jsonpath-rust |
| `regex` 正则 | ✅ | 通过 regex crate |
| `js:` 前缀 JS 规则 | ✅ | 通过 rquickjs (QuickJS) |
| `\|\|` 备选规则 | ✅ | 核心语法 |
| `{{key}}` / `{{page}}` 模板 | ✅ | URL 变量替换 |
| `{$.field}` 跨步骤变量 | ✅ | JSONPath 上下文传递 |
| `replaceRegex` 清洗 | ✅ | 正文去广告 |
| `@js:` 后缀 JS 提取 | ⚠️ | rquickjs 安全沙箱限制，部分复杂 JS 可能失败 |
| `webJs` (页面JS渲染) | ❌ | 需要 headless browser，推迟 |
| `loginUi` 登录 | ❌ | 推迟 |

#### 6.4.6 章节缓存策略

- 远程章节内容抓取后缓存到本地磁盘（`chapters.content_path`）
- 打开阅读器时预加载当前章节 ± 前后各 2 章
- 缓存有效期 24 小时，过期自动重新抓取
- 支持手动刷新全部章节

### 6.5 阅读统计 (MVP 包含)
- **阅读时长**: 记录每次会话的阅读时间，支持按日/周/月汇总
- **阅读字数**: 结合进度变化估算已读字数
- **阅读目标**: 用户可设定每日阅读时长或字数目标
- **书架统计**: 总书籍数、已读完数、阅读中数
- 数据存储在 SQLite，通过 Tauri IPC 暴露给前端图表展示

### 6.6 跨设备云同步 (MVP 阶段可选)
- 方式1: WebDAV 协议(用户自建，如坚果云/Nextcloud)
- 方式2: 本地文件夹同步(如 Dropbox/iCloud 目录)
- 同步内容: 书架元数据、阅读进度、书签、笔记、书源规则
- 策略: 基于时间戳的增量同步，冲突取最新


## 6A. 开发工作流

### 6A.1 Git 工作流 (GitHub Flow)

```
main ──────────────────────────────────────────→ (稳定，可发布)
  │
  ├── feat/bookshelf-import ──→ PR ──→ merge
  ├── feat/reader-core     ──→ PR ──→ merge
  ├── feat/source-engine   ──→ PR ──→ merge
  └── fix/encoding-bug     ──→ PR ──→ merge
```

- **分支命名**: `feat/<功能>`, `fix/<问题>`, `chore/<杂项>`, `docs/<文档>`
- **Commit 规范**: [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` 新功能
  - `fix:` 修复
  - `refactor:` 重构
  - `test:` 测试
  - `docs:` 文档
  - `chore:` 构建/工具
- **每个 Phase 至少一个 PR**，合并前需通过 CI 检查
- `main` 分支保护：禁止直接推送，必须通过 PR

### 6A.2 测试策略

| 层级 | 工具 | 覆盖范围 | 运行频率 |
|------|------|----------|----------|
| Rust 单元测试 | `cargo test` | Tokenizer, RuleEvaluator, BookFormat, DB queries | 每次提交 |
| 前端组件测试 | Vitest + React Testing Library | UI 组件的渲染和交互逻辑 | 每次提交 |
| E2E 冒烟测试 | Playwright | 启动→导入→打开→阅读 核心路径 | PR / 每日 |

测试 fixture: `tests/fixtures/` 目录存放示例 EPUB/TXT/PDF 文件。

### 6A.3 CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo test
      - run: cargo clippy -- -D warnings
      - run: cargo fmt --check

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  e2e:
    runs-on: ubuntu-latest
    needs: [rust, frontend]
    steps:
      - run: pnpm test:e2e  # Playwright
```

## 7. 实施计划

### Phase 1: 基础架构搭建 (1-2周)
- `git init` + `.gitignore` (Rust/Node 模板) + 首次 commit
- Tauri v2 项目脚手架 (`pnpm create tauri-app`)
- React + TypeScript + Tailwind + shadcn/ui 配置
- ESLint + Prettier 配置
- SQLite 数据库初始化 + `refinery` 迁移框架
- 基础 Tauri IPC 通信框架 (`commands.rs`)
- `.github/workflows/ci.yml` 初始配置
- **交付**: 可启动的空白应用，数据库就绪，CI 通过

### Phase 2: 本地书籍导入与书架 (2-3周)
- 文件系统扫描/导入 (EPUB/TXT/PDF)
- EPUB/PDF 元数据解析 (Rust epub crate + 基础 PDF 元数据提取)
- TXT 编码检测与分章 (encoding_rs + 正则)
- 书架 UI (网格/列表视图、排序、搜索)
- 封面显示 (EPUB 内置封面 / TXT/PDF 自动生成)
- **交付**: 可导入本地书籍并展示书架

### Phase 3: 阅读器核心 (4-5周)
- epub.js 集成与 React 组件封装
- TXT 阅读器组件
- pdf.js 集成与 PDF 基础阅读组件 (翻页/缩放)
- 统一阅读器外壳：分页/滚动模式切换
- 字体/行距/页边距/主题设置面板
- 阅读进度记录与恢复
- 章节目录导航 (TOC)
- **交付**: 可完整阅读 EPUB、TXT 和 PDF 书籍

### Phase 4: 书签/笔记 + 阅读统计 (2-3周)
- 书签添加/管理 UI
- 文本选择与高亮 (EPUB/TXT)
- 笔记编辑面板
- 书签/笔记列表与跳转、导出为 JSON/Markdown
- 阅读时长追踪 (会话计时 + 日/周/月汇总)
- 阅读字数统计与每日目标
- 统计图表展示 (recharts 或 chart.js)
- **交付**: 完整的标注系统 + 阅读统计面板

### Phase 5: 书源规则引擎 (4-6周) — 最核心、最复杂的模块

**5a: Tokenizer + RuleCompiler (1-2周)**
- 实现 `@` / `||` / `##` 分割器
- 实现 `类型.值.索引` 解析器 → RuleSegment AST
- 编译缓存（书源 JSON → CompiledSource，避免重复解析）
- 单元测试覆盖所有规则类型
- **交付**: 可正确解析所有 Legado 标准规则字符串

**5b: RuleEvaluator 六大求值器 (2-3周)**
- CssEval: 对接 scraper crate，支持 `class.*`, `id.*`, `tag.*`, `text.*`, `children`, `css.*`
- XpathEval: 对接 sxd-xpath，支持 `xpath.*`
- JsonEval: 对接 jsonpath-rust，支持 `json.*`
- RegexEval: 对接 regex crate，支持 `regex.*` 及 replaceRegex
- JsEval: 对接 rquickjs (QuickJS)，支持 `js:` 前缀和 `@js:` 后缀
- TmplEval: URL 模板 `{{key}}`/`{{page}}` 替换 + `{$.field}` 上下文变量
- **交付**: 所有规则类型可通过单元测试求值

**5c: SourcePipeline 四大管线 (1周)**
- Search 管线：搜索 → bookList → 字段提取 → Vec<SearchResult>
- BookInfo 管线：访问详情页 → 字段提取 → BookInfo { tocUrl }
- ChapterList 管线：访问目录页 → 章节列表提取 → Vec<Chapter>
- ChapterContent 管线：访问章节页 → 正文提取 + 清洗 → String
- 管线集成测试（用真实书源 + 本地 HTML fixture）
- **交付**: 完整的搜索→详情→目录→正文流程可运行

**5d: 书源管理 UI + 发现页 (1周)**
- 书源导入/导出（Legado 格式 .txt/.json，URL 导入）
- 书源启用/禁用、分组、排序
- 发现页（ruleExplore 驱动）
- 书源规则测试工具（搜索预览）
- **交付**: 完整的书源管理体验

### Phase 6: 云同步 (1-2周, 可选)
- WebDAV 客户端实现
- 增量同步逻辑
- 冲突处理策略
- 同步状态 UI

### Phase 7: 打磨与发布 (1-2周)
- 性能优化 (章节预加载、虚拟列表)
- 错误处理与日志
- 打包配置 (Windows MSI/macOS DMG/Linux AppImage)
- 自动更新机制

### Phase 8: 后续迭代 (Post-MVP)
- TTS 语音朗读 (系统 TTS API + 离线引擎探索)
- MOBI / AZW3 / FB2 格式支持
- 词典/翻译集成
- 书源规则市场 (社区分享书源)
- 移动端适配 (Tauri mobile 成熟后)

## 8. 可行性评估

### 8.1 技术可行性: ✅ 高

所有核心技术都有成熟的开源方案：

| 模块 | 风险等级 | 说明 |
|------|----------|------|
| Tauri + React 基础 | 低 | Tauri v2 稳定，文档完善 |
| EPUB 解析与渲染 | 低 | epub.js 成熟，Rust epub crate 稳定 |
| TXT 处理 | 低 | encoding_rs 是 Firefox 用的编码库 |
| 书源规则引擎 | 中 | 核心难度在规则解析器，Legado 有完整参考实现 |
| 跨设备同步 | 低-中 | WebDAV 协议简单，增量同步有成熟模式 |

### 8.2 难度评估

| 模块 | 难度 | 关键挑战 |
|------|------|----------|
| 基础架构 + Git/CI | ⭐⭐ | Tauri + React + SQLite + CI 配置 |
| 书架管理 (含 PDF 导入) | ⭐⭐ | 三格式文件导入 UX |
| 阅读器渲染 (含 PDF) | ⭐⭐⭐ | EPUB/TXT/PDF 三格式统一渲染，分页精度 |
| 书签/笔记/统计 | ⭐⭐ | 数据模型 + 图表展示 |
| Tokenizer + RuleCompiler | ⭐⭐⭐ | 自定义 DSL 解析器 |
| RuleEvaluator (6种求值) | ⭐⭐⭐⭐ | CSS/XPath/JS/Regex/JSONPath 多引擎集成 |
| SourcePipeline (4大管线) | ⭐⭐⭐ | 管线状态管理、错误处理 |
| 书源管理 UI | ⭐⭐ | 导入/导出 UX |
| 云同步 | ⭐⭐⭐ | 冲突处理 |

### 8.3 成本估算

| 阶段 | 预估工时 | 备注 |
|------|----------|------|
| Phase 1 基础架构 + Git/CI | 25-35h | |
| Phase 2 书架 (含 PDF 导入) | 25-35h | |
| Phase 3 阅读器 (含 PDF) | 70-90h | EPUB+TXT+PDF 三格式渲染 |
| Phase 4 标注 + 阅读统计 | 30-50h | |
| Phase 5a Tokenizer+Compiler | 20-30h | |
| Phase 5b RuleEvaluator | 40-60h | 最核心模块 |
| Phase 5c SourcePipeline | 15-25h | |
| Phase 5d 书源管理 UI | 15-25h | |
| Phase 6 云同步 | 20-40h | |
| Phase 7 打磨发布 | 20-40h | |
| **Phase 1-7 总计** | **280-430h** | 全职约 3-4 个月 |
| Phase 8 后续迭代 | 80-120h | TTS + MOBI等格式 + 词典 + 移动端 |

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| epub.js 项目维护不活跃 | 中 | 高 | 评估 foliate-js 作为备选，或自研轻量渲染 |
| rquickjs 无法执行复杂 JS 规则 | 中 | 高 | LegadoParser 已验证大部分规则可用；复杂规则降级提示用户 |
| 书源网站反爬升级 | 高 | 中 | 支持 Cookie/代理/UA 轮换；规则引擎灵活可配 |
| Legado JSON schema 版本变更 | 低 | 中 | 遵循当前最新 schema（v3），解析时忽略未知字段保持向后兼容 |
| Tauri 移动端支持不成熟 | - | - | MVP 仅桌面端，不涉及 |
| WebView 兼容性问题 | 低 | 中 | 测试 Windows WebView2 / macOS WKWebView / Linux WebKitGTK |
| 编码检测失败导致乱码 | 中 | 低 | chardetng 检测 + 用户手动指定编码回退 |

## 10. 验证方案

每阶段完成后验证：

1. `cargo build` 编译通过 (Rust)
2. `pnpm build` 前端构建通过
3. `cargo tauri dev` 启动无崩溃
4. 手动测试该阶段所有功能路径
5. 导入 2-3 本不同格式书籍测试
6. 添加 1-2 个真实书源测试抓取流程
7. Phase 5 专项：导入 Legado 社区现有书源 JSON 文件，验证搜索/详情/目录/正文全流程通过
