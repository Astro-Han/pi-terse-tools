# pi-terse-tools

把 pi 的每个工具调用压缩成紧凑的两行块：第一行意图，第二行结果摘要。

```
edit  确认 reasoning 能在调用时显示
  src/index.ts → +6/-3
bash  跑类型检查
  npx tsc --noEmit → ✓
read  查看模型注册表
  docs/models.md → 24 lines
```

按 `C-o` 展开任意块查看完整输出、diff 或写入内容。

## 安装

```bash
pi install npm:pi-terse-tools
```

或临时试运行一次：

```bash
pi -e npm:pi-terse-tools
```

## 做了什么

pi 默认的工具输出很冗长，占满整个对话。这个扩展把七个内置工具（read、write、edit、bash、grep、find、ls）重新渲染成紧凑的两行块：

- **第一行** — 工具名 + 模型提供的一句话 `reasoning`（说明为什么调用，不重复参数）。
- **第二行** — 目标（路径、命令、模式）+ 带颜色的结果摘要（行数、匹配数、退出码、diff 计数）。

保留了原生工具的背景和 padding，成功（绿色）和失败（红色）状态一眼可辨。长行用省略号截断，同时保留结果尾部可见。

## reasoning 参数

每个工具新增一个必填的 `reasoning` 字符串参数。模型用对话语言一句话说明调用意图。简单调用可传空字符串，此时第一行回退为显示目标。`reasoning` 在执行前会被剥离，不会传给底层工具。

## 致谢

灵感来自 Mikey O'Brien 的 [pi-tidy-tools](https://github.com/mikeyobrien/pi-tidy-tools)。本项目是独立的精简重实现，专注于输出压缩。

## 许可证

MIT