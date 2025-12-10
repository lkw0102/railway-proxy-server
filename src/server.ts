import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { downloadExcelFromSharePoint, filterStudentData, sanitizeStudentData } from './excel';
import { StudentGradeRequest, StudentGradeResponse } from './types';

// 載入環境變數
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(helmet()); // 安全性標頭
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json());

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
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行在 http://localhost:${PORT}`);
    console.log(`📦 環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ 健康檢查: http://localhost:${PORT}/health`);
});

import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { downloadExcelFromSharePoint, filterStudentData, sanitizeStudentData } from './excel';
import { StudentGradeRequest, StudentGradeResponse } from './types';

// 載入環境變數
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(helmet()); // 安全性標頭
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json());

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
app.listen(PORT, () => {
    console.log(`🚀 伺服器運行在 http://localhost:${PORT}`);
    console.log(`📦 環境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ 健康檢查: http://localhost:${PORT}/health`);
});
