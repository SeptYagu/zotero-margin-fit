# MarginFit

**Read the PDF content, not the margins.**

MarginFit is a plugin for the Zotero 10 PDF reader. It detects excessive or uneven page margins, fits the actual content to your window, makes page-by-page reading easier, and brings Zotero's native single-page / two-page switch into the reader toolbar.

**[Download the latest release](https://github.com/SeptYagu/zotero-margin-fit/releases/latest)** · **[Report an issue](https://github.com/SeptYagu/zotero-margin-fit/issues)** · **[中文说明](#中文说明)**

## Features

### 1. Smart margin detection

Many PDFs have large white margins or inconsistent content positions, making the actual text appear too small. MarginFit finds the content boundaries and uses them to fit the view. It works with many text-based and scanned PDFs, and takes a conservative approach when a page cannot be recognized reliably.

**The original PDF is never cropped, rewritten, or modified.**

### 2. One-click Fit Width / Fit Height

- **Fit Width:** enlarge detected content to fill the available reading width.
- **Fit Height:** fit the detected content within both the available height and width; in native two-page layouts, keep both sheets' text visible at a shared zoom.
- **Click the selected fit button again to turn it off** without resetting your position. Selecting the other button switches modes.
- Turn **Detect Margins** off to use Zotero's original page-width / page-height fitting.

MarginFit avoids repeated tiny adjustments between similar pages and respects manual movement within the current page.

### 3. Page-by-page navigation

With **Fit Height** selected, **Page Down / Page Up** moves one page or one complete two-page spread:

- **Single Page:** 1 → 2 → 3 → 4.
- **Odd Spreads:** 1–2 → 3–4 → 5–6.
- **Even Spreads:** cover page 1 → 2–3 → 4–5.

With Detect Margins **on**, the navigation aligns detected content. With detection **off**, it follows the original page boundaries. The PDF remains continuously scrollable: wheel, touchpad, arrow keys and the full-document scrollbar still work.

### 4. Easy access to Zotero's built-in two-page layouts

The **Page Spreads** button uses Zotero's **existing View-menu layouts**, not a custom renderer.

| Paper icon | Layout | Page grouping |
| --- | --- | --- |
| One outlined sheet | Single Page | 1, 2, 3, 4… |
| Filled left + outlined right | Odd Spreads | 1–2, 3–4, 5–6… |
| Outlined left + filled right | Even Spreads | 1 alone, then 2–3, 4–5… |

Click the paper icon to cycle through the three states. Changing the layout in Zotero's **View** menu also updates this button.

## The four toolbar buttons

From left to right:

1. **Fit Width** — fit content horizontally.
2. **Fit Height** — fit content vertically and enable one-page / one-spread navigation.
3. **Detect Margins** — switch smart boundary detection on or off.
4. **Page Spreads** — cycle Zotero's native Single / Odd / Even modes.

The plugin replaces Zotero's Reset Zoom control while active and restores it when disabled or uninstalled.

## Installation

1. Download the latest **.xpi** from [GitHub Releases](https://github.com/SeptYagu/zotero-margin-fit/releases/latest).
2. Open Zotero → **Tools → Plugins**.
3. In the plugin manager, select **Install Add-on From File** and choose the downloaded XPI.
4. Open a PDF. The four buttons will appear in its toolbar.

Existing installations can receive approved releases through Zotero's plugin update mechanism.

## Compatibility and limitations

- **Zotero:** 10.0.5–10.0.x. Tested primarily with Zotero 10.0.6 on Windows; macOS and Linux are not yet fully verified.
- **PDF quality:** Scanned pages, unusual dark edges or irregular layouts may require conservative boundary detection.
- **Two-page height fitting:** Both detected content areas are fitted together. Unusual scans or unreliable boundaries can still require the conservative full-page fallback.
- **Privacy and originals:** No OCR, network analysis, PDF rewriting or annotation-coordinate changes.

MarginFit caches detected page boundaries locally to speed up future reading. After analyzing the active document, it can also analyze other currently open PDFs in the background, without changing what you are viewing.

## 中文说明

**MarginFit：智能去白边、适合宽度／高度、整页翻页，以及原生单双页切换。**

很多 PDF 文献留白过大，或各页的正文位置不一致，导致文字显示得比较小。MarginFit 自动检测正文边界，充分利用阅读器空间。插件只调整显示方式，**不会修改原始 PDF 或批注**。

### 三项核心阅读功能

- **智能去白边：** 检测页面实际内容边界，减少多余留白。识别不可靠时保守处理，避免遮挡正文。
- **智能适合宽度／高度：** 一键按正文宽度或高度缩放；再次点击当前模式即可关闭。关闭“识别边界”后，仍可使用 Zotero 原生适配。
- **智能整页翻页：** 开启“适合高度”后，使用 **Page Down / Page Up** 一次翻一页，双页模式下一次翻一组。开启识别边界时对齐正文，关闭时对齐原始页面；仍然可以在页内自由滚动。

### 四个工具栏按钮

从左到右是 **适合宽度 → 适合高度 → 识别边界 → 单双页切换**。

最右侧的纸张图标可以直接切换 Zotero 本来就有的三种阅读布局：

- **单页：** 一张空心纸，每次翻一页。
- **奇数页跨页：** 左实心、右空心，1–2、3–4、5–6……
- **偶数页跨页：** 左空心、右实心，封面第 1 页单独显示，然后 2–3、4–5……

双页模式下，**按一次 Page Down / Page Up 就翻过整组两页**，不需要按两次。在 Zotero **View（视图）** 菜单切换布局时，图标也会同步更新。

### 安装与兼容性

从 [最新版本下载页面](https://github.com/SeptYagu/zotero-margin-fit/releases/latest) 下载 **.xpi** 安装包，在 Zotero 的 **Tools（工具）→ Plugins（插件）→ 从文件安装插件** 中安装，打开 PDF 即可使用。

支持 **Zotero 10.0.5–10.0.x**，主要在 Windows 上测试。扫描杂线、背景色和不规则页面可能影响识别；双页适合高度时以两页正文的完整边界共同缩放，识别不可靠时保守回退。

## Development

Building and unit tests require Node.js 20+. Native integration tests require Zotero 10 and use disposable test profiles.

| Task | Command |
| --- | --- |
| Unit tests | npm test |
| Build local XPI | npm run build |
| Native reader checks | npm run test:integration |
| Spread navigation | npm run test:spread |
| Toolbar | npm run test:ui |
| Height / page navigation | npm run test:height |

Further native scripts cover the persistent cache, background indexing and annotations.

See [Architecture](docs/architecture.md), [Verification](docs/verification.md), [Changelog](CHANGELOG.md) and [Release policy](docs/RELEASE-POLICY.md).

Licensed under [MIT](LICENSE).
