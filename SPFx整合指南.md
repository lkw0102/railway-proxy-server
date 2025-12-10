# SPFx 整合指南 - 學生成績代理服務器

## 📋 概述

本文檔說明如何在 SPFx Web Part 中整合 Railway 代理服務器，以動態讀取 SharePoint Excel 檔案中的學生成績資料。

## 🔗 服務資訊

- **服務 URL**: `https://railway-proxy-server-production.up.railway.app`
- **健康檢查端點**: `GET /health`
- **API 端點**: `POST /api/getStudentGrade`

## 📡 API 規格

### 端點：`POST /api/getStudentGrade`

#### 請求格式

```typescript
{
  studentId: string;        // 學生帳號（例如：student001）
  excelFilePath: string;    // SharePoint Excel 檔案的共享連結
}
```

#### 請求範例

```json
{
  "studentId": "student001",
  "excelFilePath": "https://groupespauloedu.sharepoint.com/:x:/r/sites/Classrooms/Shared%20Documents/test.xlsx"
}
```

#### 成功回應（200 OK）

```json
{
  "success": true,
  "data": [
    {
      "學生帳號": "student001",
      "科目": "數學",
      "成績": 85,
      "學期": "2024-2025-1"
    }
  ],
  "studentId": "student001"
}
```

#### 錯誤回應

**400 Bad Request** - 缺少必要參數
```json
{
  "success": false,
  "error": "缺少必要參數: studentId 或 excelFilePath"
}
```

**404 Not Found** - 找不到資料
```json
{
  "success": false,
  "error": "找不到學生 student001 的成績資料"
}
```

**500 Internal Server Error** - 伺服器錯誤
```json
{
  "success": false,
  "error": "錯誤訊息描述"
}
```

## 💻 SPFx 整合範例

### 1. 建立 API 服務類別

在 SPFx 專案中建立一個服務類別來處理 API 呼叫：

```typescript
// src/services/StudentGradeService.ts

export interface StudentGradeRequest {
  studentId: string;
  excelFilePath: string;
}

export interface StudentRow {
  [key: string]: string | number | boolean | undefined;
}

export interface StudentGradeResponse {
  success: boolean;
  data?: StudentRow[];
  studentId?: string;
  error?: string;
}

export class StudentGradeService {
  private readonly apiUrl: string = 'https://railway-proxy-server-production.up.railway.app/api/getStudentGrade';

  /**
   * 取得學生成績資料
   * @param studentId 學生帳號
   * @param excelFilePath SharePoint Excel 檔案共享連結
   * @returns 學生成績資料
   */
  public async getStudentGrade(
    studentId: string,
    excelFilePath: string
  ): Promise<StudentGradeResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          excelFilePath,
        } as StudentGradeRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return {
          success: false,
          error: errorData.error || `請求失敗: ${response.status}`,
        };
      }

      const data: StudentGradeResponse = await response.json();
      return data;
    } catch (error) {
      console.error('取得學生成績時發生錯誤:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      };
    }
  }

  /**
   * 檢查服務健康狀態
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(
        'https://railway-proxy-server-production.up.railway.app/health'
      );
      return response.ok;
    } catch (error) {
      console.error('健康檢查失敗:', error);
      return false;
    }
  }
}
```

### 2. 在 Web Part 中使用服務

```typescript
// src/webparts/studentGrade/StudentGradeWebPart.ts

import { StudentGradeService } from '../../services/StudentGradeService';

export default class StudentGradeWebPart extends BaseClientSideWebPart<IStudentGradeWebPartProps> {
  private studentGradeService: StudentGradeService;

  protected onInit(): Promise<void> {
    this.studentGradeService = new StudentGradeService();
    return super.onInit();
  }

  public render(): void {
    const element: React.ReactElement<IStudentGradeProps> = React.createElement(
      StudentGrade,
      {
        studentGradeService: this.studentGradeService,
        // ... 其他 props
      }
    );

    ReactDom.render(element, this.domElement);
  }

  // ... 其他方法
}
```

### 3. 在 React 元件中使用

