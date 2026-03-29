const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const OCR_URL = import.meta.env.VITE_OCR_URL || "http://localhost:5001";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "default-token-123";

import { VerificationStatus } from "./mock-data";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  birthplace: string;
  cin: string;
  filiere: string;
  classe: string;
  group: string;
  status: VerificationStatus;
  documentsUploaded: number;
  parentName: string;
  bacYear: string;
  bacScore: string;
  bacMention: string;
  mismatch_details?: any[];
  document_paths?: Record<string, string>;
}

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {
    "X-API-TOKEN": API_TOKEN,
  };
  if (isJson) {
    headers["Content-Type"] = "application/json; charset=UTF-8";
  }
  return headers;
};

export const apiService = {
  getOcrUrl(): string {
    return OCR_URL;
  },

  async fetchStudents(): Promise<Student[]> {
    const response = await fetch(`${API_URL}/students`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch students");
    return response.json();
  },

  async fetchStudentById(id: string): Promise<Student> {
    const response = await fetch(`${API_URL}/students/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch student details");
    return response.json();
  },

  async bulkStoreStudents(students: any[]): Promise<Student[]> {
    const response = await fetch(`${API_URL}/students/bulk`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ students }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to store students");
    }
    return response.json();
  },

  async bulkUpdateStatus(updates: { cin: string; status: string; documentsUploaded?: number; mismatch_details?: any[] }[]): Promise<Student[]> {
    const response = await fetch(`${API_URL}/students/bulk-status`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ updates }),
    });
    if (!response.ok) throw new Error("Failed to bulk update student status");
    return response.json();
  },

  async updateStudentStatus(cin: string, data: { status: string; documentsUploaded?: number }): Promise<Student> {
    const response = await fetch(`${API_URL}/students/${cin}/status`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update student status");
    return response.json();
  },

  async deleteStudent(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/students/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete student");
  },

  async uploadDocument(studentId: string, type: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("type", type);

    const response = await fetch(`${API_URL}/students/${studentId}/documents`, {
      method: "POST",
      headers: getHeaders(false), // FormData handles Content-Type
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload document");
    return response.json();
  },

  async bulkUploadDocuments(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/students/bulk-upload-documents`, {
      method: "POST",
      headers: getHeaders(false),
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || "Failed to bulk upload documents");
    }
    return response.json();
  },

  async verifyGroup(group: string): Promise<any[]> {
    const response = await fetch(`${API_URL}/students/verify-group`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ group }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || "Failed to verify group");
    }
    return response.json();
  }
};
