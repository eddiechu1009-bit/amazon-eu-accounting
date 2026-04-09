@echo off
chcp 65001 >nul
echo.
echo  ══════════════════════════════════════
echo    Amazon EU 帳務分析工具
echo    正在啟動，請稍候...
echo  ══════════════════════════════════════
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel%==0 (
    echo  正在啟動本地伺服器...
    echo  瀏覽器將自動開啟，如未開啟請手動前往 http://localhost:3456
    echo  關閉此視窗即可停止伺服器
    echo.
    start "" http://localhost:3456
    npx --yes serve dist -l 3456 -s --no-clipboard
) else (
    echo  未偵測到 Node.js，直接開啟檔案...
    start "" "dist\index.html"
    timeout /t 3 >nul
)
