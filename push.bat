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
set MAX_RETRIES=3
set RETRY_COUNT=0
set PUSH_SUCCESS=0

:retry_push
set /a RETRY_COUNT+=1
echo.
echo 第 %RETRY_COUNT% 次尝试推送（最多 %MAX_RETRIES% 次）...
git push
if %errorlevel% equ 0 (
    set PUSH_SUCCESS=1
    goto push_done
)

if %RETRY_COUNT% lss %MAX_RETRIES% (
    echo.
    echo [警告] 推送失败，正在尝试自动修复...
    
    if %RETRY_COUNT% equ 1 (
        echo 尝试 1：增加 Git 缓冲区大小...
        git config --global http.postBuffer 524288000
    )
    
    if %RETRY_COUNT% equ 2 (
        echo 尝试 2：禁用 SSL 验证并重试...
        git config --global http.sslVerify false
    )
    
    echo 等待 3 秒后重试...
    timeout /t 3 /nobreak >nul
    goto retry_push
)

:push_done
if %PUSH_SUCCESS% equ 0 (
    echo.
    echo [错误] 推送失败（已重试 %MAX_RETRIES% 次）
    echo.
    echo 建议的解决方案：
    echo   1. 检查网络连接是否正常
    echo   2. 检查防火墙或代理设置
    echo   3. 尝试使用 SSH 替代 HTTPS：
    echo      git remote set-url origin git@github.com:ZengJianQian/singleHTML.git
    echo   4. 配置代理（如有）：
    echo      git config --global http.proxy http://127.0.0.1:7890
    echo.
    echo 代码已成功提交到本地仓库，可稍后手动执行 git push
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