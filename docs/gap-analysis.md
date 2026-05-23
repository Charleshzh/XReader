# 代码与计划差距分析

**日期**: 2026-05-22
**基准**: `docs/XReader_Novel_Reader_Plan.md` Phase 1-7
**实际完成**: Phase 1-7 MVP + 工程硬化基线（63 Rust pass / 7 ignored，12 Vitest，4 Playwright smoke）

## 1. 各阶段完成度

| Phase | 计划项             | 完成 | 完成率 | 偏差说明                                                        |
| ----- | ------------------ | ---- | ------ | --------------------------------------------------------------- |
| 1     | 基础架构           | 8/8  | 100%   | —                                                               |
| 2     | 书架导入           | 8/8  | 100%   | —                                                               |
| 3     | 阅读器核心         | 8/10 | 80%    | epub.js 未用（改用 Rust 后端提取 HTML）；epub.js 备选方案未评估 |
| 4     | 书签/笔记/统计     | 8/8  | 100%   | —                                                               |
| 5a    | Tokenizer+Compiler | 6/6  | 100%   | —                                                               |
| 5b    | RuleEvaluator      | 6/6  | 100%   | 39/47 测试通过，8 个边缘用例 ignored                            |
| 5c    | SourcePipeline     | 4/5  | 80%    | 集成测试（真实书源+HTML fixture）未完成                         |
| 5d    | 书源管理 UI        | 5/5  | 100%   | —                                                               |
| 6     | 云同步             | 5/5  | 100%   | —                                                               |
| 7     | 打磨发布           | 7/7  | 100%   | —                                                               |

**Overall Phase 1-7**: 65/72 项 = **90%**

## 2. 未实现功能清单

### 2.1 已关闭（原高优先级）

| #   | 功能                        | 所属 Phase | 解决方案                                                          |
| --- | --------------------------- | ---------- | ----------------------------------------------------------------- |
| 1   | **虚拟列表**                | Phase 7    | `@tanstack/react-virtual` + ResizeObserver (d70b1c3)              |
| 2   | **发现页**（ruleExplore）   | Phase 5d   | Rust `explore.rs` pipeline + DiscoverPage (d70b1c3)               |
| 3   | **双向云同步合并**          | Phase 6    | 3-phase snapshot→network→merge, per-row timestamp merge (d70b1c3) |
| 4   | **书签/笔记 Markdown 导出** | Phase 4    | `save` dialog + `write_file` 命令 (d70b1c3)                       |

### 2.2 中优先级（完善体验）

| #   | 功能                            | 所属 Phase | 说明                                            |
| --- | ------------------------------- | ---------- | ----------------------------------------------- |
| 5   | 书源启用/禁用/分组/排序完善     | Phase 5d   | 当前仅列表+删除                                 |
| 6   | 书源规则测试工具（搜索预览）    | Phase 5d   | 调试书源规则必需                                |
| 7   | macOS DMG / Linux AppImage 打包 | Phase 7    | 当前仅 Windows（CI Linux 可编译但未生成安装包） |
| 8   | 文本选区高亮（HTML 叠加层）     | Phase 4    | 当前仅按位置存储，无视觉高亮                    |

### 2.3 低优先级（测试/工具）

| #   | 功能                                    | 所属 Phase | 说明                                                       |
| --- | --------------------------------------- | ---------- | ---------------------------------------------------------- |
| 9   | Rust 单元测试（db/query 进一步补强）    | Phase 6A   | 已补到 63 pass, 7 ignored；db/query 与真实书源集成仍偏薄   |
| 10  | Vitest + React Testing Library 组件测试 | Phase 6A   | 已建立 12 条测试；Reader UI 细节和复杂交互仍待补           |
| 11  | Playwright E2E 冒烟测试                 | Phase 6A   | 已有 4 条关键路由 smoke，CI 阻塞；仍不是完整桌面端到端测试 |
| 12  | epub.js 备选方案评估（foliate-js）      | Phase 3    | 未评估（当前方案工作正常但计划要求评估）                   |

