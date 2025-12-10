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
console.log('    TENANT_ID:', process.env.TENANT_ID ? '✅ 已設定' : '❌ 未設定');
console.log('    CLIENT_ID:', process.env.CLIENT_ID ? '✅ 已設定' : '❌ 未設定');
console.log('    PROXY_USERNAME:', process.env.PROXY_USERNAME ? '✅ 已設定' : '❌ 未設定');
console.log('    PROXY_PASSWORD:', process.env.PROXY_PASSWORD ? '✅ 已設定' : '❌ 未設定');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// 中介軟體
app.use(helmet()); // 安全性標頭
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json());

// 請求日誌中介軟體（用於診斷）
app.use((req: Request, res: Response, next: Function) => {
    console.log(`📥 收到請求: ${req.method} ${req.path} - ${new Date().toISOString()}`);
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

// 主要 API 端點
app.post('/api/getStudentGrade', async (req: Request, res: Response) => {
    try {
        const { studentId, excelFilePath } = req.body as StudentGradeRequest;

        // 驗證請求參數
        if (!studentId || !excelFilePath) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數: studentId 或 excelFilePath'
            } as StudentGradeResponse);
        }

        console.log(`處理學生 ${studentId} 的成績請求`);
        console.log(`檔案路徑: ${excelFilePath}`);

        // 下載並解析 Excel
        const excelData = await downloadExcelFromSharePoint(excelFilePath);

        if (!excelData || excelData.length === 0) {
            return res.status(404).json({
                success: false,
                error: '找不到 Excel 資料'
            } as StudentGradeResponse);
        }

        // 篩選該學生的資料
        const studentData = filterStudentData(excelData, studentId);

        if (studentData.length === 0) {
            return res.status(404).json({
                success: false,
                error: `找不到學生 ${studentId} 的成績資料`
            } as StudentGradeResponse);
        }

        // 移除敏感欄位
        const sanitizedData = sanitizeStudentData(studentData);

        // 返回成功回應
        res.json({
            success: true,
            data: sanitizedData,
            studentId: studentId
        } as StudentGradeResponse);

    } catch (error: any) {
        console.error('處理請求時發生錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '伺服器內部錯誤'
        } as StudentGradeResponse);
    }
});

// 錯誤處理中介軟體
app.use((err: Error, req: Request, res: Response, next: Function) => {
    console.error('未處理的錯誤:', err);
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
