# Railway 快速開始指南

## ✅ 專案已準備完成！

所有必要的檔案都已建立並測試通過。

---

## 🚀 立即部署（3 個步驟）

### 步驟 1：推送到 GitHub

```bash
cd railway-proxy-server

# 如果還沒有 Git 儲存庫
git init
git add .
git commit -m "Add Railway proxy server"

# 推送到 GitHub（替換為您的儲存庫）
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### 步驟 2：部署到 Railway

1. 前往 https://railway.app
2. 使用 GitHub 登入
3. 點擊「New Project」→「Deploy from GitHub repo」
4. 選擇您的儲存庫
5. Railway 會自動部署

### 步驟 3：設定環境變數

在 Railway 專案中，前往「Variables」標籤，新增：

```
TENANT_ID=d1a86d43-9bb5-40b7-ab52-754d8d6d7bf1
CLIENT_ID=your-client-id
PROXY_USERNAME=s54748@esp.edu.mo
PROXY_PASSWORD=your-password
NODE_ENV=production
ALLOWED_ORIGINS=https://groupespauloedu.sharepoint.com
```

**完成！** Railway 會自動重新部署，幾分鐘後服務就會運行。

---

## 📋 需要的資訊

在部署前，請準備：

1. **CLIENT_ID**：Azure AD 應用程式 ID
   - 如果還沒有，參考 [Railway部署快速指南.md](../Railway部署快速指南.md) 的「取得 CLIENT_ID」章節

2. **PROXY_PASSWORD**：代理人帳號 `s54748@esp.edu.mo` 的密碼

3. **GitHub 儲存庫**：用於部署

---

## 🔗 相關文件

- [Railway部署快速指南.md](../Railway部署快速指南.md) - 完整部署步驟
- [README.md](./README.md) - 專案說明

---

**準備時間：** 已準備完成 ✅  
**部署時間：** 約 5 分鐘  
**難度：** ⭐⭐ (簡單)


## ✅ 專案已準備完成！

所有必要的檔案都已建立並測試通過。

---

## 🚀 立即部署（3 個步驟）

### 步驟 1：推送到 GitHub

```bash
cd railway-proxy-server

# 如果還沒有 Git 儲存庫
git init
git add .
git commit -m "Add Railway proxy server"

# 推送到 GitHub（替換為您的儲存庫）
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

### 步驟 2：部署到 Railway

1. 前往 https://railway.app
2. 使用 GitHub 登入
3. 點擊「New Project」→「Deploy from GitHub repo」
4. 選擇您的儲存庫
5. Railway 會自動部署

### 步驟 3：設定環境變數

在 Railway 專案中，前往「Variables」標籤，新增：

```
TENANT_ID=d1a86d43-9bb5-40b7-ab52-754d8d6d7bf1
CLIENT_ID=your-client-id
PROXY_USERNAME=s54748@esp.edu.mo
PROXY_PASSWORD=your-password
NODE_ENV=production
ALLOWED_ORIGINS=https://groupespauloedu.sharepoint.com
```

**完成！** Railway 會自動重新部署，幾分鐘後服務就會運行。

---

## 📋 需要的資訊

在部署前，請準備：

1. **CLIENT_ID**：Azure AD 應用程式 ID
   - 如果還沒有，參考 [Railway部署快速指南.md](../Railway部署快速指南.md) 的「取得 CLIENT_ID」章節

2. **PROXY_PASSWORD**：代理人帳號 `s54748@esp.edu.mo` 的密碼

3. **GitHub 儲存庫**：用於部署

---

## 🔗 相關文件

- [Railway部署快速指南.md](../Railway部署快速指南.md) - 完整部署步驟
- [README.md](./README.md) - 專案說明

---

**準備時間：** 已準備完成 ✅  
**部署時間：** 約 5 分鐘  
**難度：** ⭐⭐ (簡單)

