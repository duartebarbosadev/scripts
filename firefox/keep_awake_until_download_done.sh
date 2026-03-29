#!/usr/bin/env bash
# Mantém o Mac acordado enquanto houver downloads do Firefox (.part) na pasta Downloads.
# Uso: ./keep_awake_until_firefox_done.sh [pasta_downloads]
# Dica: se a tua pasta não for ~/Downloads, passa-a como 1º argumento.

set -euo pipefail

DOWNLOAD_DIR="${1:-$HOME/Downloads}"
POLL_SECS=10

# Se não estivermos a correr sob caffeinate, relança-nos sob caffeinate e sai.
if [[ "${1:-}" != "--__under_caff__" ]]; then
  exec caffeinate -dimsu "$0" --__under_caff__ "${DOWNLOAD_DIR}"
fi

# Daqui para baixo já está sob caffeinate.
DOWNLOAD_DIR="$2"  # vem do exec acima
echo "A manter acordado enquanto houver .part em: $DOWNLOAD_DIR"
echo "Para parar: Ctrl+C"

# Função: há ficheiros .part?
has_parts() {
  ls "${DOWNLOAD_DIR}"/*.part >/dev/null 2>&1
}

# Espera até não existirem .part
while has_parts; do
  sleep "${POLL_SECS}"
done

# Opcional: notificação quando terminar
if command -v osascript >/dev/null 2>&1; then
  osascript -e 'display notification "Downloads do Firefox concluídos." with title "Tudo pronto"'
fi

echo "Sem downloads ativos. A permitir o sono normal."

