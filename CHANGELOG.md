# Changelog

## 0.1.16 ? 2026-10-12

- Fix cross-page Width Fit: automatically re-center detected content after navigating to a different PDF page, while keeping manual horizontal movement within the same page authoritative. The original Berger Musica Ficta page 15 previously showed ~97px left/right imbalance after normal navigation; now ~0.8px, without a second button click.
- Uncouple one-page Page Down / Page Up navigation from Detect Margins. With Fit Height ON and detection OFF, use native physical-page boundaries and native height fitting; with detection ON, retain content-aware landing. Real Windows OS key events verified 8 -> 9 -> 8.
- Reduce Fit Height top/bottom safety margin to 8 PDF units; retain full 16-unit horizontal padding and all four-edge detection/cache data. No changes to existing all-open background indexing.
- Add original Berger page 15 integration and no-detection OS key regression tests; 99-unit and native suites rerun.

## 0.1.15 ? 2026-10-12

- Restore user-required all-open background completion: active PDF first, then other opened PDFs, only stopping after all are cached.
- Avoid hidden-iframe requestAnimationFrame stalls using background-only PDF.js print intent, leaving normal display intent untouched.
- Add safety union of display-only PDF annotation rectangles to background detection; malformed metadata falls back conservatively.
- Keep cache indexing independent of fit-mode OFF while Detect Margins is ON.
- Native full-book inactive 24/24, activity selection, annotated page and Fit OFF tests; no changes to parity/raster-first A/B decisions.

## 0.1.14 ? 2026-10-12

- Repair default Zotero native acceptance driver against the current three-button UI without removing valid legacy coverage; preserve split-pane zoom on mode-pref updates and allow actual detached reader cold startup.
- Accept Windows PageDown/PageUp in the selected PDF's Zotero main window, routing to the existing one-content-page step; preserve free ArrowDown and continuous PDF layout.
- Prioritize the active PDF for one-worker idle indexing; stop after it is complete rather than trying to render suspended hidden readers. Selecting another unfinished PDF resumes indexing there.
- Update current README, architecture and verification guides while archiving historical v0.1.2 records.
- Experimental A/B: six-page parity cropping rejected on accuracy; unconditional raster-first rejected due extreme pure-text regression. Neither algorithm was enabled.

## 0.1.13 ? 2026-10-12

- Hide the original Reset Zoom toolbar button and replace it in the same position with Fit Width, Fit Height and Detect Margins. Unloading the plugin restores the original.
- Width/Height are now mutually exclusive on/off toggles. Turning off leaves the current PDF scale and reading position unchanged, and cancels pending automatic fitting.
- Keep mode selection between readers; when margin detection is disabled, fitting controls use native Zotero page-width/page-height commands.
- No changes to continuous PDF scrolling, content-page steps, sparse detection or JSONL cache.

## 0.1.12 ? 2026-10-12

- Preserve all pages in PDF.js continuous-scroll layout, but make PageDown/PageUp target the neighboring *content* page rather than shifting by viewport height.
- Preserve fine scroll/arrow-key adjustment inside a page; snap to the next page's detected content center only after the user actually crosses into that page.
- Reuse existing 75 ms input debouncer, cached bounds, single foreground detector, and page fitting; do not restore native PDF.js PAGE mode or custom wheel-gate timers.
- Fix explicit page keys using the actually visible page rather than a potentially stale internal last-page value.

## 0.1.11 ? 2026-10-12

- Replace single-PAGE Fit Height with content-aware scale in the native continuous-scrolling PDF viewer. All pages remain in the document and scrollbar; normal arrow/Page Down/mouse wheel/touchpad behavior is no longer intercepted.
- Remove the custom one-page wheel and navigation machinery rather than layering additional handlers on it.
- Restore continuous scrolling if an older reader is still in PAGE mode; preserve height-aware fitting, JSONL persistent cache, folio Width Fit and sparse geometry detection.
- Replace obsolete active page-mode test entrypoint with native full-document regression checks.

## 0.1.10 ? 2026-10-12

- Fix Fit Height single-page lock after manual zoom. When native scalechanging marks the reader as manually zoomed, restore its previous continuous multi-page layout instead of leaving PDF.js in PAGE mode with wheel-to-next-page disabled.
- Clicking Fit Height again deliberately re-enters the existing one-page-per-turn mode. No change to cache, margin detection, or normal wheel navigation.
- 91 unit tests; 29 native isolated Zotero 10.0.6 Height/page-turn checks (including 3 new regression assertions).

## 0.1.9 ? 2026-10-12

- Replace snapshot JSON boundary cache with append-only JSONL; cache reuse is still keyed by both PDF.js fingerprints and page count.
- Intentionally abandon prior .json caches: all page bounds are recomputed lazily on first access and during cooperative idle scanning. Old files are ignored, not deleted.
- Keep four coordinates per page, distant-page-number Width Fit, small batched writes, and the independent algorithmVersion 1.
- Restore uncommitted records after a failed append; reject unreadable or incompatible existing files rather than overwriting them.
- Unit and Node compatibility checks passed; native Zotero 10.0.6 integration not yet confirmed due a debugger harness failure (ECONNRESET). See docs/2026-10-12-v019-jsonl-implementation.md.

