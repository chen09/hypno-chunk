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

## Next Minimal Step
执行一次 `handoff.md` 轻量校验：确认新增或变更知识文档时，是否同步更新本文件中的“Knowledge Index”与“Decisions”。

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
- Blocker: 当前执行任务缺少实际发布目标。
  - Likely cause: 上游发送的是任务模板，未替换 `TASK_GOAL`、内容类型、输入 URL/选源偏好、展示名/分类。
  - Impact: 不能安全地自动选择并发布任意 novel 或 English-learning 内容到生产。
  - Confidence: High
  - Possible workaround: 提供实际 content type 和 URL；如果无 URL，至少提供 content type、主题/频道偏好、display name/category、selection preference，然后按对应 runbook 执行。

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
