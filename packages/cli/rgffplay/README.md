# rgffplay

Music player that finds files by case-insensitive name via ripgrep and plays them with ffplay.

## Usage

```sh
rgffplay <name...>
```

Positional arguments form the search query.
Each word's first letter is converted to a case-insensitive bracket expression,
then joined with `*` wildcards to produce a ripgrep glob.

```sh
rgffplay sweet devil
# glob: *[Ss]weet*[Dd]evil*

rgffplay "Sweet Devil"
# glob: *[Ss]weet*[Dd]evil*
```

## How it works

1. Builds a glob pattern from the name words
2. Resolves the music directory from `$XDG_MUSIC_DIR` or `xdg-user-dir MUSIC`
3. Runs `rg --files -g <glob> <music_dir> --null` to find matching files
4. Plays matched files with `ffplay -loop 0 -nodisp` (loops indefinitely, no video window)

## Dependencies

- **ripgrep** (`rg`) for fast file search
- **ffplay** (from FFmpeg) for audio playback
- **xdg-user-dir** (optional) as fallback when `$XDG_MUSIC_DIR` is unset