```typescript
// src/components/StudentGrade.tsx

import * as React from 'react';
import { StudentGradeService, StudentGradeResponse } from '../services/StudentGradeService';

export interface IStudentGradeProps {
  studentGradeService: StudentGradeService;
  studentId: string;
  excelFilePath: string;
}

export interface IStudentGradeState {
  loading: boolean;
  data: StudentGradeResponse | null;
  error: string | null;
}

export default class StudentGrade extends React.Component<IStudentGradeProps, IStudentGradeState> {
  constructor(props: IStudentGradeProps) {
    super(props);
    this.state = {
      loading: false,
      data: null,
      error: null,
    };
  }

  public async componentDidMount(): Promise<void> {
    await this.loadStudentGrade();
  }

  public async componentDidUpdate(prevProps: IStudentGradeProps): Promise<void> {
    if (
      prevProps.studentId !== this.props.studentId ||
      prevProps.excelFilePath !== this.props.excelFilePath
    ) {
      await this.loadStudentGrade();
    }
  }

  private async loadStudentGrade(): Promise<void> {
    const { studentGradeService, studentId, excelFilePath } = this.props;

    if (!studentId || !excelFilePath) {
      this.setState({
        error: '請提供學生帳號和 Excel 檔案路徑',
        loading: false,
      });
      return;
    }

    this.setState({ loading: true, error: null });

    try {
      const result = await studentGradeService.getStudentGrade(studentId, excelFilePath);

      if (result.success && result.data) {
        this.setState({
          data: result,
          loading: false,
        });
      } else {
        this.setState({
          error: result.error || '無法取得學生成績資料',
          loading: false,
        });
      }
    } catch (error) {
      this.setState({
        error: error instanceof Error ? error.message : '發生未知錯誤',
        loading: false,
      });
    }
  }

  public render(): React.ReactElement<IStudentGradeProps> {
    const { loading, data, error } = this.state;

    if (loading) {
      return (
        <div>
          <Spinner label="載入學生成績中..." />
        </div>
      );
    }

    if (error) {
      return (
        <MessageBar messageBarType={MessageBarType.error}>
          {error}
        </MessageBar>
      );
    }

    if (!data || !data.data || data.data.length === 0) {
      return (
        <MessageBar messageBarType={MessageBarType.info}>
          找不到學生成績資料
        </MessageBar>
      );
    }

    return (
      <div>
        <h2>學生成績：{data.studentId}</h2>
        <DetailsList
          items={data.data}
          columns={this.getColumns()}
          setKey="set"
          layoutMode={DetailsListLayoutMode.justified}
          selectionPreservedOnEmptyClick={true}
        />
      </div>
    );
  }

  private getColumns(): IColumn[] {
    if (!this.state.data || !this.state.data.data || this.state.data.data.length === 0) {
      return [];
    }

    const firstRow = this.state.data.data[0];
    return Object.keys(firstRow).map((key) => ({
      key: key,
      name: key,
      fieldName: key,
      minWidth: 100,
      maxWidth: 200,
      isResizable: true,
    }));
  }
}
```

### 4. 使用函數式元件（React Hooks）

```typescript
// src/components/StudentGradeFunctional.tsx

import * as React from 'react';
import { useEffect, useState } from 'react';
import { StudentGradeService, StudentGradeResponse } from '../services/StudentGradeService';
import { Spinner } from '@fluentui/react/lib/Spinner';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';

export interface IStudentGradeFunctionalProps {
  studentGradeService: StudentGradeService;
  studentId: string;
  excelFilePath: string;
}

export const StudentGradeFunctional: React.FC<IStudentGradeFunctionalProps> = (props) => {
  const { studentGradeService, studentId, excelFilePath } = props;
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<StudentGradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!studentId || !excelFilePath) {
        setError('請提供學生帳號和 Excel 檔案路徑');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await studentGradeService.getStudentGrade(studentId, excelFilePath);

        if (result.success && result.data) {
          setData(result);
        } else {
          setError(result.error || '無法取得學生成績資料');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '發生未知錯誤');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [studentId, excelFilePath, studentGradeService]);

  if (loading) {
    return <Spinner label="載入學生成績中..." />;
  }

  if (error) {
    return <MessageBar messageBarType={MessageBarType.error}>{error}</MessageBar>;
  }

  if (!data || !data.data || data.data.length === 0) {
    return <MessageBar messageBarType={MessageBarType.info}>找不到學生成績資料</MessageBar>;
  }

  return (
    <div>
      <h2>學生成績：{data.studentId}</h2>
      {/* 渲染成績資料 */}
      <pre>{JSON.stringify(data.data, null, 2)}</pre>
    </div>
  );
};
```

