#!/usr/bin/env bash
# Claude Code status line
# Displays token usage, model, cost, and plan limits in the terminal status bar.

export LC_NUMERIC=C

input=$(cat)

# ─── Fetch plan usage (session and weekly) ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
usage_data=$(bash "${SCRIPT_DIR}/fetch-usage.sh" 2>/dev/null)

# ─── Email + Assento (cache separado de 10min para evitar rate limit) ─────────
PROFILE_CACHE="/tmp/claude-profile-cache.json"
PROFILE_CACHE_MAX=600
email=""
assento=""
if [ -f "$PROFILE_CACHE" ]; then
  cache_age=$(( $(date +%s) - $(stat -c %Y "$PROFILE_CACHE" 2>/dev/null || echo 0) ))
  if [ "$cache_age" -lt "$PROFILE_CACHE_MAX" ]; then
    email=$(jq -r '.email // empty' "$PROFILE_CACHE" 2>/dev/null)
    assento=$(jq -r '.assento // empty' "$PROFILE_CACHE" 2>/dev/null)
  fi
fi
if [ -z "$email" ]; then
  creds=""
  [ -f "$HOME/.claude/.credentials.json" ] && creds=$(cat "$HOME/.claude/.credentials.json" 2>/dev/null)
  if [ -n "$creds" ]; then
    at=$(echo "$creds" | python3 -c "import sys,json;print(json.load(sys.stdin).get('claudeAiOauth',{}).get('accessToken',''))" 2>/dev/null)
    if [ -n "$at" ]; then
      profile_json=$(curl -s --max-time 3 "https://api.anthropic.com/api/oauth/profile" \
        -H "Authorization: Bearer ${at}" -H "anthropic-beta: oauth-2025-04-20" 2>/dev/null)
      email=$(echo "$profile_json" | jq -r '.account.email // empty' 2>/dev/null)
      tier=$(echo "$profile_json" | jq -r '.organization.rate_limit_tier // empty' 2>/dev/null)
      if echo "$tier" | grep -qi "max\|5x"; then
        assento="Premium"
      else
        assento="Padrão"
      fi
      if [ -n "$email" ]; then
        echo "{\"email\":\"$email\",\"assento\":\"$assento\"}" > "$PROFILE_CACHE"
      fi
    fi
  fi
fi

# Returns a human-readable countdown string for a UTC ISO 8601 timestamp
time_until_reset() {
  local resets_at="$1"
  local reset_ts
  reset_ts=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "${resets_at%%.*}" +%s 2>/dev/null || \
             date -d "$resets_at" +%s 2>/dev/null)
  local now_ts diff_mins
  now_ts=$(date +%s)
  diff_mins=$(( (reset_ts - now_ts) / 60 ))
  if [ "$diff_mins" -le 0 ]; then
    echo "now"
  elif [ "$diff_mins" -ge 1440 ]; then
    local d=$(( diff_mins / 1440 )) h=$(( (diff_mins % 1440) / 60 ))
    echo "${d}d${h}h"
  elif [ "$diff_mins" -ge 60 ]; then
    local h=$(( diff_mins / 60 )) m=$(( diff_mins % 60 ))
    echo "${h}h${m}m"
  else
    echo "${diff_mins}min"
  fi
}

# Current session usage (five_hour)
session_pct=$(echo "$usage_data" | jq -r '.five_hour.utilization // empty' 2>/dev/null)
session_str=""
if [ -n "$session_pct" ]; then
  session_int=$(printf "%.0f" "$session_pct")
  session_resets_at=$(echo "$usage_data" | jq -r '.five_hour.resets_at // empty' 2>/dev/null)
  session_time=$([ -n "$session_resets_at" ] && time_until_reset "$session_resets_at" || echo "")
  session_str="Sessão: ${session_int}%$([ -n "$session_time" ] && echo " · ${session_time}")"
fi

