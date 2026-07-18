# pi-terse-tools

Compress every pi tool call into a tight two-line block: intent on line 1, result summary on line 2.

```
edit  confirm reasoning renders during the call
  +6/-3 src/index.ts
bash  run the typecheck
  ✓ npx tsc --noEmit
read  check the model registry
  24 lines docs/models.md
```

Expand any block with `C-o` to see the full output, diff, or written content.

## Install

```bash
pi install npm:pi-terse-tools
```

Or try it for one run:

```bash
pi -e npm:pi-terse-tools
```

## What it does

Pi's default tool output is verbose and fills the transcript. This extension re-renders the seven built-in tools (read, write, edit, bash, grep, find, ls) as compact two-line blocks:

- **Line 1** — tool name + a one-sentence `reasoning` the model provides (the *why*, not the *what*).
- **Line 2** — a colored result summary (✓ / ✗ exit N / lines / matches / diff counts) + the target (path, command, pattern).

The native tool background and padding are preserved, so success (green ✓) and error (red ✗) states still read at a glance. Long lines truncate cleanly with an ellipsis while keeping the leading summary visible.

## Reasoning parameter

Each tool gets a required `reasoning` string parameter. The model states the call's purpose in one sentence using your conversation language. Simple calls may pass an empty string; the block then falls back to showing the target on line 1. The `reasoning` is stripped before execution, so it never reaches the underlying tool.

## Acknowledgements

Inspired by [pi-tidy-tools](https://github.com/mikeyobrien/pi-tidy-tools) by Mikey O'Brien. This is an independent, minimal reimplementation focused on output compression.

## License

MIT