## 0.1.8 — 2026-10-12

- Native Fit Height PAGE-mode page turning, cached first-frame fitting, controlled touchpad wheel behavior, and restoration of previous continuous scroll mode.
- Persistent four-coordinate PDF content geometry and cooperative idle indexing with foreground preemption and old-cache migration.
- Preserve far-away printed page-number Width Fit across reopen without an extra persisted rectangle.
- Improve difficult scanned book detection (Berger Musica Ficta; nonuniform page sizes, dirty scanner rims, isolated dark streaks and OCR mismatch).
- Remove duplicate plugin toolbar controls on rediscovery.
- 90 unit tests; earlier Zotero integration tests plus final offline real-book scan validation. See RELEASE_NOTES.md for remaining harness limitations.



## 0.1.5 — 2026-10-09

- P1-A: scalar text bounding boxes with deterministic randomized equivalence checks.
- P1-B: retain safe page-level classification; cross-document raster-first heuristic deferred pending representative A/B evidence.
- P1-C: exclude only high-confidence pure-text page numbers from fit bounds, preserving full original PDF bounds, scanned/illustrated content and annotations.
- P2-A: dirty-page persistence, batched writes and serialized multi-reader cache merging.
- P2-B: trailing scroll-event geometry debounce.
- Validated with Zotero 10.0.6 isolated profiles: 47 unit tests, 70 reader integration checks, 18 page-number/cache checks. Scroll hot-path work was reduced; total application CPU improvement is workload-dependent.

## 0.1.4 — 2026-10-08

- Strict pure-text fast path: inspect PDF.js operator lists and bypass secondary offscreen rasterization only on confidently text-only pages. Pages with images, vector paths, unsupported operations or ambiguous bounds keep the existing conservative raster detector.
- Persist validated absolute content boundaries as compact per-PDF JSON under the Zotero profile, keyed by PDF fingerprints, page count, file size/modified timestamp when accessible, and detection algorithm version.
- Reopening a previously scanned PDF reuses six L1 samples and individually cached page boundaries without PDF re-rendering. Cache never stores PDF contents or images and can be safely deleted.
- Added cache schema/invalidation, pure text/vector/scan and reopened-document regression checks.

- 严格限定的纯文字页可跳过第二次画布渲染；扫描、图形及不确定页面继续保守识别。新增本地持久化边界缓存，再次打开同一 PDF 可跳过已分析页面；文件变更或算法升级后缓存失效。

## 0.1.3 — 2026-10-08

- Performance: coalesce duplicate scroll input events into a 75 ms visible-page geometry update, while invalidating obsolete work immediately.
- Defer starting the next L1/L2 low-resolution page analysis while the user is scrolling, then resume after the idle interval; preserve L1-before-L2 sequencing.
- Explicit Fit Width/Height commands bypass background-scroll cooldown. Keep native Zotero controls, page positioning, detection accuracy, PDF bytes, and annotations unchanged.
- Add regression tests for scroll coalescing, OFF-state fast path, detection deferral, and explicit fitting.

- 性能优化：合并重复滚动事件的页面几何查询，滚动时不再启动后续低清页面检测；主动点击适应按钮仍可及时响应。
- 保留原生控件、六页 L1 优先、L2 预读、5% 缩放稳定规则和阅读位置保护；新增性能回归测试。
- 说明：高倍率 PDF.js 原生渲染和逐页首次低清分析的 CPU 成本仍然存在。本版不承诺总体 CPU 下降具体百分比。

## 0.1.2 — 2026-10-08

Enable native Zotero updates with a versioned, SHA-256-verified feed. Show English before Chinese in the plugin description, tooltips, accessible labels, and ON/OFF/fallback messages.

启用 Zotero 原生自动更新源，提供版本与 SHA-256 校验值。插件说明、按钮提示、无障碍名称及开关／回退提示统一英文在前、中文在后。

## 0.1.1 — 2026-10-08

- 修复新增按钮被工具栏窗口拖动区域接走点击的问题，实际按钮点击可切换高度模式和识别开关。
- 首次自动适应保留页内恢复位置；停稳后倍率不变不改纵向位置，必要缩放保留阅读锚点；页间间隙不强行吸附到一页。
- 主动宽／高适应后继续 L2 邻页预读；关闭识别暂停后续 L1/L2 检测，重新开启复用已完成样本。
- 增加恢复位置、停稳微移、页间跳动、预读和暂停／恢复的回归检查。

## 0.1.0 — 2026-10-08

实验首版：保留原生 Reset Zoom，新增 Fit Height 和 Detect Margins；四边检测、固定安全留白、L1 六页奇偶预测、L2 停稳后局部精算、L3 固定锚点稳定缩放。支持原生按钮／快捷键／菜单的实例级可逆接管、窗口与分屏生命周期清理、保守回退及跨文档偏好。

附带无依赖 XPI 构建、GitHub Actions、19 项核心测试和 50 项 Zotero 10.0.6 隔离配置检查。支持范围与待测项见 [验证记录](docs/verification.md)。
