import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { downloadExcelFromSharePoint, filterStudentData, sanitizeStudentData } from './excel';
import { StudentGradeRequest, StudentGradeResponse } from './types';

// 載入環境變數
dotenv.config();

// 記錄啟動資訊（用於診斷）
console.log('📋 啟動資訊:');
console.log('  NODE_ENV:', process.env.NODE_ENV || '未設定');
console.log('  PORT:', process.env.PORT || '未設定（將使用預設 3000）');
console.log('  環境變數檢查:');
console.log('    TENANT_ID:', process.env.TENANT_ID || '❌ 未設定');
console.log('    CLIENT_ID:', process.env.CLIENT_ID || '❌ 未設定');
console.log('    CLIENT_SECRET:', process.env.CLIENT_SECRET || '❌ 未設定');
console.log('    PROXY_USERNAME:', process.env.PROXY_USERNAME || '❌ 未設定');
console.log('    PROXY_PASSWORD:', process.env.PROXY_PASSWORD || '❌ 未設定');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

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
            // 允許 SharePoint 來源
            if (origin && origin.includes('sharepoint.com')) {
                console.log(`✅ 允許 SharePoint 來源: ${origin}`);
                callback(null, true);
            } else {
                console.warn(`⚠️  CORS 拒絕來源: ${origin}`);
                callback(null, true); // 暫時允許所有來源以便調試
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Content-Length']
}));

// 中介軟體
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
})); // 安全性標頭
app.use(express.json());

// 請求日誌中介軟體（用於診斷）
app.use((req: Request, res: Response, next: Function) => {
    console.log(`📥 收到請求: ${req.method} ${req.path} - ${new Date().toISOString()}`);
    console.log(`📍 Origin: ${req.headers.origin || '未設定'}`);
    
    // 確保所有回應都設置 CORS header
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    
    next();
});

// 健康檢查端點
app.get('/health', (req: Request, res: Response) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'Student Grade Proxy Server'
    });
});

// OPTIONS 預檢請求處理
app.options('/api/getStudentGrade', (req: Request, res: Response) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
});

// 主要 API 端點
app.post('/api/getStudentGrade', async (req: Request, res: Response) => {
    // 確保 CORS 標頭已設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 設置請求超時（30 秒）
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            console.error('請求超時（30 秒）');
            res.status(504).json({
                success: false,
                error: '請求處理超時，請稍後再試'
            } as StudentGradeResponse);
        }
    }, 30000);
    
    try {
        const { studentId, excelFilePath } = req.body as StudentGradeRequest;

        // 驗證請求參數
        if (!studentId || !excelFilePath) {
            clearTimeout(timeout);
            return res.status(400).json({
                success: false,
                error: '缺少必要參數: studentId 或 excelFilePath'
            } as StudentGradeResponse);
        }

        console.log(`處理學生 ${studentId} 的成績請求`);
        console.log(`檔案路徑: ${excelFilePath}`);
        const startTime = Date.now();
        
        // 記錄記憶體使用情況
        const memBefore = process.memoryUsage();
        console.log(`記憶體使用（處理前）: RSS=${Math.round(memBefore.rss / 1024 / 1024)}MB, HeapUsed=${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);

        // 下載並解析 Excel
        const excelData = await downloadExcelFromSharePoint(excelFilePath);
        console.log(`Excel 下載完成，耗時: ${Date.now() - startTime}ms`);

        if (!excelData || excelData.length === 0) {
            clearTimeout(timeout);
            return res.status(404).json({
                success: false,
                error: '找不到 Excel 資料'
            } as StudentGradeResponse);
        }

        // 篩選該學生的資料
        const studentData = filterStudentData(excelData, studentId);
        
        // 釋放 excelData 記憶體（不再需要）
        (excelData as any) = null;

        if (studentData.length === 0) {
            clearTimeout(timeout);
            return res.status(404).json({
                success: false,
                error: `找不到學生 ${studentId} 的成績資料`
            } as StudentGradeResponse);
        }

        // 移除敏感欄位
        const sanitizedData = sanitizeStudentData(studentData);
        
        // 釋放 studentData 記憶體
        (studentData as any) = null;

        clearTimeout(timeout);
        const memAfter = process.memoryUsage();
        console.log(`記憶體使用（處理後）: RSS=${Math.round(memAfter.rss / 1024 / 1024)}MB, HeapUsed=${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
        console.log(`請求處理完成，總耗時: ${Date.now() - startTime}ms`);
        
        // 返回成功回應
        res.json({
            success: true,
            data: sanitizedData,
            studentId: studentId
        } as StudentGradeResponse);

    } catch (error: any) {
        clearTimeout(timeout);
        console.error('處理請求時發生錯誤:', error);
        console.error('錯誤堆疊:', error.stack);
        
        // 確保 CORS 標頭在錯誤回應中也設定
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        // 提供更詳細的錯誤訊息
        let errorMessage = '伺服器內部錯誤';
        if (error.message) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error.error) {
            errorMessage = error.error;
        }
        
        // 記錄完整的錯誤資訊
        console.error('錯誤詳情:', {
            message: errorMessage,
            name: error.name,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode
        });
        
        res.status(500).json({
            success: false,
            error: errorMessage
        } as StudentGradeResponse);
    }
});

// 錯誤處理中介軟體
app.use((err: Error, req: Request, res: Response, next: Function) => {
    console.error('未處理的錯誤:', err);
    
    // 確保 CORS 標頭在錯誤回應中也設定
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    res.status(500).json({
        success: false,
        error: '伺服器內部錯誤'
    } as StudentGradeResponse);
});

// 啟動伺服器
// Railway 會自動設定 PORT，應用程式需要監聽這個端口
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 伺服器運行在 http://0.0.0.0:${PORT}`);
    console.log(`📦 環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ 健康檢查: http://0.0.0.0:${PORT}/health`);
    console.log(`🔧 PORT 環境變數: ${process.env.PORT || '未設定（使用預設 3000）'}`);
    
    // 檢查環境變數（僅記錄，不拋出錯誤）
    const requiredVars = ['TENANT_ID', 'CLIENT_ID', 'PROXY_USERNAME', 'PROXY_PASSWORD'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
        console.warn(`⚠️  警告: 缺少環境變數: ${missingVars.join(', ')}`);
        console.warn('   應用程式已啟動，但 API 端點可能無法正常工作');
    } else {
        console.log('✅ 所有必要的環境變數已設定');
    }
});

// 處理未捕獲的錯誤，避免應用程式崩潰
process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
    // 不要退出進程，讓 Railway 處理重啟
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
    // 不要退出進程，讓 Railway 處理重啟
});

