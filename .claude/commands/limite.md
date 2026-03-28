---
description: Envia status de uso do Claude por email para o PicoClaw WhatsApp agent
allowed-tools:
  - Bash
---

# /limite — Enviar Status de Uso (automatico)

Quando o usuario digitar `/limite`, execute imediatamente o script abaixo SEM perguntar nada. Os dados sao lidos automaticamente do cache do statusline.

## Execucao

Rode este script bash:

```bash
CACHE_DIR="${HOME}/.cache/claude-statusline"
PROFILE="${CACHE_DIR}/profile.json"
RATES="${CACHE_DIR}/ratelimits.json"

WEBHOOK_URL="https://claude-statusline-webhook.databutton.workers.dev"
WEBHOOK_TOKEN="4e2edb4cbc9cd19cd8cb53725e400fb8633cbf0949bd39e81117672eebffb814"

# Ler dados do cache
email=$(jq -r '.email // empty' "$PROFILE" 2>/dev/null)
tier=$(jq -r '.assento // empty' "$PROFILE" 2>/dev/null)
session=$(jq -r '.session_pct // "0"' "$RATES" 2>/dev/null)
weekly=$(jq -r '.weekly_pct // "0"' "$RATES" 2>/dev/null)
s_reset=$(jq -r '.session_resets // "0"' "$RATES" 2>/dev/null)
w_reset=$(jq -r '.weekly_resets // "0"' "$RATES" 2>/dev/null)

if [ -z "$email" ]; then echo "ERRO: cache de perfil vazio ($PROFILE)"; exit 1; fi

s_int=$(printf "%.0f" "$session" 2>/dev/null || echo "0")
w_int=$(printf "%.0f" "$weekly" 2>/dev/null || echo "0")

RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Authorization: Bearer $WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"session_pct\":$s_int,\"weekly_pct\":$w_int,\"tier\":\"${tier:-Padrao}\",\"session_resets\":\"$s_reset\",\"weekly_resets\":\"$w_reset\",\"model\":\"manual\"}")

echo "EMAIL: $email ($tier)"
echo "SESSAO: ${s_int}%"
echo "SEMANAL: ${w_int}%"
echo "---"
echo "$RESPONSE"
```

## Interpretar resultado

- Se a resposta contiver `"code": 200` → responder: **Status enviado!** EMAIL — Sessao X%, Semanal X%, Plano TIER
- Se `"unchanged"` → responder: **Ja enviado** — mesmo status, sem duplicata
- Se erro → mostrar o erro
