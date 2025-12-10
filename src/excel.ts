import * as XLSX from 'xlsx';
import { StudentRow } from './types';
import { AuthProvider } from './auth';
import { UsernamePasswordCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

/**
 * 打印檔案資訊（大小、前幾個字節等）
 */
function logFileInfo(fileContent: ArrayBuffer, source: string): void {
    const size = fileContent.byteLength;
    const sizeKB = (size / 1024).toFixed(2);
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    
    console.log(`📄 檔案資訊 (${source}):`);
    console.log(`   大小: ${size} bytes (${sizeKB} KB${size > 1024 * 1024 ? ` / ${sizeMB} MB` : ''})`);
    
    // 打印檔案的前 100 個字節（十六進制）
    const previewBytes = new Uint8Array(fileContent.slice(0, Math.min(100, size)));
    const hexPreview = Array.from(previewBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`   前 100 bytes (hex): ${hexPreview.substring(0, 200)}${hexPreview.length > 200 ? '...' : ''}`);
    
    // 檢查檔案格式
    if (previewBytes[0] === 0x50 && previewBytes[1] === 0x4B) {
        console.log('   ✅ 檔案格式: Excel (.xlsx) 格式（ZIP 壓縮）');
    } else if (previewBytes[0] === 0xD0 && previewBytes[1] === 0xCF) {
        console.log('   ⚠️  檔案格式: 可能是舊版 Excel (.xls) 格式');
    } else {
        console.log(`   ⚠️  檔案格式: 未知格式（前兩個字節: 0x${previewBytes[0].toString(16)} 0x${previewBytes[1].toString(16)}）`);
    }
    
    // 打印檔案的前幾個字節（ASCII，如果可讀）
    const asciiPreview = Array.from(previewBytes.slice(0, 50))
        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
        .join('');
    console.log(`   前 50 bytes (ASCII): ${asciiPreview}`);
}

export async function downloadExcelFromSharePoint(
    filePath: string
): Promise<StudentRow[]> {
    try {
        let fileContent: ArrayBuffer;

        if (filePath.includes('sharepoint.com/:x:/')) {
            // 處理共享連結格式
            if (filePath.includes('sharepoint.com/:x:/s/')) {
                // /s/ 格式 - Graph API /shares/ 端點需要委派權限
                // 如果使用應用程式認證流程，改用 SharePoint REST API
                // 先嘗試使用 Graph API（如果使用委派認證）
                try {
                    const authProvider = new AuthProvider();
                    const graphClient = await authProvider.getGraphClient();
                    
                    const shareId = Buffer.from(filePath).toString('base64')
                        .replace(/=+$/, '')
                        .replace(/\//g, '_')
                        .replace(/\+/g, '-');
                    
                    console.log(`嘗試使用 Graph API 取得 /s/ 格式的共享檔案`);
                    const response = await graphClient.api(`/shares/u!${shareId}/driveItem/content`).get();
                    fileContent = response as ArrayBuffer;
                    console.log('成功使用 Graph API 取得檔案');
                    logFileInfo(fileContent, 'Graph API');
                } catch (graphError: any) {
                    console.warn('Graph API 失敗（可能是應用程式認證不支援），嘗試使用委派認證:', graphError.message);
                    
                    // Graph API /shares/ 端點需要委派權限
                    // 如果使用應用程式認證失敗，改用委派認證（UsernamePasswordCredential）
                    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
                        console.log('使用委派認證（UsernamePasswordCredential）重新嘗試');
                        
                        const delegateCredential = new UsernamePasswordCredential(
                            process.env.TENANT_ID!,
                            process.env.CLIENT_ID!,
                            process.env.PROXY_USERNAME,
                            process.env.PROXY_PASSWORD
                        );
                        
                        const token = await delegateCredential.getToken([
                            'https://graph.microsoft.com/Files.Read.All',
                            'https://graph.microsoft.com/Sites.Read.All'
                        ]);
                        
                        const delegateGraphClient = Client.init({
                            authProvider: (done) => {
                                done(null, token.token);
                            }
                        });
                        
                        const shareId = Buffer.from(filePath).toString('base64')
                            .replace(/=+$/, '')
                            .replace(/\//g, '_')
                            .replace(/\+/g, '-');
                        
                        const response = await delegateGraphClient.api(`/shares/u!${shareId}/driveItem/content`).get();
                        fileContent = response as ArrayBuffer;
                        console.log('成功使用委派認證取得檔案');
                        logFileInfo(fileContent, '委派認證 (UsernamePasswordCredential)');
                    } else {
                        throw new Error(`無法使用 Graph API 取得 /s/ 格式的共享檔案。Graph API /shares/ 端點需要委派權限，但當前使用應用程式認證。請設定 PROXY_USERNAME 和 PROXY_PASSWORD 以使用委派認證。原始錯誤: ${graphError.message}`);
                    }
                }
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
                console.log('成功使用 SharePoint REST API 取得檔案');
                logFileInfo(fileContent, 'SharePoint REST API');
            }
        } else {
            throw new Error('不支援的檔案路徑格式');
        }

        // 使用 SheetJS 解析 Excel（優化記憶體使用）
        // 使用更節省記憶體的選項
        const workbook = XLSX.read(fileContent, { 
            type: 'array',
            cellDates: false,  // 不使用日期物件，節省記憶體
            cellNF: false,      // 不使用數字格式，節省記憶體
            cellStyles: false,  // 不使用樣式，節省記憶體
            dense: false        // 不使用密集模式，節省記憶體
        });
        
        const firstSheetName = workbook.SheetNames[0];
        
        if (!firstSheetName) {
            throw new Error('Excel 檔案沒有工作表');
        }

        const sheet = workbook.Sheets[firstSheetName];
        
        // 限制最大行數，避免記憶體不足（例如最多 10000 行）
        const MAX_ROWS = 10000;
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const totalRows = Math.min(range.e.r + 1, MAX_ROWS);
        
        console.log(`Excel 檔案總行數: ${range.e.r + 1}，將處理前 ${totalRows} 行`);
        
        // 使用 sheet_to_json 但限制範圍
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { 
            header: 1,
            defval: null,
            raw: false  // 不使用原始值，統一轉換為字串/數字
        }) as unknown[][];

        // 釋放 workbook 記憶體
        workbook.SheetNames = [];
        workbook.Sheets = {};

        if (!rows || rows.length === 0) {
            return [];
        }

        // 轉換為物件陣列（限制處理的資料量）
        const headerRow = (rows[0] as (string | number | null | undefined)[]).map((h, idx) => {
            const headerStr = h === null || h === undefined ? '' : String(h).trim();
            return headerStr.length === 0 ? `Column${idx + 1}` : headerStr;
        });

        const dataObjects: StudentRow[] = [];
        const maxDataRows = Math.min(rows.length - 1, MAX_ROWS - 1); // 減去標題行
        
        for (let r = 1; r <= maxDataRows; r++) {
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
                    const strValue = String(value).trim();
                    if (strValue.length === 0) {
                        obj[key] = undefined;
                    } else {
                        const num = Number(strValue);
                        obj[key] = isNaN(num) ? strValue : num;
                    }
                }
            }
            dataObjects.push(obj);
        }

        // 強制垃圾回收提示（如果可用）
        if (global.gc) {
            global.gc();
        }

        console.log(`成功載入 ${dataObjects.length} 筆資料（限制最多 ${MAX_ROWS} 行）`);
        return dataObjects;

    } catch (error: any) {
        console.error('下載 Excel 檔案時發生錯誤:', error);
        console.error('錯誤詳情:', {
            message: error?.message,
            name: error?.name,
            stack: error?.stack,
            code: error?.code,
            statusCode: error?.statusCode
        });
        
        // 提供更詳細的錯誤訊息
        if (error?.message) {
            throw new Error(`Excel 檔案處理錯誤: ${error.message}`);
        } else if (typeof error === 'string') {
            throw new Error(`Excel 檔案處理錯誤: ${error}`);
        } else {
            throw new Error(`Excel 檔案處理錯誤: ${JSON.stringify(error)}`);
        }
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

