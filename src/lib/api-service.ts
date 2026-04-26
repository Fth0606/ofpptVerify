const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const OCR_URL = import.meta.env.VITE_OCR_URL || "http://localhost:5001";
import { VerificationStatus } from "./mock-data";

// ─────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────

export interface StudentDocument {
  id: string;
  student_id: string;
  type: "cin" | "baccalaureate" | "birth_certificate" | "other";
  original_filename: string;
  mime_type: string;
  file_size: number;
  ocr_extracted_name: string | null;
  ocr_extracted_dob: string | null;
  ocr_extracted_cin: string | null;
  ocr_status: "pending" | "processed" | "failed";
  created_at: string;
}

export interface Student {
  id: string;
  MatriculeEtudiant: string;
  Nom: string;
  Prenom: string;
  LibelleLong: string;
  CodeDiplome: string;
  DateNaissance: string;
  Site: string;
  cin: string;
  NTelephone: string;
  Nationalite: string;
  anneeEtude: string;
  Nom_Arabe: string;
  Prenom_arabe: string;
  NiveauScolaire: string;
  status: VerificationStatus;
  documentsUploaded: number;
  documents_count?: number;
  mismatch_details?: any[];
  documents_list?: StudentDocument[];
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  if (isJson) {
    headers["Content-Type"] = "application/json; charset=UTF-8";
  }
  return headers;
};

/**
 * Returns the URL that serves a document image directly from the database.
 * Use this as `src` on an <img> tag or as an href for a download link.
 */
export const getDocumentUrl = (documentId: string | number): string =>
  `${API_URL}/documents/${documentId}/file`;

// ─────────────────────────────────────────────────────────
// API Service
// ─────────────────────────────────────────────────────────

export const apiService = {
  getOcrUrl(): string {
    return OCR_URL;
  },

  // ── Students ──────────────────────────────────────────

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

  async bulkUpdateStatus(
    updates: { cin: string; status: string; documentsUploaded?: number; mismatch_details?: any[] }[]
  ): Promise<Student[]> {
    const response = await fetch(`${API_URL}/students/bulk-status`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ updates }),
    });
    if (!response.ok) throw new Error("Failed to bulk update student status");
    return response.json();
  },

  async updateStudentStatus(
    cin: string,
    data: { status: string; documentsUploaded?: number }
  ): Promise<Student> {
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
  },

  // ── Documents ──────────────────────────────────────────

  /**
   * Fetch document metadata for a student (no binary data).
   */
  async fetchStudentDocuments(studentId: string): Promise<StudentDocument[]> {
    const response = await fetch(`${API_URL}/students/${studentId}/documents`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch student documents");
    return response.json();
  },

  /**
   * Upload a single document for a student.
   */
  async uploadDocument(studentId: string, type: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("type", type);

    const response = await fetch(`${API_URL}/students/${studentId}/documents`, {
      method: "POST",
      headers: getHeaders(false),
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload document");
    return response.json();
  },

  /**
   * Bulk upload a ZIP of folders (each folder = one student by CIN).
   */
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

  /**
   * Delete a specific document by its ID.
   */
  async deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${API_URL}/documents/${documentId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete document");
  },
};
