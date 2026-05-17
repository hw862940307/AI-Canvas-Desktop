@echo off
TITLE NV Node Pro Launcher
echo ==========================================
echo   正在准备启动应用程序...
echo ==========================================

:: 检查是否安装了 Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 请先安装 Node.js! (https://nodejs.org/)
    pause
    exit /b
)

:: 检查 node_modules 是否存在
if not exist "node_modules\" (
    echo [状态] 正在安装依赖项，请稍候...
    call npm install
)

echo.
echo 请选择启动模式:
echo [1] 浏览器模式 (http://localhost:3000)
echo [2] 桌面窗口模式 (推荐)
echo.

set /p choice="请输入选项 [1-2]: "

echo ==========================================
echo   正在启动...
echo ==========================================

if "%choice%"=="2" (
    npm run desktop
) else (
    npm run dev
)

pause
