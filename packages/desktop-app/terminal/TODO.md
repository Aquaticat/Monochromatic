# Terminal TODO

## Fix severe input stutter

Typing in the terminal stutters extremely.
Investigate the input path from Slint key events through PTY writes and Ghostty rendering, then reduce latency at the user boundary.
