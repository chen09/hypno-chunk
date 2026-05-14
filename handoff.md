# Handoff

## Status
READY TO CONTINUE

## Original Goal
根据用户要求，梳理本项目的关键知识点，并将应进入 handoff 的内容完整纳入；若已有内容则进行结构化整理，便于后续 agent 无上下文接力。

## Current State
- Confirmed fact with evidence: 项目根目录此前不存在 `handoff.md`（通过文件匹配检查，未返回该文件）。
- Confirmed fact with evidence: `AGENTS.md` 明确为跨文档安全/运维的 SSOT，且冲突时以其为准（`AGENTS.md`）。
- Confirmed fact with evidence: 生产安全硬约束已文档化：`127.0.0.1:3000` loopback-only、Docker 日志轮转与容器加固项必须保留（`AGENTS.md`, `README.md`, `DEPLOYMENT.md`, `web/README.md`）。
- Confirmed fact with evidence: 数据可追溯文件是强制要求：`data/2_audio_output/output_input_mapping.csv` 与 `data/2_audio_output/output_input_mapping.md`（`AGENTS.md`, `README.md`, `pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`, `NOVEL_AUTOPILOT_HANDOFF.md`）。
- Confirmed fact with evidence: Novel autopilot 为“一条命令 + checkpoint 可恢复”，含长音频分片（<=90 分钟）、部署与线上验收（`pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`, `NOVEL_AUTOPILOT_HANDOFF.md`, `README.md`）。
- Confirmed fact with evidence: 英语学习内容策略（`英语学习` 分类）要求“词汇/短句主导 + 长句按意群拆分 + EN/CN 交替”，并强调 `Common Sentence Pattern`、`News Functional Sentence` 类型（`AGENTS.md`, `skills/english-news-learning/SKILL.md`, `README.md`）。
- Confirmed fact with evidence: 关键知识文档已识别：`README.md`, `AGENTS.md`, `DEPLOYMENT.md`, `PROMPT_GUIDE.md`, `NOVEL_AUTOPILOT_HANDOFF.md`, `pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`, `skills/english-news-learning/SKILL.md`, `web/README.md`, `fail2ban/README.md`, `fail2ban/SUDO_CONFIG.md`, `ENGLISH_LEARNING_EXTERNAL_REFERENCES.md`。
- Confirmed fact with evidence: 2026-05-04 已发布小说源 `kO6Z5JG1Ivw`（标题基名：`日进斗金，我在小吃店通异界（完结）`），自动切为 20 段并完成上传、部署、线上校验（`pipeline/checkpoints/kO6Z5JG1Ivw.json` 与运行终端日志）。
- Confirmed fact with evidence: 新增发布条目已写入 `track_names.json` 和 `output_input_mapping.csv/.md`，文件名为 `kO6Z5JG1Ivw_part01..20_merged_final.mp3`（`data/2_audio_output/track_names.json`, `data/2_audio_output/output_input_mapping.csv`）。
- Confirmed fact with evidence: 2026-05-14 英语学习详情页与 canonical 新闻音频修复已发布到生产；`JDlyj1G36qs_merged_final.mp3` 在 `/api/files` 可见，详情页 `/learn/JDlyj1G36qs_merged_final.mp3` 返回 200，音频支持 Range 206，容器健康且仅绑定 `127.0.0.1:3000`。
- Confirmed fact with evidence: 2026-05-14 最新 news mobile segmentation 修复已发布到生产；`JDlyj1G36qs_merged_final.srt/.bilingual.json` 均为 45 段，英文单段最长 97 字符，中文单段最长 35 字符，SRT 不含中文；生产 Chrome 静音播放验证通过，字幕 active segment 和黄色当前词高亮出现，未发现 `Issue` badge。
- Confirmed fact with evidence: 2026-05-14 生产英语学习列表中当前仅有两条 news-like 条目：`JDlyj1G36qs_merged_final.mp3` 与 `y_a6kBnsgN4_new_merged_final.mp3`；`y_a6kBnsgN4` 已重生成并发布，开头不再读 `Full News Pass` 标题，新闻正文 bilingual sidecar 36 条，后续词汇/中文练习字幕仍可在详情页继续显示。
- Confirmed fact with evidence: 2026-05-14 三条问题英语学习发布项已从生产列表移出并归档到 `/var/www/hypnochunk/data/2_audio_output/.archive-20260514-problem-learning/`：`ZmGxBtpejG4_part01_merged_final.mp3`、`MCsCvYCU2nc_part01_merged_final.mp3`、`o1VxetMgFOQ_part01_merged_final.mp3/.srt/.words.json`；本地对应文件归档在 `data/2_audio_output/.archive-20260514-problem-learning/`。
- Assumption: 用户所说“所有知识点”主要指“可执行的项目知识与规则”，不包含历史里程碑和一次性修复记录全文搬运；历史类文档按参考资料处理。

