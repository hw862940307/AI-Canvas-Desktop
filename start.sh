#!/bin/bash

# 设置标题
echo -e "\033[1;34m==========================================\033[0m"
echo -e "\033[1;32m   正在准备启动应用程序 (macOS/Linux)...\033[0m"
echo -e "\033[1;34m==========================================\033[0m"

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null
then
    echo "[错误] 请先安装 Node.js! (https://nodejs.org/)"
    exit 1
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "[状态] 正在安装依赖项，请稍候..."
    npm install
fi

echo -e "\033[1;34m==========================================\033[0m"
echo -e "\033[1;32m   请选择启动模式:\033[0m"
echo -e "\033[1;33m   [1] 浏览器模式 (http://localhost:3000)\033[0m"
echo -e "\033[1;33m   [2] 桌面窗口模式 (推荐)\033[0m"
echo -e "\033[1;34m==========================================\033[0m"

read -p "请输入选项 [1-2]: " choice

if [ "$choice" == "2" ]; then
    npm run desktop
else
    npm run dev
fi
