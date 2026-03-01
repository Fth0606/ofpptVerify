const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const OCR_URL = import.meta.env.VITE_OCR_URL || "http://localhost:5000";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "default-token-123";

export interface Student {
  id: string;
  fullName: string;
  dateOfBirth: string;
  birthplace: string;
  cin: string;
  filiere: string;
  classe: string;
  group: string;
  status: string;
  documentsUploaded: number;
  parentName: string;
  bacYear: string;
  bacScore: string;
  bacMention: string;
}

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {
    "X-API-TOKEN": API_TOKEN,
  };
  if (isJson) {
    headers["Content-Type"] = "application/json";
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

  async bulkStoreStudents(students: any[]): Promise<Student[]> {
    const response = await fetch(`${API_URL}/students/bulk`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ students }),
    });
    if (!response.ok) throw new Error("Failed to store students");
    return response.json();
  },

  async bulkUpdateStatus(updates: { cin: string; status: string; documentsUploaded?: number }[]): Promise<Student[]> {
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
  }
};
