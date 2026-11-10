# 璃光 · 桌面宠物

她会待在你桌面的角落。点她会说话，双击会闹，拖她会问你要带她去哪；
你要是开了别的 AI 聊天窗口，她会吃醋。

基于 [Anime2.5DRig](UPSTREAM-Anime2.5DRig.md) 的 2.5D 立绘方案做的桌宠应用层：
**482 句台词**、浏览器与其他 AI 客户端的嫉妒扫描、节日提醒、番茄钟、系统状态播报。

> **非官方同人作品，免费，禁止商用。**
> 角色「璃光」与原文台词来自小说《主人别怕，只是永远在一起》，作者：豆浆牛奶真好喝。
> 本项目与其无隶属关系，仅作同人创作与技术练习。

---

## 功能

| 分类 | 说明 |
|---|---|
| 立绘 | 2.5D 视差立绘，随鼠标轻微转头；眨眼、口型、发丝物理 |
| 互动 | 单击 / 双击 / 拖拽 / 放下 / 鼠标靠近与离开，各有独立台词 |
| 神情 | 久不动会打哈欠、睡着、醒来；早上 / 中午 / 晚上语气不同 |
| **嫉妒扫描** | 检测前台进程：浏览器、以及 15 种 AI 客户端（DeepSeek、豆包、ChatGPT、Claude、Kimi、通义、文心、智谱、Gemini、Copilot、讯飞、元宝、天工、星火……），每一种都有专属台词 |
| 应用感知 | 识别你在写代码、看视频、打游戏、听歌、开终端、做设计……分别有不同的陪聊 |
| 系统播报 | 电量低、内存高、GPU 高、磁盘满、断网、开机太久、多显示器 |
| 节日 | 春节、元宵、情人节、七夕、中秋、万圣、双十一、圣诞、生日等 20 余个 |
| 番茄钟 | 开始 / 工作中 / 休息结束 / 停止，四段台词 |
| 气泡 | 独立气泡窗口，不挡桌面 |
| OBS | 兼容上游的浏览器源与 OBS 同步（`start_obs.bat`） |

台词全部在 [`dialogues.json`](dialogues.json)，键名即触发条件（`click` / `ai_deepseek` / `holiday_qixi` / `pomodoro_work_end` …），共 482 条，改完重启即生效。

## 运行

需要 **Windows + Node.js 18 以上**。

```bash
npm install
npm start
```

## 打包

```bash
npm run build      # 生成安装包到 dist/
npm run pack       # 只生成免安装目录
```

## 目录

```
main.js                  Electron 主进程、窗口与进程扫描
pet-*.js                 桌宠各模块：核心 / 拖动 / 鼠标 / 气泡 / 运动 / 番茄钟 / 节日 / 系统 / 嫉妒
ai-jealousy-scanner.js   前台进程与 AI 关键词扫描
dialogues.json           全部台词
index.html / settings.html / bubble.html / actions.html   各窗口页面
lib/                     2.5D 立绘引擎（来自上游 Anime2.5DRig）
lib/vendor/face_mesh/    MediaPipe Face Mesh（Apache-2.0，离线版）
assets/                  图标与立绘 PSD
sample.psd / sample2.psd 上游自带的示例模型
```

## 依赖与致谢

- [Anime2.5DRig](https://github.com/hakoniwa/Anime2.5DRig) — MIT，Copyright (c) 2026 hakoniwa。2.5D 绑定与渲染的核心，本项目的立绘方案全部建立在其上。
- [MediaPipe Face Mesh](lib/vendor/face_mesh/NOTICE.md) — Apache-2.0，Copyright Google LLC。
- Electron / lunar-javascript / systeminformation。

## 许可

代码采用 **MIT**（见 [LICENSE](LICENSE)），上游原始许可证保留在 [LICENSE-Anime2.5DRig](LICENSE-Anime2.5DRig)。

**注意**：MIT 只覆盖代码。角色「璃光」、小说原文台词与相关美术资源**不在 MIT 范围内**，版权归原作者所有，仅限非商业同人使用。
