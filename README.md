# MarginFit

Smart content fitting for the Zotero PDF reader. Keeps the native **Reset Zoom** and adds only **Fit Height** and **Detect Margins**.

Zotero PDF 阅读器的智能内容适应插件。保留原生 **Reset Zoom**，只新增 **Fit Height / 适合高度** 和 **Detect Margins / 识别边界** 两个控件。

本项目依照 [需求文档](09-智能去白边阅读开关.md) 实现。当前正式版本为 **0.1.8**，使用 Zotero 私有阅读器接口。兼容范围限定为 Zotero 10.0.x。运行测试的具体版本、通过项和待测项见 [验证记录](docs/verification.md)。

## v0.1.11 continuous Fit Height

- Fit Height uses the detected content bounds while retaining native PDF.js continuous vertical scrolling, full-document scrollbar, all PDF pages, keyboard navigation, mouse-wheel and touchpad behavior.
- The removed v0.1.8?v0.1.10 experimental PAGE mode and custom wheel-to-page navigation are no longer used.
- If a previous release left the reader in PAGE mode, activating Fit Height restores native continuous scrolling.

## v0.1.10 Fit Height page-lock fix (superseded by v0.1.11)

- In Fit Height, manual zoom now exits PDF.js PAGE mode into native continuous scrolling, so the rest of the PDF cannot become inaccessible.
- A new explicit Fit Height request re-enters the intentional one-page-per-turn mode; ordinary wheel page turning remains unchanged.

## v0.1.9 append-only boundary cache

- Persist compact four-coordinate records to append-only JSONL; no repeated whole-book JSON rewrite.
- Previously saved JSON caches are intentionally ignored and are not deleted. A page will be indexed again on the new version.
- Preserve long-distance page-number Width Fit, foreground priority and idle book indexing.

## v0.1.8 content-height page mode and dirty scan support

- Native one-page Fit Height mode with immediate page turns, content-fitting and native continuous-scroll restore.
- Background indexing of uncached pages while idle, persistently reusing four-coordinate fitting rectangles.
- Retain special far-away page-number Width Fit even after closing/reopening the PDF.
- Handle mixed-page-size scans with dirty edges, dark corners and isolated scanner streaks; remove duplicate toolbar buttons.
- The [release policy](docs/RELEASE-POLICY.md) publishes completed iterations as regular XPI Releases for rapid direct updates.
- All reviews and changes follow the [mandatory engineering principles](docs/ENGINEERING-PRINCIPLES.md): evidence first, minimal changes, measured performance, and no speculative overengineering.

## v0.1.7 performance and positioning improvements

- Real Zotero PDF reader: detect the actual visible page first; explicit fitting is no longer blocked by six representative pages.
- Preload only the two immediately neighboring pages in the direction of travel. For ordinary mixed, scanned, and score PDFs, omit all distant book-wide scanning. Verify text-only page numbers on demand.
- A 560px detector raster, one-in-four diagonally staggered ink samples, and supported text/ink calibration reduce detection work and improve PDF text-width overestimation; native display resolution remains unchanged.
- Respect manual pan of the same page until the user leaves it or explicitly requests Fit; suppress tiny automatic horizontal corrections.
- Read-only, real-library A/B on 18 research PDFs: initial page detection jobs 171 to 52; mean time to first exact page bounds 4.28s to 2.18s versus v0.1.6. See [real-document benchmark](docs/2026-10-11-real-library-18-pdf-ab-benchmark.md). These times include reader startup, not isolated CPU time.

## 安装与使用

