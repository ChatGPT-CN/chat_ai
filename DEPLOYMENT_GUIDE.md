# Kimi-Clone 应用部署指南

本指南将引导您将 Kimi-Clone 应用部署到 Vercel 和您自己的服务器上。

## 1. 生产构建产物

在项目根目录（`/home/ubuntu/kimi_clone`）下运行 `pnpm build` 后，主要的生产构建产物位于 `.next` 文件夹中。部署时通常需要整个项目文件夹，特别是以下内容：

*   `.next` (Next.js 构建输出)
*   `public` (静态资源，包括多语言的 `locales` 文件)
*   `package.json` (项目依赖)
*   `pnpm-lock.yaml` (锁定依赖版本)
*   `next.config.js` (Next.js 配置文件)
*   `next-i18next.config.js` (国际化配置文件)
*   `node_modules` (在服务器上通过 `pnpm install --prod` 生成)

## 2. 部署到 Vercel

Vercel 对 Next.js 项目提供了非常便捷的部署支持。

### 步骤：

1.  **推送代码到 Git 仓库**：
    *   确保您的项目代码已推送到 GitHub, GitLab, 或 Bitbucket 仓库。

2.  **在 Vercel 上创建新项目**：
    *   登录到您的 [Vercel](https://vercel.com) 账户。
    *   点击 "Add New..." -> "Project"。
    *   从您的 Git 提供商导入项目仓库。

3.  **配置项目**：
    *   Vercel 通常会自动检测到这是一个 Next.js 项目，并使用正确的构建命令 (`next build`) 和启动命令。
    *   **构建命令**：可以保留默认的 `next build` 或根据需要设置为 `pnpm build` (如果 Vercel 环境支持 pnpm 且您希望使用 pnpm)。
    *   **输出目录**：Vercel 会自动识别 `.next` 目录。
    *   **安装命令**：可以设置为 `pnpm install`。

4.  **环境变量 (可选，但推荐未来使用)**：
    *   虽然当前应用将 API 密钥存储在浏览器的 localStorage 中，但如果未来您将密钥管理移至后端，您需要在 Vercel 项目的设置中配置环境变量。例如：
        *   `DEEPSEEK_API_KEY=your_deepseek_key`
        *   `OPENAI_API_KEY=your_openai_key`
        *   等等...
    *   在应用代码中，您可以通过 `process.env.YOUR_VARIABLE_NAME` 访问这些环境变量 (通常在服务器端代码如 API 路由中使用)。

5.  **部署**：
    *   点击 "Deploy"按钮。
    *   Vercel 将拉取代码、安装依赖、构建项目并将其部署到全球 CDN 网络。
    *   部署完成后，您将获得一个 `.vercel.app` 的域名，可以通过该域名访问您的应用。

## 3. 部署到您自己的服务器 (自托管)

### 前提条件：

*   一台安装了 Node.js (推荐 v18 或更高版本) 和 pnpm 的服务器。
*   服务器具有公网 IP 地址，并且相关的端口（例如 3000，或您希望通过反向代理使用的 80/443）已在防火墙中打开。

### 步骤：

1.  **上传项目文件**：
    *   将您的整个项目文件夹 `/home/ubuntu/kimi_clone` (或者至少包含上述“生产构建产物”中列出的关键文件和文件夹，除了 `node_modules`) 上传到您服务器上的目标目录，例如 `/var/www/kimi-clone`。

2.  **安装生产依赖**：
    *   通过 SSH 连接到您的服务器。
    *   进入项目目录：`cd /var/www/kimi-clone`
    *   安装生产依赖：`pnpm install --prod`
      *   `--prod` 标志确保只安装 `dependencies` 中列出的包，跳过 `devDependencies`。

3.  **构建项目 (如果在本地未构建或希望在服务器上构建)**：
    *   如果您没有上传 `.next` 文件夹，或者希望在服务器上进行构建，请先确保安装所有依赖 (包括 devDependencies)：`pnpm install`
    *   然后运行构建命令：`pnpm build`

4.  **启动应用**：
    *   运行生产启动命令：`pnpm start`
    *   默认情况下，Next.js 应用会监听 `3000` 端口。您可以通过设置 `PORT` 环境变量来更改它，例如：`PORT=8080 pnpm start`。

5.  **使用进程管理器 (推荐)**：
    *   为了确保应用在服务器重启或意外崩溃后能自动重启，并方便管理，建议使用进程管理器，如 PM2。
    *   安装 PM2 (如果尚未安装)：`sudo npm install -g pm2`
    *   使用 PM2 启动应用：`pm2 start pnpm --name "kimi-clone" -- start`
    *   常用 PM2 命令：
        *   `pm2 list`: 查看所有正在运行的应用
        *   `pm2 logs kimi-clone`: 查看 kimi-clone 应用的日志
        *   `pm2 stop kimi-clone`: 停止应用
        *   `pm2 restart kimi-clone`: 重启应用
        *   `pm2 delete kimi-clone`: 删除应用
        *   `pm2 startup`: 生成启动脚本，使 PM2 在服务器启动时自动运行
        *   `pm2 save`: 保存当前 PM2 进程列表

6.  **配置反向代理 (推荐)**：
    *   为了使用标准的 HTTP (80) 和 HTTPS (443) 端口，以及方便配置 SSL/TLS 证书，建议使用反向代理服务器，如 Nginx 或 Apache。
    *   **Nginx 示例配置** (`/etc/nginx/sites-available/kimi-clone.conf`)：
        ```nginx
        server {
            listen 80;
            server_name your_domain.com; # 替换为您的域名

            location / {
                proxy_pass http://localhost:3000; # 假设您的 Next.js 应用运行在 3000 端口
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
            }
        }
        ```
    *   创建软链接：`sudo ln -s /etc/nginx/sites-available/kimi-clone.conf /etc/nginx/sites-enabled/`
    *   测试 Nginx 配置：`sudo nginx -t`
    *   重载 Nginx：`sudo systemctl reload nginx`
    *   **配置 SSL/TLS**：强烈建议使用 Let's Encrypt (通过 Certbot 工具) 为您的域名配置免费的 SSL 证书，以启用 HTTPS。
        *   安装 Certbot：`sudo apt install certbot python3-certbot-nginx` (适用于 Debian/Ubuntu)
        *   获取并安装证书：`sudo certbot --nginx -d your_domain.com`

7.  **环境变量 (可选，同 Vercel)**：
    *   在您的服务器上，您可以通过 `.env.local` 文件 (确保此文件在 `.gitignore` 中以避免提交到 Git) 或通过操作系统的环境变量来设置生产环境变量。
    *   如果使用 PM2，可以在启动应用时传递环境变量，或者使用 PM2 的生态系统文件 (ecosystem.config.js) 来管理环境变量。

## 4. 部署后验证

无论您选择 Vercel 还是自托管：

1.  访问您的应用 URL。
2.  测试核心功能：
    *   首页加载和 UI 显示。
    *   多语言切换。
    *   新建会话。
    *   API 密钥设置 (包括预设和自定义 API)。
    *   使用配置好的 API (特别是 DeepSeek，因为之前测试正常) 进行聊天，确认 AI 能正常回复。
    *   如果可能，在新的网络环境下测试之前有问题的 API (OpenAI, Anthropic, Gemini)。

如果您在部署过程中遇到任何问题，请检查相关服务的日志 (Vercel 的部署日志，或您服务器上的应用日志和反向代理日志)。

