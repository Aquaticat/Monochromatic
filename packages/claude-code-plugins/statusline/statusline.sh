#!/bin/bash
input=$(cat)

model_name=$(echo "$input" | jq -r '.model.display_name // empty')

used=$(echo "$input" | jq -r '
  (.context_window.current_usage // {}) |
  ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0) + (.output_tokens // 0))
')
total=$(echo "$input" | jq -r '.context_window.context_window_size // 0')

# Extract rate limit data (available for Pro/Max subscribers after first API response)
rate_limits=$(echo "$input" | jq -r '
  .rate_limits // {} |
  {
    five_hour_pct: (.five_hour.used_percentage // -1),
    five_hour_resets: (.five_hour.resets_at // -1),
    seven_day_pct: (.seven_day.used_percentage // -1),
    seven_day_resets: (.seven_day.resets_at // -1)
  }
')
five_hour_pct=$(echo "$rate_limits" | jq -r '.five_hour_pct')
five_hour_resets=$(echo "$rate_limits" | jq -r '.five_hour_resets')
seven_day_pct=$(echo "$rate_limits" | jq -r '.seven_day_pct')
seven_day_resets=$(echo "$rate_limits" | jq -r '.seven_day_resets')

# Format relative time from epoch seconds to human-readable duration
format_relative_time() {
  local resets_at=$1
  local now
  now=$(date +%s)
  local diff=$(( resets_at - now ))
  if [ "$diff" -le 0 ]; then
    echo "now"
  elif [ "$diff" -lt 60 ]; then
    echo "${diff}s"
  elif [ "$diff" -lt 3600 ]; then
    echo "$(( diff / 60 ))m"
  elif [ "$diff" -lt 86400 ]; then
    local hours=$(( diff / 3600 ))
    local mins=$(( (diff % 3600) / 60 ))
    if [ "$mins" -gt 0 ]; then
      echo "${hours}h${mins}m"
    else
      echo "${hours}h"
    fi
  else
    local days=$(( diff / 86400 ))
    local hours=$(( (diff % 86400) / 3600 ))
    if [ "$hours" -gt 0 ]; then
      echo "${days}d${hours}h"
    else
      echo "${days}d"
    fi
  fi
}

# Format a single rate limit tier as "X% left (Yt)"
# Returns empty string if data is missing or remaining% is above the visibility threshold
format_rate_limit() {
  local pct=$1
  local resets_at=$2
  local threshold=${3:-50}

  # Skip if data not available
  if [ "$pct" = "-1" ] || [ "$resets_at" = "-1" ]; then
    return
  fi

  local remaining
  remaining=$(echo "$pct" | awk '{printf "%d", 100 - $1}')

  # Only show when remaining is at or below threshold
  if [ "$remaining" -gt "$threshold" ]; then
    return
  fi

  local time_left
  time_left=$(format_relative_time "$resets_at")

  local RESET='\033[0m'
  local COLOR
  if [ "$remaining" -le 10 ]; then
    COLOR='\033[31m'  # Red: critical
  elif [ "$remaining" -le 25 ]; then
    COLOR='\033[33m'  # Yellow: caution
  else
    COLOR='\033[32m'  # Green: comfortable
  fi

  printf '%b%d%% left%b (%s)' "$COLOR" "$remaining" "$RESET" "$time_left"
}

# Context window display
output=""
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
    output=$(printf '%b%s%b/%s' "$COLOR" "$used_fmt" "$RESET" "$total_fmt")
  else
    output=$(printf '%s/%s' "$used_fmt" "$total_fmt")
  fi
fi

# Append rate limit indicators (only visible when approaching limits)
# Show the more constrained tier; if both are visible, show both separated by a dot
five_hour_display=$(format_rate_limit "$five_hour_pct" "$five_hour_resets" 50)
seven_day_display=$(format_rate_limit "$seven_day_pct" "$seven_day_resets" 50)

SEP='    '

if [ -n "$five_hour_display" ] && [ -n "$seven_day_display" ]; then
  output="${output}${SEP}${five_hour_display} · ${seven_day_display}"
elif [ -n "$five_hour_display" ]; then
  output="${output}${SEP}${five_hour_display}"
elif [ -n "$seven_day_display" ]; then
  output="${output}${SEP}${seven_day_display}"
fi

if [ -n "$model_name" ]; then
  output="${model_name}${SEP}${output}"
fi

if [ -n "$output" ]; then
  printf '%b\n' "$output"
fi
