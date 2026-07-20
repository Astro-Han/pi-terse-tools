# pi-terse-tools

Compress every pi tool call into a tight two-line block: readable input on line 1, result summary on line 2.

```
edit  src/index.ts
  +6/-3
bash  npx tsc --noEmit
  ✓
read  docs/models.md
  24 lines
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

- **Line 1** — tool name + its input in a readable form (path, command, or search query).
- **Line 2** — a colored result summary (✓ / ✗ exit N / lines / matches / diff counts).

The native tool background and padding are preserved, so success (green ✓) and error (red ✗) states still read at a glance. Long lines truncate cleanly with an ellipsis while keeping the leading summary visible.

## Protocol transparency

This extension only changes rendering. It preserves each built-in tool's native parameter schema and passes its arguments through without adding UI metadata, so installing it does not make tool calls more expensive or fragile for the model.

## Acknowledgements

Inspired by [pi-tidy-tools](https://github.com/mikeyobrien/pi-tidy-tools) by Mikey O'Brien. This is an independent, minimal reimplementation focused on output compression.

## License

MIT
