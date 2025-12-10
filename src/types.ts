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
