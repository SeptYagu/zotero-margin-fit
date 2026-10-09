# Changelog

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
