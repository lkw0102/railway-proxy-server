import * as XLSX from 'xlsx';
import { StudentRow } from './types';
import { AuthProvider } from './auth';

export async function downloadExcelFromSharePoint(
    filePath: string
): Promise<StudentRow[]> {
    try {
        let fileContent: ArrayBuffer;

        if (filePath.includes('sharepoint.com/:x:/')) {
            // 處理共享連結格式
            if (filePath.includes('sharepoint.com/:x:/s/')) {
                // /s/ 格式 - 使用 Graph API shares
                const authProvider = new AuthProvider();
                const graphClient = await authProvider.getGraphClient();
                
                const shareId = Buffer.from(filePath).toString('base64')
                    .replace(/=+$/, '')
                    .replace(/\//g, '_')
                    .replace(/\+/g, '-');
                
                const response = await graphClient.api(`/shares/u!${shareId}/driveItem/content`).get();
                fileContent = response as ArrayBuffer;
            } else {
                // /r/ 格式 - 提取檔案路徑並使用 SharePoint REST API
                const serverRelativePath = extractServerRelativePathFromShareLink(filePath);
                if (!serverRelativePath) {
                    throw new Error('無法從共享連結提取檔案路徑');
                }
                
                const authProvider = new AuthProvider();
                const token = await authProvider.getAccessToken();
                
                // 從原始 filePath 中提取站台 URL
                const sharePointUrl = extractSharePointSiteFromFilePath(filePath);
                const apiUrl = `${sharePointUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelativePath)}')/$value`;
                
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json;odata=verbose'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`SharePoint API 錯誤: ${response.status} ${response.statusText}`);
                }
                
                fileContent = await response.arrayBuffer();
            }
        } else {
            throw new Error('不支援的檔案路徑格式');
        }

        // 使用 SheetJS 解析 Excel
        const workbook = XLSX.read(fileContent, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        
        if (!firstSheetName) {
            throw new Error('Excel 檔案沒有工作表');
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        if (!rows || rows.length === 0) {
            return [];
        }

        // 轉換為物件陣列
        const headerRow = (rows[0] as (string | number | null | undefined)[]).map((h, idx) => {
            const headerStr = h === null || h === undefined ? '' : String(h).trim();
            return headerStr.length === 0 ? `Column${idx + 1}` : headerStr;
        });

        const dataObjects: StudentRow[] = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as (string | number | null | undefined)[];
            if (!row || row.length === 0) continue;

            const obj: StudentRow = {};
            for (let c = 0; c < headerRow.length; c++) {
                const key = headerRow[c];
                const value = row[c];
                
                if (value === null || value === undefined) {
                    obj[key] = undefined;
                } else if (typeof value === 'number') {
                    obj[key] = value;
                } else {
                    const num = Number(String(value).trim());
                    obj[key] = isNaN(num) ? String(value) : num;
                }
            }
            dataObjects.push(obj);
        }

        console.log(`成功載入 ${dataObjects.length} 筆資料`);
        return dataObjects;

    } catch (error) {
        console.error('下載 Excel 檔案時發生錯誤:', error);
        throw error;
    }
}

function extractServerRelativePathFromShareLink(filePath: string): string | null {
    // 從共享連結格式提取相對路徑
    // 例如: https://groupespauloedu.sharepoint.com/:x:/r/sites/Classrooms/Shared%20Documents/test.xlsx
    // 提取: /sites/Classrooms/Shared Documents/test.xlsx
    
    const match = filePath.match(/\/sites\/(.+)$/);
    if (!match) {
        return null;
    }
    
    // 解碼 URL 編碼
    const path = decodeURIComponent(match[1]);
    return `/sites/${path}`;
}

function extractSharePointSiteFromFilePath(filePath: string): string {
    // 從原始 filePath 中提取站台 URL
    // 例如: https://groupespauloedu.sharepoint.com/:x:/r/sites/Classrooms/...
    // 提取: https://groupespauloedu.sharepoint.com
    
    const match = filePath.match(/https:\/\/([^/]+)/);
    if (!match) {
        throw new Error('無法從檔案路徑提取 SharePoint 站台 URL');
    }
    
    return `https://${match[1]}`;
}

export function filterStudentData(allData: StudentRow[], studentId: string): StudentRow[] {
    // 常見的學生帳號欄位名稱
    const possibleAccountFields = ['學生帳號', 'Student Account', 'studentAccount', 'account'];
    
    let accountField: string | null = null;
    
    // 找到學生帳號欄位
    if (allData.length > 0) {
        const sampleRow = allData[0];
        for (const fieldName of possibleAccountFields) {
            if (fieldName in sampleRow) {
                accountField = fieldName;
                break;
            }
        }
    }

    if (!accountField) {
        console.warn('找不到學生帳號欄位，嘗試使用所有可能的欄位名稱');
        // 如果找不到，嘗試使用第一個看起來像帳號的欄位
        return [];
    }

    // 篩選該學生的資料（不區分大小寫）
    const lowerStudentId = studentId.toLowerCase();
    return allData.filter(row => {
        const studentAccount = row[accountField!];
        if (typeof studentAccount === 'string') {
            return studentAccount.toLowerCase() === lowerStudentId;
        } else if (typeof studentAccount === 'number') {
            return String(studentAccount).toLowerCase() === lowerStudentId;
        }
        return false;
    });
}

export function sanitizeStudentData(data: StudentRow[]): StudentRow[] {
    // 移除敏感欄位
    const sensitiveFields = ['School Year', 'Teacher Name', 'Teacher', '備註', 'Note', '備註欄', 'Remarks'];
    
    return data.map(row => {
        const sanitized: StudentRow = {};
        for (const [key, value] of Object.entries(row)) {
            // 檢查是否為敏感欄位（不區分大小寫）
            const isSensitive = sensitiveFields.some(field => 
                key.toLowerCase().includes(field.toLowerCase())
            );
            
            if (!isSensitive) {
                sanitized[key] = value;
            }
        }
        return sanitized;
    });
}

import { StudentRow } from './types';
import { AuthProvider } from './auth';

export async function downloadExcelFromSharePoint(
    filePath: string
): Promise<StudentRow[]> {
    try {
        let fileContent: ArrayBuffer;

        if (filePath.includes('sharepoint.com/:x:/')) {
            // 處理共享連結格式
            if (filePath.includes('sharepoint.com/:x:/s/')) {
                // /s/ 格式 - 使用 Graph API shares
                const authProvider = new AuthProvider();
                const graphClient = await authProvider.getGraphClient();
                
                const shareId = Buffer.from(filePath).toString('base64')
                    .replace(/=+$/, '')
                    .replace(/\//g, '_')
                    .replace(/\+/g, '-');
                
                const response = await graphClient.api(`/shares/u!${shareId}/driveItem/content`).get();
                fileContent = response as ArrayBuffer;
            } else {
                // /r/ 格式 - 提取檔案路徑並使用 SharePoint REST API
                const serverRelativePath = extractServerRelativePathFromShareLink(filePath);
                if (!serverRelativePath) {
                    throw new Error('無法從共享連結提取檔案路徑');
                }
                
                const authProvider = new AuthProvider();
                const token = await authProvider.getAccessToken();
                
                // 從原始 filePath 中提取站台 URL
                const sharePointUrl = extractSharePointSiteFromFilePath(filePath);
                const apiUrl = `${sharePointUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(serverRelativePath)}')/$value`;
                
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json;odata=verbose'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`SharePoint API 錯誤: ${response.status} ${response.statusText}`);
                }
                
                fileContent = await response.arrayBuffer();
            }
        } else {
            throw new Error('不支援的檔案路徑格式');
        }

        // 使用 SheetJS 解析 Excel
        const workbook = XLSX.read(fileContent, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        
        if (!firstSheetName) {
            throw new Error('Excel 檔案沒有工作表');
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        if (!rows || rows.length === 0) {
            return [];
        }

        // 轉換為物件陣列
        const headerRow = (rows[0] as (string | number | null | undefined)[]).map((h, idx) => {
            const headerStr = h === null || h === undefined ? '' : String(h).trim();
            return headerStr.length === 0 ? `Column${idx + 1}` : headerStr;
        });

        const dataObjects: StudentRow[] = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as (string | number | null | undefined)[];
            if (!row || row.length === 0) continue;

            const obj: StudentRow = {};
            for (let c = 0; c < headerRow.length; c++) {
                const key = headerRow[c];
                const value = row[c];
                
                if (value === null || value === undefined) {
                    obj[key] = undefined;
                } else if (typeof value === 'number') {
                    obj[key] = value;
                } else {
                    const num = Number(String(value).trim());
                    obj[key] = isNaN(num) ? String(value) : num;
                }
            }
            dataObjects.push(obj);
        }

        console.log(`成功載入 ${dataObjects.length} 筆資料`);
        return dataObjects;

    } catch (error) {
        console.error('下載 Excel 檔案時發生錯誤:', error);
        throw error;
    }
}

function extractServerRelativePathFromShareLink(filePath: string): string | null {
    // 從共享連結格式提取相對路徑
    // 例如: https://groupespauloedu.sharepoint.com/:x:/r/sites/Classrooms/Shared%20Documents/test.xlsx
    // 提取: /sites/Classrooms/Shared Documents/test.xlsx
    
    const match = filePath.match(/\/sites\/(.+)$/);
    if (!match) {
        return null;
    }
    
    // 解碼 URL 編碼
    const path = decodeURIComponent(match[1]);
    return `/sites/${path}`;
}

function extractSharePointSiteFromFilePath(filePath: string): string {
    // 從原始 filePath 中提取站台 URL
    // 例如: https://groupespauloedu.sharepoint.com/:x:/r/sites/Classrooms/...
    // 提取: https://groupespauloedu.sharepoint.com
    
    const match = filePath.match(/https:\/\/([^/]+)/);
    if (!match) {
        throw new Error('無法從檔案路徑提取 SharePoint 站台 URL');
    }
    
    return `https://${match[1]}`;
}

export function filterStudentData(allData: StudentRow[], studentId: string): StudentRow[] {
    // 常見的學生帳號欄位名稱
    const possibleAccountFields = ['學生帳號', 'Student Account', 'studentAccount', 'account'];
    
    let accountField: string | null = null;
    
    // 找到學生帳號欄位
    if (allData.length > 0) {
        const sampleRow = allData[0];
        for (const fieldName of possibleAccountFields) {
            if (fieldName in sampleRow) {
                accountField = fieldName;
                break;
            }
        }
    }

    if (!accountField) {
        console.warn('找不到學生帳號欄位，嘗試使用所有可能的欄位名稱');
        // 如果找不到，嘗試使用第一個看起來像帳號的欄位
        return [];
    }

    // 篩選該學生的資料（不區分大小寫）
    const lowerStudentId = studentId.toLowerCase();
    return allData.filter(row => {
        const studentAccount = row[accountField!];
        if (typeof studentAccount === 'string') {
            return studentAccount.toLowerCase() === lowerStudentId;
        } else if (typeof studentAccount === 'number') {
            return String(studentAccount).toLowerCase() === lowerStudentId;
        }
        return false;
    });
}

export function sanitizeStudentData(data: StudentRow[]): StudentRow[] {
    // 移除敏感欄位
    const sensitiveFields = ['School Year', 'Teacher Name', 'Teacher', '備註', 'Note', '備註欄', 'Remarks'];
    
    return data.map(row => {
        const sanitized: StudentRow = {};
        for (const [key, value] of Object.entries(row)) {
            // 檢查是否為敏感欄位（不區分大小寫）
            const isSensitive = sensitiveFields.some(field => 
                key.toLowerCase().includes(field.toLowerCase())
            );
            
            if (!isSensitive) {
                sanitized[key] = value;
            }
        }
        return sanitized;
    });
}