## Knowledge Index
- Ownership Mode: Solo now, Multi-Agent ready
  - Current default: `Owner = Solo Maintainer (You)`
  - Future switch rule: 当引入多 agent 协作时，保持主题不变，仅把 `Owner` 替换为具体角色/人名（如 `Agent-A (Pipeline)`, `Agent-B (Web)`），并在 `Recent Progress` 记录切换日期。
- Theme: 安全与运维基线（SSOT）
  - Priority: P0 (Critical)
  - Owner: Solo Maintainer (You)
  - Source: `AGENTS.md`, `DEPLOYMENT.md`, `README.md`, `web/README.md`
  - Notes: 端口 loopback-only、容器加固、日志轮转、冲突时以 `AGENTS.md` 为准。
- Theme: 生产部署与故障恢复
  - Priority: P0 (Critical)
  - Owner: Solo Maintainer (You)
  - Source: `DEPLOYMENT.md`, `pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`, `NOVEL_AUTOPILOT_HANDOFF.md`
  - Notes: `./deploy.sh` 是标准入口；容器名冲突有已知恢复命令；上线后必须做主页与 `/api/files` 验证。
- Theme: 数据可追溯映射（发布强制）
  - Priority: P0 (Critical)
  - Owner: Solo Maintainer (You)
  - Source: `AGENTS.md`, `README.md`, `pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`
  - Notes: 每次音频产物更新必须同步 `output_input_mapping.csv/.md`。
- Theme: Novel Autopilot 自动化与 checkpoint
  - Priority: P1 (High)
  - Owner: Solo Maintainer (You)
  - Source: `pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`, `NOVEL_AUTOPILOT_HANDOFF.md`, `README.md`
  - Notes: 一条命令执行、断点续跑、长音频分片（<=90 分钟）、失败回退 direct-audio path。
- Theme: 英语学习内容策略（`英语学习`）
  - Priority: P1 (High)
  - Owner: Solo Maintainer (You)
  - Source: `skills/english-news-learning/SKILL.md`, `AGENTS.md`, `PROMPT_GUIDE.md`, `README.md`
  - Notes: 词汇与短句优先；必须覆盖 `Common Sentence Pattern` 与 `News Functional Sentence`；长句按意群拆分并 EN/CN 交替。
- Theme: 提取 Prompt 模板体系（Type 1/2/3/4）
  - Priority: P2 (Medium)
  - Owner: Solo Maintainer (You)
  - Source: `PROMPT_GUIDE.md`
  - Notes: 根据内容类型选模板；长文本建议分段输入；JSON 输出结构受 pipeline 兼容约束。
- Theme: Web 播放器能力与接口
  - Priority: P2 (Medium)
  - Owner: Solo Maintainer (You)
  - Source: `web/README.md`
  - Notes: `/api/files` 扫描音频目录，`/api/audio/[...path]` 支持 Range 流式播放。
- Theme: Fail2Ban 与主机侧防护
  - Priority: P2 (Medium)
  - Owner: Solo Maintainer (You)
  - Source: `fail2ban/README.md`, `fail2ban/SUDO_CONFIG.md`, `DEPLOYMENT.md`
  - Notes: 包含 jail 规则、排障与误封处理；sudo 免密仅在受信任环境使用。
- Theme: 外部教学参考源
  - Priority: P3 (Low)
  - Owner: Solo Maintainer (You)
  - Source: `ENGLISH_LEARNING_EXTERNAL_REFERENCES.md`
  - Notes: 用于课程优化参考，不直接构成生产硬约束。

