@echo off
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
echo.
pause

echo.
echo ========================================
echo   第1步：检查Git状态
echo ========================================
cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if %errorlevel%==0 (
    echo [√] 已存在Git仓库
) else (
    echo [!] 正在初始化Git仓库...
    git init
    echo [√] Git仓库初始化完成
)
echo.

echo ========================================
echo   第2步：提交所有文件
echo ========================================
echo [!] 正在添加所有文件...
git add -A
git commit -m "Initial commit: 绩效管理系统"
echo [√] 文件提交完成
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
echo      - Repository name: 输入仓库名称（如 singleHTML）
echo      - Description: 绩效管理系统（可选）
echo      - 选择 Public 或 Private
echo      - 不要勾选 Add README/.gitignore/License
echo.
echo   3. 点击 Create repository
echo.
echo   4. 复制仓库地址（格式如下）：
echo      https://github.com/你的用户名/仓库名.git
echo.
pause

echo.
echo ========================================
echo   第4步：配置远程仓库地址
echo ========================================
echo.
set /p REPO_URL=请输入你的GitHub仓库地址: 

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
pause

echo.
set /p TOKEN=请输入你的GitHub Token: 

echo [!] 正在配置认证...
git remote remove origin >nul 2>&1

for /f "tokens=*" %%i in ("%REPO_URL%") do (
    set FULL_URL=%%i
)

set AUTH_URL=%REPO_URL:https://=https://%TOKEN%@%
git remote add origin %AUTH_URL%
echo [√] 认证配置完成
echo.

echo ========================================
echo   第6步：推送到GitHub
echo ========================================
echo [!] 正在推送代码...
git branch -M main
git push -u origin main
echo [√] 推送完成！
echo.

echo ========================================
echo   第7步：设置仓库为公开访问
echo ========================================
echo.
echo 请按以下步骤操作：
echo.
echo   1. 访问：https://github.com/你的用户名/仓库名/settings
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
echo   第8步：启用GitHub Pages
echo ========================================
echo.
echo 请按以下步骤操作：
echo.
echo   1. 访问：https://github.com/你的用户名/仓库名/settings/pages
echo.
echo   2. 在 Build and deployment 下：
echo      - Source: 选择 Deploy from a branch
echo      - Branch: 选择 main，文件夹选择 / (root)
echo      - 点击 Save
echo.
echo   3. 等待1-2分钟
echo.
echo   4. 访问地址：
echo      https://你的用户名.github.io/仓库名/index.html
echo.
pause

echo.
echo ========================================
echo   完成！
echo ========================================
echo.
echo 你的绩效管理系统已成功部署到GitHub！
echo.
echo 后续更新代码只需双击 push.bat 即可
echo.
pause