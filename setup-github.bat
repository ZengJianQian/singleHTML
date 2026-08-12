@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo ========================================
echo   GitHub 仓库初始化引导脚本
echo ========================================
echo.
echo 本脚本将引导你完成以下操作：
echo   1. 初始化本地Git仓库
echo   2. 创建GitHub远程仓库
echo   3. 推送代码到GitHub
echo   4. 设置GitHub Pages公开访问
echo  开始前请确保已经有一个index页面，若没有可以通过AI为本项目设计一个入口用的index页面，通过其中的按钮，跳转到其他的页面。
echo.

echo ========================================
echo   项目信息配置
echo ========================================
echo.
set /p PROJECT_NAME=请输入项目名称（英文，如 my-project）: 
set /p PROJECT_DESC=请输入项目描述（如 我的个人项目）: 
set /p COMMIT_MSG=请输入首次提交信息（如 Initial commit）: 
echo(
echo(
pause

echo.
echo ========================================
echo   第1步：检查Git状态
echo ========================================
cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel%==0 (
    echo [√] 已存在Git仓库
    echo.
    echo 请选择操作模式：
    echo   1 - 增量模式：保留原有内容，只提交新变更（推荐）
    echo   2 - 覆盖模式：删除原有仓库内容，重新初始化
    echo.
    set /p MODE_CHOICE=请选择 [1/2，默认1]: 
    
    if "!MODE_CHOICE!"=="2" (
        echo.
        echo [!] 警告：此操作将删除原有仓库的所有提交历史！
        echo.
        set /p CONFIRM=确认删除原有仓库内容？(y/n): 
        if /i "!CONFIRM!"=="y" (
            echo [!] 正在删除原有仓库...
            rmdir /s /q .git
            echo [!] 正在重新初始化...
            git init
            echo [√] 仓库已重新初始化
        ) else (
            echo [√] 已取消，继续使用增量模式
        )
    ) else (
        echo [√] 使用增量模式，保留原有内容
    )
) else (
    echo [!] 正在初始化Git仓库...
    git init
    echo [√] Git仓库初始化完成
)
echo.

echo ========================================
echo   第2步：检查并提交文件变更
echo ========================================
echo [!] 正在检查文件变更...

REM 检查是否有未跟踪的文件或已修改的文件
git status --porcelain > "%TEMP%\git_status.txt" 2>&1
findstr /r "." "%TEMP%\git_status.txt" >nul 2>&1
if %errorlevel%==0 (
    echo [!] 发现文件变更，正在统计...
    echo.
    
    REM 显示变更统计
    for /f %%a in ('findstr /r "^??" "%TEMP%\git_status.txt" ^| find /c /v ""') do set NEW_FILES=%%a
    for /f %%a in ('findstr /r "^[AMD]" "%TEMP%\git_status.txt" ^| find /c /v ""') do set MOD_FILES=%%a
    for /f %%a in ('findstr /r "^D" "%TEMP%\git_status.txt" ^| find /c /v ""') do set DEL_FILES=%%a
    
    if defined NEW_FILES if not "!NEW_FILES!"=="0" echo   新增文件: !NEW_FILES! 个
    if defined MOD_FILES if not "!MOD_FILES!"=="0" echo   修改文件: !MOD_FILES! 个
    if defined DEL_FILES if not "!DEL_FILES!"=="0" echo   删除文件: !DEL_FILES! 个
    echo.
    
    REM 添加所有变更（增量覆盖）
    echo [!] 正在添加变更文件（增量模式）...
    git add -A
    
    REM 显示将要提交的内容
    echo.
    echo [!] 变更详情：
    git diff --cached --stat
    echo.
    
    REM 提交变更
    git commit -m "%COMMIT_MSG%"
    if %errorlevel%==0 (
        echo [√] 增量提交完成
    ) else (
        echo [!] 提交失败，请检查Git配置
        pause
    )
) else (
    echo [√] 没有文件变更，跳过提交
    echo    提示：如需强制重新提交，请先修改文件后再运行
)

del "%TEMP%\git_status.txt" >nul 2>&1
echo.

echo ========================================
echo   第3步：在GitHub创建仓库
echo ========================================
echo.
echo 请按以下步骤操作：
echo.
echo   1. 打开浏览器访问：https://github.com/new
echo.
echo   2. 填写仓库信息：
echo      - Repository name: %PROJECT_NAME%
echo      - Description: %PROJECT_DESC%
echo      - 选择 Public 或 Private
echo      - 不要勾选 Add README/.gitignore/License
echo.
echo   3. 点击 Create repository
echo.
echo   4. 复制仓库地址（格式如下）：
echo      https://github.com/你的用户名/%PROJECT_NAME%.git
echo.
echo.
echo ========================================
echo   第4步：配置远程仓库地址
echo ========================================
echo.
set /p REPO_URL=请输入你的GitHub仓库地址: 

set REPO_URL_TEMP=%REPO_URL%
set REPO_URL_TEMP=%REPO_URL_TEMP:https://=%
set REPO_URL_TEMP=%REPO_URL_TEMP:http://=%
set REPO_URL_TEMP=%REPO_URL_TEMP:github.com/=%
for /f "delims=/" %%a in ("%REPO_URL_TEMP%") do set GITHUB_USER=%%a

git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
echo [√] 远程仓库地址已设置
echo.

echo ========================================
echo   第5步：配置GitHub认证Token
echo ========================================
echo.
echo 请按以下步骤获取Token：
echo.
echo   1. 访问：https://github.com/settings/tokens/new
echo.
echo   2. 填写信息：
echo      - Note: MyPC
echo      - Expiration: 选择有效期
echo      - 勾选 repo 权限（全选）
echo.
echo   3. 点击 Generate token
echo.
echo   4. 复制生成的Token（以 ghp_ 开头）
echo.
set /p TOKEN=请输入你的GitHub Token: 

if "%TOKEN%"=="" (
    echo [!] Token不能为空！
    pause
    exit /b 1
)

echo [!] 正在配置认证...
git remote remove origin >nul 2>&1

set AUTH_URL=https://%TOKEN%@github.com/%GITHUB_USER%/%PROJECT_NAME%.git
echo [DEBUG] 远程仓库地址: %AUTH_URL%
git remote add origin "%AUTH_URL%"
echo [√] 认证配置完成
echo.

echo ========================================
echo   第6步：推送到GitHub
echo ========================================
echo [!] 正在推送代码...
git branch -M main
git push -u origin main
if %errorlevel%==0 (
    echo [√] 推送完成！
) else (
    echo [!] 推送失败！请检查以下问题：
    echo      1. Token是否正确
    echo      2. 仓库是否已创建
    echo      3. 网络连接是否正常
    echo.
    echo 请查看上方的错误信息，修复后重新运行此脚本
    pause
    exit /b 1
)
echo.

echo ========================================
echo   第7步：设置仓库为公开访问（可选）
echo ========================================
echo.
echo 如需设置仓库为公开访问，请按以下步骤操作：
echo.
echo   1. 访问：https://github.com/%GITHUB_USER%/%PROJECT_NAME%/settings
echo.
echo   2. 向下滚动到 Danger Zone 区域
echo.
echo   3. 点击 Change visibility
echo.
echo   4. 选择 Change to public 并确认
echo.
pause

echo.
echo ========================================
echo   第8步：启用GitHub Pages（可选）
echo ========================================
echo.
echo 如需启用GitHub Pages公开访问HTML页面，请按以下步骤操作：
echo.
echo   1. 访问：https://github.com/%GITHUB_USER%/%PROJECT_NAME%/settings/pages
echo.
echo   2. 在 Build and deployment 下：
echo      - Source: 选择 Deploy from a branch
echo      - Branch: 选择 main，文件夹选择 / (root)
echo      - 点击 Save
echo.
echo   3. 等待1-2分钟
echo.
echo   4. 访问地址：
echo      https://%GITHUB_USER%.github.io/%PROJECT_NAME%/
echo.
pause

echo.
echo ========================================
echo   完成！
echo ========================================
echo.
echo 项目 %PROJECT_NAME% 已成功部署到GitHub！
echo.
echo 仓库地址：https://github.com/%GITHUB_USER%/%PROJECT_NAME%
echo.
echo 后续更新代码只需双击 push.bat 即可
echo.
pause