## Recent Progress
- 完成 handoff 模板读取并按模板字段落地（参考 `agent-continuity` 模板）。
- 盘点并阅读当前项目高信号知识文档，提炼出可持续接力所需知识点与证据来源。
- 新建并结构化本 `handoff.md`，将跨文档规则集中，避免后续 agent 在多文档间重复搜索。
- 新增 `Knowledge Index`（主题/优先级/责任角色），用于后续增量维护与快速分派。
- 完成一次 novel 直发版：从候选源筛选到 autopilot 全链路执行，产出 20 个 `kO6Z5JG1Ivw_partXX_merged_final.mp3` 并通过生产验证。
- 2026-05-14 接到执行模板后按强制顺序读取 `AGENTS.md`、`handoff.md`、`README.md`、`DEPLOYMENT.md`、novel/English runbook；当前任务字段仍为占位符（`[TASK_GOAL]`、`[novel | english-learning]`、`[URL or empty]`），未发现明确待续跑 checkpoint，因此未进行任意内容发布。
- 2026-05-14 完成英语学习详情页本地实现与验证：新增 `/learn/[filename]` 长文阅读页，顶部播放器可见，默认英文字幕跟随，支持双语切换；修复 `AudioPlayer` 的 `timeupdate` 绑定时序，真实点击播放后 `currentTime` 可增长，seek 到 25s/120s 时字幕分别滚动到对应段落。
- 2026-05-14 修复新闻学习音频生成问题：`Full News Pass` 的阶段说明不再读出，英文缩写如 `U.S.` / `Adm.` 不再错误断句，Edge TTS 503/超时等错误增加重试；已重新生成并覆盖 `JDlyj1G36qs_merged_final.mp3/.srt/.words.json`，旧 canonical 三件套备份在 `data/2_audio_output/.backup-20260514-canonical-news-fix/`。
- 2026-05-14 本地发布前验证通过：`npm run lint`、`npx tsc --noEmit`、`npm run build`、`python3 -m py_compile pipeline/src/generator.py pipeline/process_text_to_json.py`；Next.js Dev Tools 红色 `1 Issue` 由 Chrome 扩展注入根节点 class 触发，已通过根布局 `suppressHydrationWarning` 消除。
- 2026-05-14 完成 git 与生产发版：提交并推送 `d37cd44 Add English reading detail playback`，GitHub Actions Docker Build and Push run `25815973865` 成功；上传 `JDlyj1G36qs_merged_final.mp3/.srt/.words.json` 到 `/var/www/hypnochunk/data/2_audio_output/`，执行 `ssh ubuntu@133.125.45.147 "cd ~/hypnochunk && ./deploy.sh"`，发布镜像 digest `sha256:8bd6b203f1435741ae57fc806d2c6bd392d3468b87518f63890322d3f66e6c28`。
- 2026-05-14 生产验收通过：`https://hypnochunk.com` 返回 200，`/learn/JDlyj1G36qs_merged_final.mp3` 返回 200，`/api/files` 包含 `JDlyj1G36qs_merged_final.mp3` 且 displayName 为 `Middle East Crisis - Improve Your English Vocabulary with the News`；`/audio/JDlyj1G36qs_merged_final.mp3` 返回 200 且 Range 返回 `206 audio/mpeg 1024`；生产 SRT 首句为 `FRANKFURT, Germany (AP) — The U.S. Navy’s sea blockade against Iran appears to be working.`；`words.json` 含 1983 个词级时间点；容器状态 `healthy`，端口绑定 `127.0.0.1:3000`。
- 2026-05-14 纠正最新 news 详情页策略：长篇新闻 article 音频只读英文，中文不再作为 spoken subtitle；生成 `JDlyj1G36qs_merged_final.bilingual.json` 作为英文时间轴上的中文解释，详情页默认双语，英文主行下方显示较小中文解释并跟随英文 cue 滚动。重新生成 `JDlyj1G36qs_merged_final.mp3/.srt/.words.json/.bilingual.json`，其中音频时长约 185.501s，SRT 不含中文，双语 sidecar 21 条，words 469 条。
- 2026-05-14 纠正版本已发布：提交并推送 `33c6e2c Make news reading bilingual on English timing`，GitHub Actions Docker Build and Push run `25837253841` 成功；上传四个 production artifacts，执行 `ssh ubuntu@133.125.45.147 "cd ~/hypnochunk && ./deploy.sh"`，发布镜像 digest `sha256:7a3093131522232a269fc493b3fc7212d0fc7ee9169e80070f21063077c97fef`。生产验收：homepage 200，详情页 200，audio Range `206 audio/mpeg 1024`，`/api/files` 显示 `JDlyj1G36qs_merged_final.mp3` size `742509`，SRT 无 CJK，`.bilingual.json` 首条中英对正确，容器 `healthy` 且端口 `127.0.0.1:3000`。
- 2026-05-14 修复最新 news 手机阅读问题：`Full News Pass` 生成时按英文句号/引号、逗号/分号/冒号与从句边界切成 mobile-sized cue；长篇 news 仍只朗读英文一次，中文只作为英文时间轴上的解释显示。重新生成 `JDlyj1G36qs_merged_final.mp3/.srt/.words.json/.bilingual.json`，音频时长约 209.59s，SRT 45 条且无 CJK，双语 sidecar 45 条，words 469 条，最长英文 97 字符，最长中文 35 字符。
- 2026-05-14 增强详情页当前词高亮：由浅蓝框改为显式黄色填充、橙色下划线和深橙外框，并加 `data-active-word="true"` 便于测试。生产 Chrome/CDP 验证：`https://hypnochunk.com/learn/JDlyj1G36qs_merged_final.mp3` 静音播放可推进到 `2.11s`，active subtitle segment 出现，当前词高亮出现，`Issue` badge 计数为 0；截图证据 `/private/tmp/hypnochunk_mobile_news_cdp_check.png`。
- 2026-05-14 清理问题英语学习发布项：本地和生产均把 `ZmGxBtpejG4_part01_merged_final.mp3`、`MCsCvYCU2nc_part01_merged_final.mp3`、`o1VxetMgFOQ_part01_merged_final.mp3/.srt/.words.json` 移入隐藏归档目录；`track_names.json` 删除 3 条，`output_input_mapping.csv` 删除 3 条，`output_input_mapping.md` 无对应行。生产 `/api/files` 验证三者均不再出现。
- 2026-05-14 完成代码提交、CI 与生产部署：提交并推送 `be20fa9 Tighten news reading subtitles`，GitHub Actions Docker Build and Push run `25864629260` 成功；上传更新后的 `JDlyj1G36qs` 四件套、`track_names.json`、`output_input_mapping.csv/.md`，执行 `ssh ubuntu@133.125.45.147 "cd ~/hypnochunk && ./deploy.sh"`。随后提交并推送 handoff 记录 `58e4c3b Record news reading mobile release`，Docker Build and Push run `25864937017` 成功，并再次部署对齐 final `latest` 镜像 digest `sha256:b44c4bae98b58eb4072ec1ae25ed73cb9e514552732e8db672c837e75318f6e1`。最终生产验收：homepage 200，详情页 200，audio Range `206 audio/mpeg 1024`，`/api/files` 显示 `JDlyj1G36qs_merged_final.mp3` size `838893`，三条问题音频均不在 `/api/files`，双语 sidecar 45 条，容器 `healthy` 且端口 `127.0.0.1:3000`。
- 2026-05-14 复查生产英语学习列表后修复第二条 news-like 内容：`y_a6kBnsgN4_new_merged_final.mp3` 原先仍为旧台本，SRT 第一条是 `Full News Pass • Verbatim Paragraph Flow`，SRT 含新闻中文朗读且无 `.bilingual.json`。已用 `data/1_extracted_json/y_a6kBnsgN4_new_merged_with_cn.json` 重生成并上传四件套；新 SRT 207 条，首条为 `President Donald Trump said the U.S. will blockade the Strait of Hormuz`，first CJK index 为 38（后续词汇模块），新闻 sidecar 36 条，最长英文 98、最长中文 50，words 1226 条。
- 2026-05-14 修复混合 news/vocabulary 详情页：`ReadingSubtitleView` 现在把 `.bilingual.json` sidecar 覆盖的新闻正文段与未覆盖的 SRT 段合并排序，避免存在 sidecar 时隐藏后续词汇/中文练习字幕；active entry 也改为按当前真实发声行选择。提交并推送 `8cc44aa Merge reading sidecars with remaining subtitles`，Docker Build and Push run `25866211865` 成功，部署镜像 digest `sha256:56a7d685aed2851b39f4b0d54d98c76b2a7e3da9d6618aa6dbe6510dcbc56a2d`。生产验收：英语学习 68 条，news-like 仅 2 条；两条音频 Range 均 `206 audio/mpeg 1024`，详情页 200，Chrome/CDP 静音播放两条均推进到约 8.96s，Issue badge 为 0；`y_a6kBnsgN4` seek 到约 180s 后可见 `blockade (noun & verb)`、中文解释与当前词高亮。
- 2026-05-15 新增一篇当天 news 英语学习素材：选题为 Trump-Xi Beijing meeting / Taiwan issue，主来源 AP `https://apnews.com/article/5d26e536240b881b06c26cd2be9ba632`，交叉参考中国外交部英文稿 `https://www.mfa.gov.cn/mfa_eng/xw/zyxw/202605/t20260514_11910330.html`。为版权稳妥，课件正文使用原创英文 news brief，不整段复刻来源文本；JSON 源文件为 `data/1_extracted_json/news_20260515_trump_xi_taiwan.json`。
- 2026-05-15 完成本地生成与验证：输出 `news_20260515_trump_xi_taiwan_merged_final.mp3/.srt/.words.json/.bilingual.json`，音频约 836.76s，SRT 180 条，Full News Pass 前 18 条只含英文，第一条中文 SRT 在第 20 条词汇模块；双语 sidecar 18 条，最长英文 85 字符、最长中文 49 字符，words 877 条。内容结构：news 长文只读英文并跟随英文双语字幕；后续词汇/短句/句型/functional/long split 继续使用 `EN slow -> CN -> EN fast`。
- 2026-05-15 完成 metadata、上传、部署与生产验收：`track_names.json` 插入新英语学习条目到 index 88，`output_input_mapping.csv/.md` 已登记来源；上传 7 个文件到 `/var/www/hypnochunk/data/2_audio_output/` 后执行 `ssh ubuntu@133.125.45.147 "cd ~/hypnochunk && ./deploy.sh"`。生产验证：homepage 200，详情页 200，audio Range `206 audio/mpeg 1024`，`/api/files` 共 136 条且包含新文件 size `3347469`，生产 sidecar 18 条且 max EN/CN 为 85/49，容器 `healthy` 且端口仍为 `127.0.0.1:3000->3000/tcp`。
- 2026-05-15 生产播放验证：用 headless Chrome/CDP 静音打开 `https://hypnochunk.com/learn/news_20260515_trump_xi_taiwan_merged_final.mp3`，真实点击播放器后 `currentTime` 推进到 `3.09s`，active segment 为 `A high-profile meeting between Donald Trump...`；seek 到约 `83.85s` 后 active segment 为 `You will also hear policy remains unchanged and avoid confrontation...`；补测确认 `data-active-word="true"` 当前词高亮出现；结束时已执行 `audio.pause(); audio.currentTime = 0`。

