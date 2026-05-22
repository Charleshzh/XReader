# XReader Testing Hardening, Docs Drift Cleanup, and Reader Roadmap Design

**Date:** 2026-05-22

## Goal

Produce two linked deliverables:

1. an engineering-hardening plan that closes the most important testing and documentation gaps in the current XReader codebase; and
2. a product-evolution plan that compares XReader against mature novel readers—especially Legado at source-code level—and defines a staged roadmap to bring XReader's reading interface and reading functionality to a comparable level.

## Current Verified Baseline

This design is grounded in direct repository inspection and local verification.

### Verified project state

- Frontend app: `src/`
- Tauri/Rust backend: `src-tauri/src/`
- E2E tests: `tests/e2e/smoke.spec.ts`
- CI workflow: `.github/workflows/ci.yml`

### Verified command results

- `pnpm build` passes
- `pnpm lint` passes with one warning in `src/pages/BookshelfPage.tsx` related to the React Compiler lint rule around `useVirtualizer()`
- `cargo check` passes
- `cargo test` passes with **52 passed, 7 ignored**
- `pnpm test:e2e` currently passes **6 smoke tests**

### Verified drift examples

Current docs do not agree with the repository state:

- `README.md`, `CLAUDE.md`, `docs/gap-analysis.md`, and phase-completion docs still mention **9 E2E smoke tests** in several places, while the current Playwright suite contains **6 tests**.
- Some docs still refer to older Rust test counts such as **39** instead of the current **52 passed / 7 ignored**.
- Phase-completion docs mix historical snapshot data with language that reads like current-state documentation.
- Playwright coverage is often described as fuller “E2E” coverage than the current suite actually provides; the current suite is closer to **frontend smoke coverage via Vite** than true desktop end-to-end Tauri coverage.

## Research Basis for Reader Gap Analysis

The roadmap portion of this design uses both XReader source code and Legado source code.

### XReader files inspected

- `src/App.tsx`
- `src/pages/BookshelfPage.tsx`
- `src/pages/ReaderPage.tsx`
- `src/pages/SearchPage.tsx`
- `src/pages/DiscoverPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/StatsPage.tsx`
- `src/stores/bookStore.ts`
- `src/stores/readerStore.ts`
- `src/stores/sourceStore.ts`
- `src/components/reader/ReaderShell.tsx`
- `src/components/reader/HtmlContentView.tsx`
- `src/components/reader/PdfContentView.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/book/*`
- `src-tauri/src/source/*`
- `src-tauri/src/sync/*`

### Legado files inspected

- `app/src/main/java/io/legado/app/help/config/ReadBookConfig.kt`
- `app/src/main/java/io/legado/app/ui/book/read/page/ReadView.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/ReadStyleDialog.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/BgTextConfigDialog.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/TipConfigDialog.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/ClickActionConfigDialog.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/MoreConfigDialog.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/AutoReadDialog.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/ReadAloudConfigDialog.kt`
- `app/src/main/java/io/legado/app/service/TTSReadAloudService.kt`
- `app/src/main/java/io/legado/app/service/HttpReadAloudService.kt`
- `app/src/main/java/io/legado/app/ui/book/read/config/ChineseConverter.kt`
- `app/src/main/java/io/legado/app/ui/dict/rule/DictRuleActivity.kt`
- `app/src/main/java/io/legado/app/ui/association/OnLineImportActivity.kt`
- `app/src/main/java/io/legado/app/ui/association/OnLineImportViewModel.kt`

## Design Decision

The work is split into **two linked workstreams**.

- **Workstream A: Engineering Hardening**
  - fill testing gaps
  - clean up documentation drift
  - produce a trustworthy current-state baseline
- **Workstream B: Reader Evolution**
  - compare XReader against Legado and other mature readers
  - define a staged roadmap for reading UI and reading features
  - use the Workstream A baseline as the factual starting point

This split is intentional. The roadmap must not be written on top of stale counts, stale completion claims, or stale assumptions about what is already tested.

## Workstream A — Engineering Hardening

## Objective

Make XReader’s current behavior testable, documentable, and safe to evolve.

## A1. Testing Strategy

### Principle

Add tests for behavior the codebase already promises. Do not inflate coverage with brittle plumbing tests or mock-heavy UI tests.

### A1.1 Rust testing priorities

#### Command-boundary tests

Focus on `src-tauri/src/commands.rs`, where product behavior is exposed to the frontend.

Priority areas:

- sync configuration read/write behavior
- legacy plaintext sync-config fallback behavior
- export path validation and export-size limits in `write_file`
- source import validation and storage behavior
- chapter lookup and unsupported/missing-book paths
- reading progress persistence boundaries

