# Phase 1 完成报告：基础架构搭建

**日期**: 2026-05-22  
**分支**: `main` (首次提交 `b6de97a`)  
**状态**: ✅ 全部 8 项任务完成

---

## 1. 交付清单

| #   | 任务                                      | 状态 |
| --- | ----------------------------------------- | ---- |
| 1   | Git init + .gitignore                     | ✅   |
| 2   | Tauri v2 项目脚手架                       | ✅   |
| 3   | React + TypeScript + Tailwind + shadcn/ui | ✅   |
| 4   | ESLint + Prettier 配置                    | ✅   |
| 5   | SQLite 数据库初始化 + refinery 迁移框架   | ✅   |
| 6   | 基础 Tauri IPC 通信框架                   | ✅   |
| 7   | `.github/workflows/ci.yml`                | ✅   |
| 8   | 验证：应用可启动 + CI 通过                | ✅   |

---

## 2. 技术栈确认

| 层级      | 技术                      | 版本            |
| --------- | ------------------------- | --------------- |
| 桌面框架  | Tauri                     | v2.11.2         |
| UI 框架   | React                     | 19.2.6          |
| 语言      | TypeScript                | 5.8.3           |
| 构建工具  | Vite                      | 7.3.3           |
| 样式      | Tailwind CSS              | 3.4.19          |
| 组件库    | shadcn/ui                 | (Button 已就绪) |
| 包管理    | pnpm                      | 11.2.2          |
| 代码规范  | ESLint 9 + Prettier 3     | —               |
| 数据库    | SQLite (rusqlite bundled) | 0.32.1          |
| 迁移框架  | refinery                  | 0.8.16          |
| Rust 异步 | tokio                     | 1.52.3          |

---

## 3. 项目结构

```
xreader/
├── .github/workflows/ci.yml          # CI: Rust check/test/lint + Frontend tsc/eslint/prettier
├── docs/
│   └── phase-1-completion.md         # 本文档
├── src/                              # React 前端
│   ├── main.tsx                      # 入口
│   ├── App.tsx                       # 根组件 (Tailwind 背景)
│   ├── globals.css                   # Tailwind 指令 + shadcn CSS 变量 (亮色/暗色)
│   ├── lib/utils.ts                  # cn() 工具
│   └── components/ui/button.tsx      # shadcn Button (cva variants)
├── src-tauri/                        # Rust 后端
│   ├── src/
│   │   ├── main.rs                   # Windows 子系统入口
│   │   ├── lib.rs                    # AppState (Mutex<Connection>) + greet/get_app_version
│   │   ├── db/
│   │   │   ├── mod.rs                # init(): 创建 SQLite + WAL + refinery migrations
│   │   │   ├── models.rs             # 10 个数据模型 (Book, Chapter, Bookmark, Annotation…)
│   │   │   ├── queries.rs            # list_books, set_setting, get_setting
│   │   │   └── migrations/
│   │   │       └── V1__initial_schema.sql  # 9 张表，含外键约束和唯一索引
│   │   ├── book/mod.rs               # Phase 2 占位 — BookFormat trait
│   │   ├── source/mod.rs             # Phase 5 占位 — 书源规则引擎
│   │   └── sync/mod.rs               # Phase 6 占位 — 跨设备同步
│   ├── Cargo.toml                    # 依赖：rusqlite, refinery, uuid, tokio, directories…
│   └── tauri.conf.json               # 窗口 1200×800, identifier: com.xreader.desktop
├── package.json                      # pnpm scripts: dev, build, lint, format, tauri
├── pnpm-workspace.yaml               # esbuild build 已允许
├── eslint.config.js                  # ESLint 9 flat config (tseslint + react-hooks + prettier)
├── .prettierrc                       # Prettier 配置
├── tsconfig.json                     # 路径别名 @/ → src/
├── vite.config.ts                    # 路径别名 + Tauri HMR 配置
├── tailwind.config.js                # shadcn 主题色变量
├── postcss.config.js                 # Tailwind + Autoprefixer
└── components.json                   # shadcn/ui 配置 (baseColor: slate, cssVariables: true)
```