## Next Minimal Step
下一次英语学习内容生产前，优先区分内容类型：词汇/词组/惯用句继续用 `EN slow -> CN -> EN fast`；长篇 news/article 只朗读英文一次，并生成 mobile-sized bilingual sidecar，让字幕跟随英文时间轴。

## Next 3 Steps
1. 对照 `README.md` 与 `AGENTS.md`，核查是否新增关键规则未同步进本 handoff。
2. 若 pipeline 或部署流程变更，先更新 `AGENTS.md`（SSOT），再更新本 handoff 的对应条目与证据路径。
3. 在下一次重大任务完成后追加“Recent Progress”和“Do Not Retry Without New Evidence”，保持可恢复性。

## Unfinished Work
### High
- 建立“文档变更 -> handoff 同步”例行检查点；依赖：后续变更提交；验证：`handoff.md` 中知识索引与当前文档一致。

### Medium
- 为 `handoff.md` 增加更细的“运行命令速查”（仅保留高频命令）；依赖：确认团队偏好；验证：新 agent 能在 1 分钟内定位执行入口。

### Low
- 将历史文档（如 milestone/progress）压缩成一行“历史参考索引”；依赖：是否需要长期保留；验证：不影响当前执行链路。

## Blockers
- None known after the 2026-05-14 English-learning detail-page release.

