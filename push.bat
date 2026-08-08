@echo off
chcp 65001 >nul
echo ========================================
echo   绩效管理系统 - 自动提交并推送
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 检查文件变更...
git status --short
echo.

echo [2/4] 添加所有变更（包括新增、修改、删除）...
git add -A
echo.

echo [3/4] 提交变更...
git commit -m "自动提交: %date% %time%"
echo.

echo [4/4] 推送到GitHub...
git push

echo.
echo ========================================
echo   完成！
echo ========================================
pause