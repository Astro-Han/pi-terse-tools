# pi-terse-subagents（已弃置）

> 状态：2026-07 弃置。代码已移除，本文件是决策记录，避免日后重复走这条路。

## 当初想做什么

做 `pi-tidy-subagents` 的最小、进程内重新实现——一个 `subagent` 扩展，每个 child 用 `createAgentSession` 在父进程内跑独立 context，per-child model + thinking，全批 preflight，`{previous}` chain，有界输出。定位是"最小核心 + 路线图"（隔离 / steering / TUI 留待后做）。

经 12 轮 codex fresh-eye 审查 + 1 轮根因重构后，技术层面收敛（tsc 干净、30 测试、集成通过、最后一次完整审查 Gate PASS 无 P2）。

## 结论：没有价值，不继续

对**想马上用来拆任务的终端用户**，Pi 内置的 subagent 扩展更实用，而本方案在用户最感知的维度上全面落后：

| 维度 | 用户感知？ | 本方案 | 内置 |
|---|---|---|---|
| 进程隔离（child 不改父文件） | 高 | ❌ 共享 FS | ✅ 子进程 |
| 实时流式（看到 child 每步） | 高 | ❌ 只发 started/done | ✅ |
| TUI 渲染（工具调用/markdown/展开） | 高 | ❌ 纯文本 | ✅ |
| usage 统计（花多少钱） | 中 | ❌ | ✅ |
| project agents | 中 | ❌ 故意不做 | ✅ |
| preflight 零部分启动 | 低（用户一般传有效参数） | ✅ | ❌ |
| 输出有界 + cause 保真 | 低（隐蔽） | ✅ | 部分 |
| 安全默认（只 user agents） | 因人而异 | ✅ | 可配置 |

本方案的优势集中在用户**几乎不直接感知**的正确性/安全纯度；用户感知的隔离/体验/成本维度要么没做要么更差。砍掉进程隔离换"进程内零开销"，对跑几十秒的子 agent 几乎不构成感知差异。**用不感知的维度去换感知的维度，方向就错了。**

## 教训

1. **先问"用户感知什么"，再决定优化方向。** 终端用户价值由感知维度（隔离/体验/成本）决定，不由正确性纯度决定。本方案从"最小正确基座"出发，把精力投在用户不感知的边界处理上。

2. **codex fresh-eye 审查要设止损点。** 同一类问题（"present-but-invalid 输入绕过 fail-closed"）连续 4 轮撞同一 seam 时就该 reassess 而非继续 patch——后几轮修的是 codex 才能构造的极端畸形输入（poisoned `toString`、混合类型数组、UTF-16 vs UTF-8 字节预算），真实用户根本不会传。边际价值递减到接近零，是过度工程。该在用户第一次问"为什么反复无法收敛"时就停。

3. **"最小核心 + 路线图"是个陷阱**，如果路线图里的东西（隔离/TUI/steering）才是用户价值的来源，那"最小核心"本身没有独立终端用户价值——它只是个未完成的半成品。要么把路线图做完，要么承认它是给 fork 者的基座而非给用户的产品。

## 给日后的话

如果再考虑进程内 subagent：**先做进程隔离（worktree）和流式体验**，这两样才是用户价值所在；preflight 严格度和输出 cap 是锦上添花，不是卖点。Pi 0.80.6 的 `prepareArguments` 在 `Value.Convert` 前运行、`createAgentSession` 可直传 model 对象、`.pi/agents` 不被 project-trust 覆盖——这些是当时摸清的、对未来 Pi 扩展开发有参考价值的技术点，此处不展开。