从 [Releases](https://github.com/SeptYagu/zotero-margin-fit/releases) 下载 `.xpi`，在 Zotero 的“工具 → 插件”中选择“从文件安装插件”。也可以从源码自行构建。

Automatic updates / 自动更新：已安装版本通过 `updates.json` 获取新版本及 SHA-256 校验值。允许插件自动更新时，由 Zotero 原生更新机制检查、下载和安装；也可在插件管理器中手动检查更新。GitHub Release 的预发布标记不替代此更新源，更新列表必须包含版本条目。

- 默认开启识别边界；开关偏好跨文档保存。打开 PDF 后自动按最近的宽度／高度方向适应，默认宽度。
- 原生 Reset Zoom、Ctrl/Cmd+0 和适合页宽菜单走同一个内容宽度入口。
- 新增高度按钮和适合页高菜单按实际内容高度缩放；需要时可以横向滚动。
- 关闭识别后使用原生页宽／页高行为，关闭动作不立即移动当前阅读位置。
- 手动缩放会暂停当前页的自动适应；进入另一主要阅读页、切换开关、调整视窗或主动使用适应按钮后恢复。
- 停稳后倍率不变时保持纵向位置；必要的自动缩放保留当前阅读锚点。停在两页之间时继续检测和预读，延后视图适应，不吸附到某页。只有主动点击适应按钮才纵向对齐内容。
- 主动适应后仍会预读邻页；关闭识别立即暂停后续检测，在途单页可以完成并缓存，重新开启复用已有样本。
- 页面背景复杂或无法可靠识别时保留当前可读视图，开关 tooltip 显示简短提示。

插件只改变原生缩放和滚动位置，不写入 PDF 或批注，不联网分析、不调用 OCR。Zotero 自己仍会按原生行为保存阅读位置。此版本是“智能适合内容”，原 PDF 页面布局和连续阅读中的页间空白占位仍然存在。

## 实现规则

1. **L1 (adaptive)**: Exact detection of the currently visible page has priority. Only a reliable text-only page with a plausible isolated folio triggers book-wide numbering validation; use cached neighbors and stop as soon as four independent pages confirm the same numbering sequence. Other PDFs skip distant representative-page renders.
2. **L2 (idle prefetch)**: After 500 ms without user activity, examine only the immediately adjacent next/previous pages (in reading direction first) with a single serialized detector worker. User scrolling cancels stale work; a cached in-flight result is reused when possible.
3. **L3**：与上一次实际应用倍率比较，安全且差异小于 5% 时保持倍率，只修正当前页位置；用户显式操作绕过死区。必要内容保护优先于死区。

0.1.4 对纯文字 PDF 增加严格的 PDF.js 绘图指令白名单，可靠纯文字页直接使用文字边界，不进行额外低清渲染；包含图像、矢量图、乐谱或未知操作的页面仍执行原有保守渲染检测。字符框与最长边不超过 800 px 的临时低清画布共同检测四边，包含文字框之外的图表、页码和脚注。缓存只存绝对原始框、尺寸、旋转、文件修订和质量。0.1.4 在 Zotero 配置目录的 `marginfit-boundaries/` 保存小型 JSON 缓存（文件指纹、页数、文件大小及修改时间、算法版本校验），再次打开命中后不重新检测；可删除缓存目录而不影响 PDF 或批注。0.1.6 起显示时统一加 **16 PDF 单位** 四侧安全留白，无留白设置。该常量仍需更多真实扫描样本校准。画布用后释放。

采用 PDF.js 原生缩放及滚动容器定位，不对 canvas、文本层或批注层施加 CSS 缩放。只在 PDFView 实例上可逆包装缩放方法及状态回调，禁用／卸载时恢复。每个视图维护独立缩放锚点，文件重开或修订后使用新缓存。

## 开发与验证

无需运行时依赖或 npm 包安装，Node.js 20+ 即可：

```sh
npm test
npm run build
```

Official build: dist/zotero-margin-fit-0.1.11.xpi. Zotero automatic updates use the public feed once the GitHub Release XPI and SHA-256 have been verified.

在安装 Zotero 的 Windows 电脑上运行真实阅读器回归：

```sh
npm run test:integration
```

发布新版本时，先构建并上传匹配版本的 XPI，再执行 `npm run update:feed` 生成版本、下载地址与实际包的 SHA-256 校验值，提交并推送 `updates.json`。可用 `npm run test:update` 在隔离配置中安装公开旧版，通过 Zotero 原生更新检查、下载、校验和安装新版，并检查偏好是否保留；该测试依赖已发布的安装包与公开更新源。

测试新建临时 profile 和独立数据库，安装 XPI、导入自行生成的 PDF、验证检测／缩放／滚动／清理，不使用正式文献库。日志保存在忽略的 `.test-harness/`；数据库放在本机临时目录，避免 OneDrive 上的数据库启动限制。可通过 `tests/run-integration.ps1 -ZoteroPath ...` 指定程序位置。

## 范围与限制

首版优先支持普通电子论文和背景干净的扫描件。0.1.5 对纯文字且无批注的 PDF，仅在多个采样页确认连续编号及位置规律后，将高置信页码排除出**适配边界**；页码本身仍保留在原 PDF 中。对扫描件、乐谱、复杂图形、页眉、脚注维持保守检测，不拆栏、不永久裁剪。0.1.6 对含乐谱及混合图形的 PDF 使用约 25% 的斜向交错低清像素采样与二维支持度分析，置信度充足时可将孤立页码排除出宽度适配，同时保留完整高度页脚；复杂页面仍安全回退。0.1.6 还统一了新增按钮与 Zotero 原生缩放按钮的位置和亮／暗主题颜色，并提供更明确的选中状态与回退提示。只以停稳后的主要阅读页为目标；同屏两页不会独立同时适应。

分屏、独立窗口、复杂扫描、触摸板惯性滚动和特殊双击手势须按验证记录区分已测与待测；未验证的平台或行为不作完整支持承诺。私有接口随 Zotero 版本变化时可能需要适配。

技术依据：[Zotero 官方插件文档](https://www.zotero.org/support/dev/zotero_7_for_developers)、[PDFView 源码](https://github.com/zotero/reader/blob/master/src/pdf/pdf-view.js)。实现选择与验收映射见 [设计说明](docs/architecture.md)。

MIT License。
