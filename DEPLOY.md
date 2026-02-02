# Zeabur 部署指南

本项目的架构为 **前后端分离**：
- **前端 (Frontend)**: React + Vite (负责界面展示)
- **后端 (Backend)**: Express (负责 API 转发，解决国内无法直连 OpenAI/Google 的问题)

在 Zeabur 上，你需要在一个项目中创建**两个服务**。

## 1. 部署后端服务 (Backend)

后端服务负责代理 AI 请求，必须先部署，因为前端需要填入它的地址。

1.  在 Zeabur 项目中，点击 **Deploy New Service** -> **Git**。
2.  选择你的仓库 `ExpertAI`。
3.  **配置服务**:
    *   **Service Name**: 建议修改为 `expert-backend` (方便识别)。
    *   **Root Directory (根目录)**: 填写 `server`
        *   *注意：这是关键！告诉 Zeabur 后端代码在 server 文件夹里。*
    *   **Watch Paths**: (可选) 填写 `server/**`
4.  等待构建完成。
5.  **开启公网访问**:
    *   进入该服务 -> **Networking** (网络) -> **Public** (公网)。
    *   点击 **Generate Domain** 生成一个域名 (例如 `expert-backend.zeabur.app`)。
    *   **复制这个域名**，下一步前端配置要用。

## 2. 部署前端服务 (Frontend)

1.  再次点击 **Deploy New Service** -> **Git**。
2.  再次选择同一个仓库 `ExpertAI`。
3.  **配置服务**:
    *   **Service Name**: 建议修改为 `expert-web`。
    *   **Root Directory (根目录)**: 保持默认 `/` (或者留空)。
    *   **Framework**: Zeabur 通常会自动识别为 `Vite`。如果没有，手动选择 `Static` 或 `Vite`。
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
4.  **配置环境变量 (Environment Variables)**:
    *   进入该服务 -> **Environment Variables**。
    *   添加变量:
        *   **Key**: `VITE_API_BASE_URL`
        *   **Value**: `https://你的后端域名.zeabur.app`
        *   *注意：填入你在第一步里获得的后端域名，必须带 https://，且末尾不要带 /*
5.  等待构建完成。
6.  **开启公网访问**:
    *   进入该服务 -> **Networking** -> **Public**。
    *   生成域名，点击访问即可。

## 常见问题

*   **Q: 为什么需要后端？**
    *   A: 为了在国内能直接访问 OpenAI/Google 等模型。前端直接请求会被墙，而后端部署在海外 (Zeabur) 可以正常访问，并在你和 AI 之间做桥梁。
*   **Q: 服务器位置选哪里？**
    *   A: 推荐 **新加坡 (Singapore)** 或 **日本 (Tokyo)**，速度快且稳定。