#### Sync behavior tests

Extend the existing `src-tauri/src/sync/mod.rs` coverage beyond merge basics.

Priority areas:

- snapshot/export field completeness
- merge behavior per table
- “newer local wins” vs “newer remote wins” semantics
- compatibility around encrypted vs old plaintext config storage
- row-shape mismatch handling where current code silently drops fields

#### Book-format behavior tests

Strengthen `src-tauri/src/book/*` coverage.

Priority areas:

- TXT encoding and chapter-splitting edges
- PDF current behavior as implemented today, not as imagined in docs
- EPUB extraction assumptions where the UI depends on HTML output

### A1.2 Frontend/E2E testing priorities

#### Playwright smoke hardening

The current suite is route smoke coverage. It should become **behavioral smoke coverage**.

Required upgrades:

- stop swallowing `pageerror` events in `tests/e2e/smoke.spec.ts`
- add `/search` route coverage
- replace assertions like “body is not empty” with route-specific, user-visible expectations
- make `/reader/nonexistent-id` assert the **actual current contract** (redirect/fallback back to bookshelf) instead of a vague non-empty-page check
- verify navigation from bookshelf entry points to sub-pages where feasible

#### Thin frontend unit tests

Add only low-maintenance tests.

Good candidates:

- `src/components/ErrorBoundary.tsx`
- pure helper logic extracted from `HtmlContentView` highlight processing if needed
- deterministic formatting/mapping logic where behavior is stable and user-visible

Avoid broad snapshot suites and avoid tests that lock in incidental DOM structure.

## A2. Documentation Drift Strategy

### Principle

Different documents need different truth models.

### A2.1 Document roles

- `README.md`: current outward-facing product and verification summary
- `CLAUDE.md`: current engineering map and maintenance reference
- `docs/CONTEXT.md`: durable domain language and conceptual model, not volatile counters
- `docs/gap-analysis.md`: current snapshot of what is missing and what remains risky
- `docs/phase-*-completion.md`: historical phase records only

### A2.2 Required cleanup

- correct outdated test counts and suite descriptions
- align CI descriptions with `.github/workflows/ci.yml`
- clarify where coverage is smoke-only vs deeper behavioral coverage
- remove repeated volatile counts where they are copied across multiple docs without clear ownership
- explicitly mark phase-completion docs as historical snapshots when they contain outdated counts or scope statements

### A2.3 Ongoing anti-drift rule

After the cleanup, only a small number of current-state documents should carry volatile status numbers. Historical docs should not be re-used as current release notes.

## A3. Workstream A Acceptance Criteria

Workstream A is complete when:

- the highest-risk current behaviors have direct automated coverage
- smoke tests assert route behavior instead of mere render existence
- current-state docs agree with current source and current command results
- historical docs are clearly historical
- a maintainer can tell, from docs alone, which facts are current and which are archival

## Workstream B — Reader Evolution

## Objective

Define a source-grounded roadmap that closes the most important gaps between XReader and mature readers, with Legado as the primary benchmark for novel-reading UX and reading-feature depth.

## B1. What XReader already has

From the current codebase, XReader already provides:

- local EPUB/TXT/PDF reading
- scroll and paginated reading modes
- chapter TOC
- reader theme/font/spacing basics
- bookmarks and annotations
- reading stats
- book-source search and discover pages
- WebDAV sync

But the current reader-settings model is still thin:

- `fontSize`
- `lineHeight`
- `marginH`
- `marginV`
- `fontFamily`
- `theme` (light/dark/sepia)
- `scrollMode` (scroll/paginated)

Current reader limitations visible in source:

- bookmarks are still chapter-level in practice because `position` is passed as `0` in bookmark creation
- reader deep-linking is fragile because `ReaderPage` depends on `bookStore` already being loaded
- search/discover do not complete a full “find book -> enter reading flow” remote-reader loop
- no TTS
- no dictionary/translation workflow
- no Chinese simplified/traditional conversion
- no style preset system
- no click-region mapping system

## B2. What Legado source code shows beyond its README

Legado’s reading feature set is organized as **subsystems**, not isolated toggles.

### B2.1 Style system

`ReadBookConfig.kt`, `ReadStyleDialog.kt`, `BgTextConfigDialog.kt`, and `TipConfigDialog.kt` show a much deeper styling model:

- multiple reading-style presets
- style sharing vs per-style edits
- color/image/external-image backgrounds
- font family, font weight, font size, letter spacing
- line spacing, paragraph spacing, paragraph indent
- underline toggles
- title placement and spacing controls
- header/footer slot configuration
- tip/divider color controls
- style import/export

