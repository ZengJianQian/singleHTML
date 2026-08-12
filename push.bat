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

echo [3/4] 检查是否有待提交的变更...
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo 没有待提交的变更，跳过提交步骤。
    echo.
    echo ========================================
    echo   完成！（无变更）
    echo ========================================
    pause
    exit /b 0
)

echo 提交变更...
git commit -m "自动提交: %date% %time%"
if %errorlevel% neq 0 (
    echo.
    echo [错误] 提交失败，请检查上方错误信息。
    echo.
    echo ========================================
    echo   完成！（提交失败）
    echo ========================================
    pause
    exit /b 1
)
echo.

echo [4/4] 推送到GitHub...
git push
if %errorlevel% neq 0 (
    echo.
    echo [错误] 推送失败，请检查网络连接和仓库权限。
    echo.
    echo ========================================
    echo   完成！（推送失败）
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo   完成！
echo ========================================
pause