---

## 4. 数据库 Schema (V1)

| 表名               | 用途       | 关键列                                                     |
| ------------------ | ---------- | ---------------------------------------------------------- |
| `books`            | 书籍元数据 | id(PK), title, author, format, source_type, file_path      |
| `chapters`         | 章节目录   | id(PK), book_id(FK), index_num, url, content_path, fetched |
| `reading_progress` | 阅读进度   | book_id(PK/FK), chapter_index, position, updated_at        |
| `bookmarks`        | 书签       | id(PK), book_id(FK), chapter_index, position, label        |
| `annotations`      | 笔记/高亮  | id(PK), book_id(FK), text, note, color                     |
| `book_sources`     | 书源规则   | id(PK), name, base_url, rule_json (Legado 兼容)            |
| `sync_meta`        | 同步元数据 | table_name(PK), last_synced_at, version                    |
| `reading_stats`    | 阅读统计   | id(PK), book_id(FK), date, read_seconds, read_words        |
| `app_settings`     | 应用设置   | key(PK), value                                             |

---

## 5. 验证结果

### 5.1 编译与构建

| 命令                          | 结果                               |
| ----------------------------- | ---------------------------------- |
| `cargo check`                 | ✅ 零错误，零警告                  |
| `cargo test`                  | ✅ 3 suites passed                 |
| `cargo clippy -- -D warnings` | ✅ 无诊断                          |
| `cargo fmt --check`           | ✅ 格式正确                        |
| `tsc --noEmit`                | ✅ 类型检查通过                    |
| `vite build`                  | ✅ 29 modules → 194KB JS + 8KB CSS |
| `tauri build`                 | ✅ 生成 .exe + .msi + .nsis 安装包 |

### 5.2 代码规范

| 工具     | 结果                                                  |
| -------- | ----------------------------------------------------- |
| ESLint   | ✅ 0 errors, 1 warning (shadcn 预期的 re-export 警告) |
| Prettier | ✅ 5/5 files formatted correctly                      |

### 5.3 产物

| 文件        | 路径                                                               |
| ----------- | ------------------------------------------------------------------ |
| 可执行文件  | `src-tauri/target/release/xreader.exe`                             |
| MSI 安装包  | `src-tauri/target/release/bundle/msi/XReader_0.1.0_x64_en-US.msi`  |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/XReader_0.1.0_x64-setup.exe` |

---

## 6. 技术决策记录

1. **Tailwind v3 而非 v4**：v4 与 shadcn/ui 兼容性尚不稳定，v3 经充分验证
2. **ESLint 9 flat config**：使用 `eslint.config.js` (ESM)，整合 typescript-eslint + react-hooks
3. **`#![allow(dead_code)]`**：models 和 queries 中的 struct/函数为后续 Phase 预留，暂加全局抑制
4. **bundled SQLite**：`rusqlite/bundled` 特性确保所有平台自带 SQLite，无需系统安装
5. **pipeline-based module layout**：书源引擎按 tokenizer → compiler → evaluator → pipeline 分层，预留目录结构
6. **refinery 嵌入式迁移**：`embed_migrations!` 在编译时内联 SQL 文件，零运行时依赖

---

## 7. 下一步：Phase 2 — 本地书籍导入与书架

预计工时 25-35h，核心任务：

- 实现 `BookFormat` trait（EPUB → epub crate, TXT → encoding_rs + 正则分章, PDF → 元数据提取）
- `FormatRegistry` 注册机制
- 文件对话框导入 (Tauri dialog API)
- 书籍元数据写入 SQLite
- 书架 UI：网格/列表视图、排序、搜索
- 封面显示 (EPUB 内置 / TXT/PDF 自动生成)
