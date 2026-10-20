#!/bin/zsh
# 双击即可启动桌面版；日志写入 launcher.log
cd "$(dirname "$0")" || exit 1
LOG_FILE="launcher.log"

# Finder 双击时不会加载 shell 配置，补上常见的 Node 路径
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

echo "[$(date '+%F %T')] launcher started" > "$LOG_FILE"

if ! command -v npm >/dev/null 2>&1; then
  echo "[$(date '+%F %T')] npm not found" | tee -a "$LOG_FILE"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[$(date '+%F %T')] node_modules missing, running npm install" | tee -a "$LOG_FILE"
  npm install 2>&1 | tee -a "$LOG_FILE" || exit 1
fi

echo "[$(date '+%F %T')] running npm run dev" | tee -a "$LOG_FILE"
npm run dev 2>&1 | tee -a "$LOG_FILE"
