import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Student, StudentMismatch } from "./mock-data";

export function exportVerifiedToExcel(students: Student[]) {
  const data = students.map(s => ({
    "Filière": s.filiere,
    "Classe": s.classe,
    "Group": s.group,
    "Full Name": s.fullName,
    "CIN": s.cin,
    "Date of Birth": s.dateOfBirth,
    "Birthplace": s.birthplace,
    "Parent Name": s.parentName,
    "Bac Year": s.bacYear,
    "Bac Score": s.bacScore,
    "Mention": s.bacMention,
    "Status": "Verified",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Verified Students");
  XLSX.writeFile(wb, "verified_students.xlsx");
}

export function exportMismatchedToExcel(students: Student[], mismatches: StudentMismatch[]) {
  const data: Record<string, string>[] = [];
  for (const s of students) {
    const mm = mismatches.find(m => m.student.id === s.id);
    const issues = mm ? mm.mismatches.map(m => `${m.field}: Excel="${m.excelValue}" Doc="${m.ocrValue}" (${m.document})`).join(" | ") : "";
    data.push({
      "Filière": s.filiere,
      "Classe": s.classe,
      "Group": s.group,
      "Full Name": s.fullName,
      "CIN": s.cin,
      "Date of Birth": s.dateOfBirth,
      "Birthplace": s.birthplace,
      "Parent Name": s.parentName,
      "Bac Year": s.bacYear,
      "Bac Score": s.bacScore,
      "Mention": s.bacMention,
      "Issues": issues,
    });
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mismatched Students");
  XLSX.writeFile(wb, "mismatched_students.xlsx");
}

export function exportVerifiedToPDF(students: Student[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Verified Students Report", 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

  const rows = students.map(s => [
    s.filiere, s.classe, s.group, s.fullName, s.cin,
    s.dateOfBirth, s.birthplace, s.parentName,
    s.bacYear, s.bacScore, s.bacMention,
  ]);

  autoTable(doc, {
    startY: 28,
    head: [["Filière", "Classe", "Group", "Full Name", "CIN", "DOB", "Birthplace", "Parent", "Bac Year", "Score", "Mention"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [34, 139, 34] },
  });

  doc.save("verified_students.pdf");
}

export function exportMismatchedToPDF(students: Student[], mismatches: StudentMismatch[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Mismatched Students Report", 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

  const rows = students.map(s => {
    const mm = mismatches.find(m => m.student.id === s.id);
    const issues = mm ? mm.mismatches.map(m => `${m.field}: "${m.excelValue}" vs "${m.ocrValue}"`).join("; ") : "";
    return [s.filiere, s.classe, s.group, s.fullName, s.cin, s.dateOfBirth, s.birthplace, issues];
  });

  autoTable(doc, {
    startY: 28,
    head: [["Filière", "Classe", "Group", "Full Name", "CIN", "DOB", "Birthplace", "Mismatch Details"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [220, 53, 69] },
    columnStyles: { 7: { cellWidth: 80 } },
  });

  doc.save("mismatched_students.pdf");
}
