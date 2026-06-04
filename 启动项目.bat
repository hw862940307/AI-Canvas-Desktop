@echo off
TITLE NV Node Pro Launcher
echo ==================================================
echo   正在准备启动双内核画板应用程序...
echo ==================================================

:: 检查是否安装了 Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 系统检测到未安装 Node.js，或未将其加入环境变量!
    echo 请先在电脑中下载并安装 Node.js (推荐 LTS 版本): https://nodejs.org/
    pause
    exit /b
)

:: 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [状态] 正在为您自动配置国内极速镜像通道...
    call npm config set registry https://registry.npmmirror.com
    call npm config set electron_mirror https://npmmirror.com/mirrors/electron/
    echo [状态] 正在自动安装本地依赖依赖（包含 Electron 桌面包），请稍等...
    call npm install
)

:MENU
echo.
echo ==================================================
echo              请选择您需要的启动模式:
echo ==================================================
echo  [1] 🌐 网页浏览器模式 (在普通浏览器加载 http://127.0.0.1:3000)
echo  [2] 💎 桌面原生沙盒模式 (推荐：突破所有跨域和安全防御限制，
echo                          支持对直接任意网页进行内嵌与逆向解析)
echo  [3] 🔧 一键极速修复依赖 (自动清理不完整文件，强制开启国内高速安装镜像)
echo ==================================================
echo.

set choice=
set /p choice="请输入选项 [1, 2 或 3] 并回车: "

echo ==================================================
echo   正在加载中，请稍后...
echo ==================================================

if "%choice%"=="1" (
    npm run dev
) else if "%choice%"=="2" (
    :: 在运行桌面版前，再次确保安装了 electron
    if not exist "node_modules\electron\" (
        echo [提示] 未找到桌面端内核，正在为您极速配置国内安装镜像并补全依赖...
        call npm config set registry https://registry.npmmirror.com
        call npm config set electron_mirror https://npmmirror.com/mirrors/electron/
        call npm install
    )
    npm run desktop
) else if "%choice%"=="3" (
    echo [修复] 正在清理缓存并配置官方/腾讯/阿里高速下载源...
    call npm config set registry https://registry.npmmirror.com
    call npm config set electron_mirror https://npmmirror.com/mirrors/electron/
    echo [修复] 正在强制补全、安装并校验系统依赖包...
    call npm install
    echo.
    echo ==================================================
    echo       ✨ 依赖库更新并修复完毕！请输入 2 启动桌面模式 ✨
    echo ==================================================
    goto MENU
) else (
    echo [未识别的选项] 默认启动推荐的“桌面原生沙盒模式”...
    npm run desktop
)

pause
