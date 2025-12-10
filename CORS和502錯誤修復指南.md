# CORS 和 502 錯誤修復指南

## 🔴 錯誤訊息

1. **CORS 錯誤**：
```
Access to fetch at 'https://railway-proxy-server-production.up.railway.app/api/getStudentGrade' 
from origin 'https://groupespauloedu.sharepoint.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

2. **502 Bad Gateway**：
```
POST https://railway-proxy-server-production.up.railway.app/api/getStudentGrade net::ERR_FAILED 502 (Bad Gateway)
```

## 📋 問題分析

### CORS 錯誤
- 服務沒有返回正確的 CORS 標頭
- 可能是因為服務返回 502 錯誤，導致沒有 CORS 標頭

### 502 Bad Gateway
- Railway 無法連接到應用程式
- 應用程式可能崩潰或沒有正常啟動
- 可能是應用程式啟動時發生錯誤

## ✅ 已修正的代碼

### 1. 改進 CORS 設定 (`src/server.ts`)

**修正前**：
```typescript
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
```

**修正後**：
```typescript
// CORS 設定 - 必須在其他中介軟體之前
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || ['*'];
console.log('🌐 CORS 允許的來源:', allowedOrigins);

app.use(cors({
    origin: (origin, callback) => {
        // 允許所有來源（如果設定為 '*'）或檢查是否在允許列表中
        if (allowedOrigins.includes('*') || !origin) {
            callback(null, true);
        } else if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS 拒絕來源: ${origin}`);
            callback(null, true); // 暫時允許所有來源以便調試
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
```

### 2. 處理 OPTIONS 預檢請求

新增 OPTIONS 請求處理：
```typescript
// OPTIONS 預檢請求處理
app.options('/api/getStudentGrade', (req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
});
```

### 3. 確保錯誤回應也包含 CORS 標頭

在所有錯誤處理中新增 CORS 標頭：
```typescript
// 確保 CORS 標頭在錯誤回應中也設定
res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
res.header('Access-Control-Allow-Credentials', 'true');
```

### 4. 改進 Helmet 設定

```typescript
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```

## 🚀 部署步驟

### 步驟 1：更新代碼

確保以下檔案已更新：
- ✅ `src/server.ts` - CORS 設定改進

### 步驟 2：檢查環境變數

在 Railway 中確認以下環境變數已設定：

```bash
ALLOWED_ORIGINS=https://groupespauloedu.sharepoint.com
```

或者允許所有來源（開發階段）：
```bash
ALLOWED_ORIGINS=*
```

### 步驟 3：重新建置並部署

```bash
cd railway-proxy-server
npm install
npm run build
# Railway 會自動部署
```

### 步驟 4：檢查 Railway 日誌

部署後，檢查 Railway 日誌，確認：
1. 服務是否正常啟動
2. 是否看到 `🌐 CORS 允許的來源:` 日誌
3. 是否有任何錯誤訊息

## 🔍 診斷 502 錯誤

### 1. 檢查服務是否運行

在 Railway 控制台中：
- 查看「Deployments」標籤，確認最新部署是否成功
- 查看「Logs」標籤，檢查是否有錯誤訊息

### 2. 檢查健康檢查端點

```bash
curl https://railway-proxy-server-production.up.railway.app/health
```

應該返回：
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "Student Grade Proxy Server"
}
```

如果返回 502，表示服務沒有運行。

### 3. 檢查應用程式啟動日誌

在 Railway 日誌中查找：
- `🚀 伺服器運行在 http://0.0.0.0:${PORT}`
- `✅ 健康檢查: http://0.0.0.0:${PORT}/health`
- `🌐 CORS 允許的來源: ...`

如果沒有看到這些日誌，表示應用程式可能沒有正常啟動。

### 4. 常見啟動錯誤

#### 錯誤 1: 缺少環境變數
```
Error: 缺少必要的環境變數: TENANT_ID, CLIENT_ID
```

**解決方案**：在 Railway 中設定所有必要的環境變數。

#### 錯誤 2: 認證錯誤
```
認證失敗: ...
```

**解決方案**：檢查 `CLIENT_SECRET` 或 `PROXY_USERNAME`/`PROXY_PASSWORD` 是否正確。

#### 錯誤 3: 端口問題
```
Error: listen EADDRINUSE: address already in use
```

**解決方案**：Railway 會自動設定 PORT，確保應用程式使用 `process.env.PORT`。

## 📝 環境變數檢查清單

確認以下環境變數已設定：

- [ ] `TENANT_ID`
- [ ] `CLIENT_ID`
- [ ] `CLIENT_SECRET` 或 `PROXY_USERNAME` + `PROXY_PASSWORD`
- [ ] `ALLOWED_ORIGINS`（建議設定為 `https://groupespauloedu.sharepoint.com`）
- [ ] `NODE_ENV`（可選，建議設定為 `production`）

## 🔧 測試 CORS

部署後，使用以下命令測試 CORS：

```bash
curl -X OPTIONS https://railway-proxy-server-production.up.railway.app/api/getStudentGrade \
  -H "Origin: https://groupespauloedu.sharepoint.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

應該看到：
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: https://groupespauloedu.sharepoint.com
< Access-Control-Allow-Methods: POST, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization, Accept
< Access-Control-Allow-Credentials: true
```

## 🐛 常見問題

### Q1: 仍然看到 CORS 錯誤？

**A:** 
1. 確認服務已重新部署
2. 清除瀏覽器快取
3. 檢查 Railway 日誌，確認 CORS 設定已載入
4. 確認 `ALLOWED_ORIGINS` 環境變數包含正確的來源

### Q2: 仍然看到 502 錯誤？

**A:**
1. 檢查 Railway 日誌，查看應用程式啟動錯誤
2. 確認所有環境變數已設定
3. 確認應用程式監聽正確的端口（`process.env.PORT`）
4. 檢查應用程式是否有語法錯誤

### Q3: 健康檢查返回 502？

**A:**
- 這表示應用程式根本沒有運行
- 檢查 Railway 日誌中的啟動錯誤
- 確認建置是否成功

## 📞 需要協助？

如果問題持續存在，請提供：
1. Railway 日誌的完整輸出（特別是啟動時的日誌）
2. 健康檢查端點的回應
3. CORS 測試的結果
4. 環境變數設定（隱藏敏感資訊）