## Do Not Retry Without New Evidence
- 不要把“全仓所有文档全文搬运到 handoff”作为默认策略：会造成 handoff 臃肿、难以续跑。只有在出现新执行约束/新故障模式/新验收门槛时才增量写入。
- 不要绕过 `AGENTS.md` 直接改写安全基线（端口暴露、日志轮转、容器加固）；若需变更必须先在 SSOT 说明依据。

## Files And Artifacts
- `handoff.md`: 当前接力文件，已按模板重建并整理核心知识点（已完成）。
- `AGENTS.md`: 安全/运维与 handoff 规则 SSOT（已确认）。
- `README.md`: 项目结构、CI/CD、主流程与文档索引（已确认）。
- `DEPLOYMENT.md`: 生产部署/Fail2Ban/故障排查执行细节（已确认）。
- `pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`: novel autopilot 运行与恢复要点（已确认）。
- `NOVEL_AUTOPILOT_HANDOFF.md`: novel 专项接力提示与恢复策略（已确认）。
- `skills/english-news-learning/SKILL.md`: 英语学习内容生产标准（已确认）。
- `PROMPT_GUIDE.md`: 各类提取 prompt 模板（已确认）。
- `web/README.md`: Web 播放器侧关键能力与约束（已确认）。
- `fail2ban/README.md`: Fail2Ban 防护规则与运维命令（已确认）。
- `fail2ban/SUDO_CONFIG.md`: sudo 免密配置与回滚注意事项（已确认）。
- `ENGLISH_LEARNING_EXTERNAL_REFERENCES.md`: 外部学习参考源与复用建议（已确认）。