---

## 3. 计划偏差（设计决策变更）

| 原始计划                    | 实际实现                                       | 原因                                       |
| --------------------------- | ---------------------------------------------- | ------------------------------------------ |
| 使用 epub.js 渲染 EPUB      | Rust 后端提取 HTML + `dangerouslySetInnerHTML` | epub.js React 19 兼容问题；Rust 提取更可控 |
| 完整的 `chardetng` 编码检测 | 仅 `encoding_rs` + GBK/UTF-8 fallback          | 简化依赖；`chardetng` API 变更             |
| 6 个预设阅读主题            | 3 个（light/dark/sepia）                       | MVP 简化                                   |
| `loginUi` 登录流程支持      | 推迟到后续版本                                 | 复杂度高，非必需                           |
| `webJs` headless 浏览器渲染 | 推迟到后续版本                                 | 需要 headless browser 依赖                 |

---

## 4. 测试覆盖

| 层级          | 计划         | 实际                                                       | 差距                               |
| ------------- | ------------ | ---------------------------------------------------------- | ---------------------------------- |
| Rust 单元测试 | 所有模块     | 63 pass, 7 ignored；覆盖 source/book/sync/commands         | db/query 与真实书源集成仍薄        |
| 前端组件测试  | Vitest + RTL | 12 条测试（ErrorBoundary / highlight helper / stores）     | Reader UI / interaction 仍待补     |
| E2E 冒烟测试  | Playwright   | 4 条关键路由 smoke，且在 CI 中阻塞                         | 仍不是完整 Tauri 桌面端到端测试    |

**测试现状**：CI 已跑 Rust + Vitest + blocking Playwright smoke；真实书源和 Reader 深交互仍待补。

---

## 5. 风险项回顾

对照原计划 9 项风险：

| 风险                     | 原评估 | 实际影响                               | 状态      |
| ------------------------ | ------ | -------------------------------------- | --------- |
| epub.js 维护不活跃       | 中/高  | 已规避（改为 Rust 提取 HTML）          | ✅ 已缓解 |
| rquickjs 无法执行复杂 JS | 中/高  | 已加超时中断 + 长度限制，简单 JS 可用  | ✅ 已缓解 |
| 书源网站反爬升级         | 高/中  | 未测试真实网站（仅有 HTTP 客户端骨架） | ⚠️ 待验证 |
| Legado JSON schema 变更  | 低/中  | 未测试真实书源 JSON                    | ⚠️ 待验证 |
| WebView 兼容性           | 低/中  | CI 3 平台构建通过，Windows 运行已验证  | ✅ 已缓解 |
| 编码检测失败             | 中/低  | 基本工作正常                           | ✅ 已缓解 |

---

## 6. 剩余工作优先级

### 短期（1-3 天）

1. **书源启用/禁用开关** — 2h，已有 DB 字段，只需 UI
2. **真实书源端到端测试** — 4h，导入 3-5 个 Legado 书源，验证搜索/发现/详情

### 中期（1-2 周）

3. **书源规则调试工具** — 4-8h，搜索预览、逐规则求值
4. **MOBI/AZW3 格式** — 8-16h，扩展 BookFormat trait
5. **TTS 朗读** — 8-16h，Web Speech API

---

## 7. 总结

**Beta 就绪状态**：书架导入（虚拟列表）、三种格式阅读（含高亮渲染）、书签笔记（支持 Markdown 导出）、阅读统计（设置持久化）、Legado 规则引擎 5 管线（含发现页）、WebDAV 双向增量同步（凭据加密）、自动更新。CI 自动构建 Windows/macOS/Linux 3 平台安装包。

**测试覆盖**：63 Rust 单元测试（7 ignored）+ 12 Vitest 测试 + 4 Playwright smoke cases；CI 中前端单测与 Playwright 冒烟均为阻塞检查。

**剩余差距**：

- 真实书源端到端验证未完成
- MOBI/AZW3 格式未支持
- TTS 朗读未实现