# Weekly limits (seven_day)
weekly_pct=$(echo "$usage_data" | jq -r '.seven_day.utilization // empty' 2>/dev/null)
weekly_str=""
if [ -n "$weekly_pct" ]; then
  weekly_int=$(printf "%.0f" "$weekly_pct")
  weekly_resets_at=$(echo "$usage_data" | jq -r '.seven_day.resets_at // empty' 2>/dev/null)
  weekly_time=$([ -n "$weekly_resets_at" ] && time_until_reset "$weekly_resets_at" || echo "")
  weekly_str="Semanal: ${weekly_int}%$([ -n "$weekly_time" ] && echo " · ${weekly_time}")"
fi

# ─── Parse context window data from Claude Code stdin ─────────────────────────
model=$(echo "$input" | jq -r '.model.display_name // "Unknown model"')
total_in=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
total_out=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')
total_tokens=$((total_in + total_out))
used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
ctx_tokens=$(echo "$input" | jq -r '
  (.context_window.current_usage.input_tokens // 0) +
  (.context_window.current_usage.output_tokens // 0) +
  (.context_window.current_usage.cache_creation_input_tokens // 0) +
  (.context_window.current_usage.cache_read_input_tokens // 0)
' 2>/dev/null)
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')

# Format numbers with k/M suffixes
fmt() {
  awk "BEGIN {
    n = $1
    if (n >= 1000000) printf \"%.1fM\", n/1000000
    else if (n >= 1000) printf \"%.1fk\", n/1000
    else printf \"%d\", n
  }"
}

ctx_int=$(printf "%.0f" "$used_pct")
cost_fmt=$(printf "%.2f" "$cost")

# ─── Build segments (colored + plain text for measuring) ─────────────────────
seg_count=0
add_seg() {
  seg_colored[$seg_count]="$1"
  seg_plain[$seg_count]="$2"
  seg_count=$((seg_count + 1))
}

if [ -n "$email" ]; then
  email_label="$email"
  [ -n "$assento" ] && email_label="${email} (${assento})"
  add_seg "$(printf "\033[0;33m%s\033[0m" "$email_label")" "$email_label"
fi
[ -n "$session_str" ] && add_seg "$(printf "\033[0;36m%s\033[0m" "$session_str")" "$session_str"
[ -n "$weekly_str" ] && add_seg "$(printf "\033[0;35m%s\033[0m" "$weekly_str")" "$weekly_str"

# ─── Detect terminal width ───────────────────────────────────────────────────
term_width=${COLUMNS:-0}
[ "$term_width" -eq 0 ] 2>/dev/null && term_width=$(stty size </dev/tty 2>/dev/null | awk '{print $2}')
[ -z "$term_width" ] || [ "$term_width" -eq 0 ] 2>/dev/null && term_width=$(tput cols </dev/tty 2>/dev/null)
[ -z "$term_width" ] || [ "$term_width" -eq 0 ] 2>/dev/null && term_width=200
# Claude Code UI has padding — subtract margin so we wrap before it truncates
term_width=$((term_width - 6))

# ─── Greedy line wrapping: fit as many segments as possible per line ──────────
sep=" | "
sep_len=3
output=""
line=""
line_len=0
first_on_line=true

for i in $(seq 0 $((seg_count - 1))); do
  plain="${seg_plain[$i]}"
  colored="${seg_colored[$i]}"
  seg_len=${#plain}

  if $first_on_line; then
    needed=$seg_len
  else
    needed=$((seg_len + sep_len))
  fi

  if ! $first_on_line && [ $((line_len + needed)) -gt "$term_width" ]; then
    # Current segment doesn't fit — start a new line
    [ -n "$output" ] && output="${output}\n"
    output="${output}${line}"
    line="$colored"
    line_len=$seg_len
    first_on_line=false
  else
    if $first_on_line; then
      line="$colored"
      line_len=$seg_len
      first_on_line=false
    else
      line="${line}${sep}${colored}"
      line_len=$((line_len + needed))
    fi
  fi
done

# Flush last line
[ -n "$line" ] && { [ -n "$output" ] && output="${output}\n${line}" || output="$line"; }

printf "%b" "$output"