## 🔍 測試步驟

### 1. 測試健康檢查

```typescript
const service = new StudentGradeService();
const isHealthy = await service.checkHealth();
console.log('服務健康狀態:', isHealthy);
```

### 2. 測試取得學生成績

```typescript
const service = new StudentGradeService();
const result = await service.getStudentGrade(
  'student001',
  'https://groupespauloedu.sharepoint.com/:x:/r/sites/Classrooms/Shared%20Documents/test.xlsx'
);

if (result.success) {
  console.log('學生成績:', result.data);
} else {
  console.error('錯誤:', result.error);
}
```

## ⚠️ 注意事項

### 1. SharePoint 檔案連結格式

服務支援以下 SharePoint 共享連結格式：

- `/r/` 格式：`https://domain.sharepoint.com/:x:/r/sites/SiteName/...`
- `/s/` 格式：`https://domain.sharepoint.com/:x:/s/...`

### 2. Excel 檔案格式要求

- Excel 檔案必須是 `.xlsx` 格式
- 第一行必須是欄位標題（標題行）
- 必須包含「學生帳號」欄位（欄位名稱可以是：`學生帳號`、`Student Account`、`studentAccount`、`account`）

### 3. 敏感資料過濾

服務會自動過濾以下敏感欄位：
- `School Year`
- `Teacher Name`
- `Teacher`
- `備註`
- `Note`
- `備註欄`
- `Remarks`

### 4. CORS 設定

服務已設定 CORS，允許所有來源。如需限制特定來源，請聯繫後端開發團隊。

### 5. 錯誤處理

建議在 SPFx 中實作以下錯誤處理：

- 網路錯誤（連線失敗）
- API 錯誤（400, 404, 500）
- 資料格式錯誤
- 超時處理

### 6. 效能考量

- 建議實作快取機制，避免重複請求相同資料
- 可以實作防抖（debounce）機制，避免頻繁請求
- 考慮使用 React Query 或 SWR 來管理 API 狀態

## 🐛 常見問題

### Q1: 收到 502 Bad Gateway 錯誤

**原因**: 服務可能正在重新部署或暫時不可用。

**解決方案**:
1. 檢查服務健康狀態：`GET /health`
2. 等待幾秒後重試
3. 如果持續發生，聯繫後端開發團隊

### Q2: 收到「不支援的檔案路徑格式」錯誤

**原因**: SharePoint 檔案連結格式不正確。

**解決方案**:
1. 確認連結包含 `sharepoint.com/:x:/`
2. 確認連結是完整的共享連結
3. 檢查連結是否正確編碼

### Q3: 收到「找不到學生資料」錯誤

**原因**: Excel 檔案中沒有該學生的資料，或學生帳號欄位名稱不匹配。

**解決方案**:
1. 確認學生帳號正確
2. 確認 Excel 檔案包含該學生資料
3. 確認 Excel 檔案有「學生帳號」欄位（不區分大小寫）

### Q4: 資料欄位名稱不正確

**原因**: Excel 檔案的欄位名稱與預期不符。

**解決方案**:
1. 確認 Excel 檔案第一行是標題行
2. 確認欄位名稱正確
3. 可以聯繫後端開發團隊新增支援的欄位名稱

## 📞 聯絡資訊

如有問題或需要協助，請聯繫：
- 後端開發團隊
- Railway 服務管理員

## 📝 更新記錄

- **2025-12-10**: 初始版本，服務成功部署到 Railway