This means “matching Legado’s reading UI” requires building a **style system**, not just adding a few sliders.

### B2.2 Interaction system

`ReadView.kt`, `ClickActionConfigDialog.kt`, and `MoreConfigDialog.kt` show a configurable reading interaction model:

- multiple page-animation/page-turn modes
- 9-region tap map
- configurable actions per tap region
- text selection handling and long-press behavior
- auto-page / auto-read support
- behavior toggles such as justification and system-bar behavior

This means “reading interaction parity” requires a structured input/action layer rather than a fixed left-30%/right-30% scheme.

### B2.3 Reading-assist system

`ReadAloudConfigDialog.kt`, `TTSReadAloudService.kt`, `HttpReadAloudService.kt`, `ChineseConverter.kt`, and `DictRuleActivity.kt` show a broad assistive layer:

- system TTS
- HTTP TTS engine support
- speech-engine selection and runtime control
- read-aloud configuration UI
- simplified/traditional Chinese conversion
- dictionary-rule management and import

This means “reading feature parity” is not just TTS; it includes text transformation, assistive lookup, and richer reading-control surfaces.

### B2.4 Import and extensibility system

`OnLineImportActivity.kt` and `OnLineImportViewModel.kt` show import flows for:

- `readConfig`
- `theme`
- `httpTTS`
- `dictRule`
- `replaceRule`
- book-source and related rule artifacts

This means Legado’s reading UX is partially powered by **importable reader assets and extensions**. XReader currently has no equivalent extension surface.

## B3. Reader Gap Model for XReader

The roadmap should group gaps into four layers.

### Layer 1 — Reader baseline and remote-reading closure

- robust reader deep-link/reload behavior
- precise bookmark position tracking
- stronger error/empty/loading states in the reader flow
- minimal remote-book flow from search/discover into actual reading

### Layer 2 — Style system

- multiple reader-style presets
- richer typography controls
- background/image/theme expansion
- title/header/footer configuration
- style import/export and persistence strategy

### Layer 3 — Interaction system

- more page-turn modes
- configurable click/tap regions
- auto-page
- content search within reading
- configurable reader actions rather than fixed gestures only

### Layer 4 — Reading-assist and extensibility system

- system TTS
- later evaluation of HTTP TTS
- simplified/traditional conversion
- dictionary/translation entry points
- importable reader assets and rules

## B4. Phased Reader Roadmap

The roadmap is intentionally staged.

### P0 — Baseline correction

Purpose:

- finish Workstream A
- freeze the current factual baseline
- make future roadmap decisions against verified current state

### P1 — Reader baseline closure

Target outcomes:

- stable reader entry and reload behavior
- precise bookmarking and progress semantics
- improved reader route and empty/error behavior
- minimum viable remote reading closure from source discovery/search into actual reading flow

### P2 — Style system

Target outcomes:

- multiple saved reading styles
- expanded typography controls
- theme/background system growth
- configurable title/header/footer presentation
- import/export design for reading styles

### P3 — Interaction system

Target outcomes:

- more page-turn behaviors
- configurable click-region mapping
- auto-page support
- richer reader-behavior settings

### P4 — Reading-assist system

Target outcomes:

- system TTS
- content search in reader
- simplified/traditional conversion
- dictionary/translation entry points
- stronger annotation/highlight anchoring if needed by the assistive layer

### P5 — Reader extensibility

Target outcomes:

- import/export for read-config/theme-like reader assets
- pluggable reader-adjacent data such as dictionary or read-aloud rule packs
- a clean boundary for future desktop-specific differentiators

## B5. Reader Roadmap Acceptance Criteria

The roadmap deliverable is complete when it contains:

- a source-grounded XReader-vs-Legado gap matrix
- stage-by-stage goals from P0 through P5
- clear stage boundaries and dependencies
- explicit testing expectations per stage
- explicit documentation updates required per stage
- a distinction between “must catch up to Legado” and “desktop-specific future differentiation”

## Out of Scope

This design does not yet define the exact implementation task list, file-by-file edits, or commit-by-commit order. That belongs in the implementation plans generated after the written spec is approved.

This design also does not attempt to fully replicate all of Legado’s Android-specific behaviors on desktop. The benchmark is feature depth and reader capability, not platform mimicry.

## Required Outputs After This Spec

After this design is approved, the planning step should produce **two plans**:

1. **Engineering Hardening Plan**
   - tests
   - docs drift cleanup
   - current-state baseline ownership

2. **Reader Evolution Plan**
   - P0 through P5 roadmap execution
   - stage acceptance criteria
   - test and docs requirements for each stage

Both plans must stay linked to the same verified baseline established in Workstream A.