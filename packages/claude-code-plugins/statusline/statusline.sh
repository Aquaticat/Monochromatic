#!/bin/bash
input=$(cat)

used=$(echo "$input" | jq -r '
  (.context_window.current_usage // {}) |
  ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0) + (.output_tokens // 0))
')
total=$(echo "$input" | jq -r '.context_window.context_window_size // 0')

if [ "${used:-0}" -gt 0 ] 2>/dev/null && [ "${total:-0}" -gt 0 ] 2>/dev/null; then
  # Used is always <1M: fixed-width 7 chars
  if [ "$used" -ge 1000 ]; then
    used_fmt=$(printf "%3d,%03d" "$((used / 1000))" "$((used % 1000))")
  else
    used_fmt=$(printf "    %3d" "$used")
  fi
  total_fmt=$(printf "%'d" "$total")

  RESET='\033[0m'
  if [ "$used" -ge 900000 ]; then
    COLOR='\033[37m'
  elif [ "$used" -ge 200000 ]; then
    COLOR='\033[35m'
  elif [ "$used" -ge 100000 ]; then
    COLOR='\033[33m'
  else
    COLOR=''
  fi

  if [ -n "$COLOR" ]; then
    printf '%b%s%b/%s\n' "$COLOR" "$used_fmt" "$RESET" "$total_fmt"
  else
    printf '%s/%s\n' "$used_fmt" "$total_fmt"
  fi
fi
