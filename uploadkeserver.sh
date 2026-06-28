#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' 

echo -e "${CYAN}==================================================${NC}"
echo -e "${BLUE}  [upload ke server cihuyy]${NC}"
echo -e "${CYAN}==================================================${NC}"
echo "Pilih:"
echo "1) Frontend"
echo "2) Backend"
echo "3) semua wae"
read -p "Masukkan pilihan (1/2/3): " PILIHAN

DEPLOY_FRONTEND=false
DEPLOY_BACKEND=false

case $PILIHAN in
    1)
        DEPLOY_FRONTEND=true
        ;;
    2)
        DEPLOY_BACKEND=true
        ;;
    3)
        DEPLOY_FRONTEND=true
        DEPLOY_BACKEND=true
        ;;
    *)
        echo -e "${RED}Pilihan tidak valid! Membatalkan eksekusi.${NC}"
        exit 1
        ;;
esac

# ==================================================
# KONFIGURASI SERVER & DIREKTORI
# ==================================================
SERVER_IP="192.168.5.205"
SERVER_USER="akane"
SERVER_PORT="2109"

# Konfigurasi Direktori Lokal
LOCAL_DIR_BACKEND="/media/daffa/CODE/backend-go-ftth/ftth-be"
LOCAL_DIR_FRONTEND="/media/daffa/CODE/backend-go-ftth/ftth-fe"

# Konfigurasi Direktori Server (Remote)
REMOTE_DIR_BACKEND="/home/akane/ftthapp/backend"
REMOTE_DIR_FRONTEND="/var/www/html/dist"
REMOTE_TEMP_FRONTEND="/home/$SERVER_USER/frontend_ftth"
# ==================================================

if [ "$DEPLOY_BACKEND" = true ]; then
    echo -e "\n${YELLOW}>>> DEPLOY BACKEND <<<${NC}"
    echo "1. Memulai Build Backend"
    cd "$LOCAL_DIR_BACKEND" || { echo -e "${RED}Direktori $LOCAL_DIR_BACKEND tidak ditemukan!${NC}"; exit 1; }
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o backend-go-ftth main.go

    if [ ! -f "backend-go-ftth" ]; then
        echo -e "${RED}File backend-go-ftth tidak ditemukan setelah build.${NC}"
        exit 1
    else
        echo -e "${GREEN}File backend-go-ftth berhasil di-build. Lanjut..${NC}"
    fi

    echo "2. Memulai copy file ke Server"
    rsync -avz --progress -e "ssh -p $SERVER_PORT" backend-go-ftth $SERVER_USER@$SERVER_IP:/home/$SERVER_USER

    echo "3. Konfigurasi Server & Restart Service"
    ssh -t -p $SERVER_PORT $SERVER_USER@$SERVER_IP "
        sudo mkdir -p $REMOTE_DIR_BACKEND &&
        sudo rm -f $REMOTE_DIR_BACKEND/backend-go-ftth &&
        sudo cp backend-go-ftth $REMOTE_DIR_BACKEND/ &&
        sudo systemctl restart backendmonitoring.service &&
        sudo systemctl status backendmonitoring.service --no-pager | head -n 10
    "

fi

if [ "$DEPLOY_FRONTEND" = true ]; then
    echo -e "\n${YELLOW}>>> DEPLOY FRONTEND <<<${NC}"
    echo "1. Memulai Build Frontend"
    cd "$LOCAL_DIR_FRONTEND" || { echo -e "${RED}Direktori $LOCAL_DIR_FRONTEND tidak ditemukan!${NC}"; exit 1; }
    
    # hapus folder lama biar ndak eror
    rm -rf dist
    
    npm run build
    
    if [ ! -d "dist" ]; then
        echo -e "${RED}Folder dist tidak ditemukan! Build frontend gagal.${NC}"
        exit 1
    else
        echo -e "${GREEN}Build frontend berhasil. Lanjut...${NC}"
    fi

    echo "2. Memulai copy file ke Server"
    ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_TEMP_FRONTEND"
    rsync -avz --progress --delete -e "ssh -p $SERVER_PORT" dist/ $SERVER_USER@$SERVER_IP:$REMOTE_TEMP_FRONTEND/

    echo "3. Pindahkan ke direktori publik ($REMOTE_DIR_FRONTEND)"
    ssh -t -p $SERVER_PORT $SERVER_USER@$SERVER_IP "
        sudo mkdir -p $REMOTE_DIR_FRONTEND &&
        sudo rm -rf $REMOTE_DIR_FRONTEND/* &&
        sudo cp -r $REMOTE_TEMP_FRONTEND/* $REMOTE_DIR_FRONTEND/ &&
        sudo chown -R www-data:www-data $REMOTE_DIR_FRONTEND &&
        sudo chmod -R 755 $REMOTE_DIR_FRONTEND &&
        sudo systemctl reload nginx
    "
    
    echo -e "${GREEN}✔ DEPLOY FRONTEND BERHASIL!${NC}"
    
    echo -e "kalau error Purge Cache dari Dashboard Cloudflare (Caching -> Configuration -> Purge Everything)"
fi

echo -e "\n${CYAN}==================================================${NC}"
echo -e "${GREEN}  cihuy!${NC}"
echo -e "${CYAN}==================================================${NC}"
