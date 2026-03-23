# claude-statusline

> Barra de status em tempo real para o Claude Code exibindo email, tipo de assento, uso da sessão e limites semanais — sempre visível na parte inferior do terminal.

![Platform](https://img.shields.io/badge/plataforma-macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/licença-MIT-green)
![Claude Code](https://img.shields.io/badge/Claude%20Code-compatível-orange)

---

## O que exibe

```
usuario@email.com (Premium) | Sessão: 57% · 1h4m | Semanal: 39% · 4d2h
```

| Campo | Cor | Descrição |
|---|---|---|
| Email | 🟡 Amarelo | Email da conta logada |
| Assento | 🟡 Amarelo | Tipo de assento: Premium ou Padrão |
| Sessão | 🔵 Ciano | Uso do limite de 5 horas + tempo para resetar |
| Semanal | 🟣 Magenta | Uso do limite de 7 dias + tempo para resetar |

> **Sessão** e **Semanal** só aparecem para usuários logados com assinatura Claude.ai Pro/Max/Team via `claude login`.

---

## Requisitos

- [Claude Code](https://claude.ai/code) CLI instalado e logado
- `bash`
- `jq`
- `curl`
- `python3`

---

## Instalação

```bash
git clone https://github.com/SergioTEC/claude-statusline.git
cd claude-statusline
node install.js
```

O instalador:
1. Copia `statusline.sh` e `fetch-usage.sh` para `~/.claude/`
2. Faz backup do seu `~/.claude/settings.json`
3. Injeta a config `statusLine` globalmente

Abra qualquer projeto no Claude Code — a barra de status aparece automaticamente.

---

## Desinstalar

```bash
node uninstall.js
```

Remove os scripts e restaura o `settings.json` original.

---

## Suporte de plataformas

| Plataforma | Status | Método de autenticação |
|---|---|---|
| macOS | ✅ Suportado | macOS Keychain (`security`) |
| Linux | ✅ Suportado | `~/.claude/.credentials.json` |
| Windows (WSL) | ⚠️ Deve funcionar | `~/.claude/.credentials.json` |
| Windows (nativo) | ❌ Não suportado | — |

### Autenticação

Nenhuma configuração necessária. Os scripts leem suas credenciais OAuth automaticamente:

- **macOS** — lê do Keychain do sistema (entrada `Claude Code-credentials`), criado automaticamente pelo `claude login`
- **Linux / WSL** — lê de `~/.claude/.credentials.json`, criado automaticamente pelo `claude login`

Se você usa o Claude Code apenas com chave de API (sem `claude login`), os campos de sessão e semanal não aparecem.

---

## Como funciona

O Claude Code suporta a configuração `statusLine` no `~/.claude/settings.json` que executa um comando shell a cada atualização e exibe o resultado na parte inferior do terminal.

`statusline.sh` lê o JSON enviado pelo Claude Code e chama `fetch-usage.sh` para obter o uso do plano e email via API OAuth da Anthropic.

- **Sessão e Semanal**: cache em `/tmp/claude-usage-cache.json` por 60 segundos (máximo 1 chamada por minuto)
- **Email e Assento**: cache em `/tmp/claude-profile-cache.json` por 10 minutos

---

## Licença

MIT
