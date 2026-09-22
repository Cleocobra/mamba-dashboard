#!/usr/bin/env bash
# Bootstrap do SC em Alta em um servidor Linux limpo ou existente. Use DENTRO do VPS (via ssh):
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Cleocobra/mamba-dashboard/main/scemalta/deploy/bootstrap.sh)"
#
# Instala git se faltar, baixa (ou atualiza) o projeto em /opt/scemalta-src e roda o instalador.
# Variáveis opcionais: BRANCH (padrão main), DIR (padrão /opt/scemalta-src)
set -euo pipefail
BRANCH=${BRANCH:-main}
DIR=${DIR:-/opt/scemalta-src}
REPO=https://github.com/Cleocobra/mamba-dashboard.git

if [ "$(id -u)" != 0 ]; then echo "Rode como root (ou com sudo): sudo bash -c \"\$(curl -fsSL ...)\""; exit 1; fi
if ! command -v git >/dev/null 2>&1; then
  echo "instalando git…"
  if command -v apt-get >/dev/null; then apt-get update -qq && apt-get install -y -qq git curl ca-certificates
  elif command -v dnf >/dev/null; then dnf install -y git curl
  elif command -v yum >/dev/null; then yum install -y git curl
  elif command -v apk >/dev/null; then apk add --no-cache git curl bash
  else echo "não sei instalar o git nesta distribuição; instale e rode de novo."; exit 1; fi
fi

if [ -d "$DIR/.git" ]; then
  echo "atualizando $DIR (branch $BRANCH)…"
  git -C "$DIR" fetch -q origin "$BRANCH" && git -C "$DIR" checkout -q "$BRANCH" && git -C "$DIR" pull -q origin "$BRANCH"
else
  echo "baixando o projeto em $DIR (branch $BRANCH)…"
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR/scemalta"
exec bash deploy/install.sh