## Decisions
- Decision: 以“可执行知识点 + 证据路径”为 handoff 主体，不做大段原文复制。
  - Reason: 降低后续 agent 的阅读负担，提升接力速度与准确性。
  - Evidence: 当前核心规则已可由少量高信号文档覆盖（见 Files And Artifacts）。

- Decision: 安全/运维规则冲突时统一回到 `AGENTS.md`，其他文档仅保留摘要或操作细节。
  - Reason: 避免多文档漂移造成执行偏差。
  - Evidence: `AGENTS.md` 已声明 SSOT 与冲突处理优先级。

- Decision: 英语学习策略默认采用“词汇/短句主导 + 长句拆分 + EN/CN 交替”的结构化输出。
  - Reason: 与现有生产经验和内容政策一致，便于稳定生成可学习音频。
  - Evidence: `AGENTS.md`, `skills/english-news-learning/SKILL.md`, `README.md`。

## Assumptions
- Assumption: 当前用户需求重点是“整理项目知识并可继续维护”，不是立即执行新的 pipeline 任务。
  - Why it is plausible: 用户指令聚焦 handoff 内容整理。
  - How to verify: 用户若要求“继续跑任务”，再补充执行上下文与命令结果段落。

- Assumption: 当前无需新增代码修改，仅需文档层 handoff 重构。
  - Why it is plausible: 请求对象是知识点归档与整理。
  - How to verify: 若用户后续提出“按该 handoff 执行任务”，再进入代码/命令层更新。
- Assumption: 当前是个人项目，默认责任人均为同一维护者。
  - Why it is plausible: 用户明确说明“现在是个人项目”。
  - How to verify: 若后续出现协作者，再把 `Knowledge Index` 的 `Owner` 按人名拆分。
- Assumption: 未来可能采用多 agent 协作，但当前不启用并行分工执行。
  - Why it is plausible: 用户明确表示“为了可能会是多 agent 协作，但是现在还不是”。
  - How to verify: 当你明确下达“开始多 agent 协作”指令时，更新 `Owner`、`Next 3 Steps` 的责任分配，并追加一条迁移记录到 `Recent Progress`。

## Quick Resume
先读 `AGENTS.md`（SSOT）确认安全与运维基线，再读本 `handoff.md` 的 `Current State`、`Blockers` 和 `Files And Artifacts`。如果只是维护知识索引，按 `Next Minimal Step` 做增量同步；如果要执行 novel 或英语学习任务，先确认本轮任务已给出实际 content type 和目标来源，再跳到对应 runbook（`pipeline/NOVEL_AUTOPILOT_RUNBOOK.md`、`skills/english-news-learning/SKILL.md`）并把执行结果回写到本 handoff 的 `Recent Progress`。
