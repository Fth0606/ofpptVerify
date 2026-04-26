export type VerificationStatus = "verified" | "mismatch" | "pending" | "missing";

export type DocumentType = "birth_certificate" | "baccalaureate" | "cin";

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
}

export interface MismatchField {
  field: string;
  excelValue: string;
  ocrValue: string;
  document: DocumentType;
}

export interface StudentMismatch {
  student: Student;
  mismatches: MismatchField[];
  notes: string;
}

export const mockStudents: Student[] = [
  { id: "1", firstName: "Ahmed", lastName: "Ben Ali", fullName: "Ahmed Ben Ali", dateOfBirth: "1999-03-15", birthplace: "Casablanca", cin: "BK123456", filiere: "Développement Digital", classe: "DD201", group: "A", status: "verified", documentsUploaded: 3, parentName: "Mohamed Ben Ali", bacYear: "2018", bacScore: "14.50", bacMention: "Bien" },
  { id: "2", firstName: "Fatima Zahra", lastName: "El Idrissi", fullName: "Fatima Zahra El Idrissi", dateOfBirth: "2000-07-22", birthplace: "Rabat", cin: "BH789012", filiere: "Infrastructure Digitale", classe: "ID101", group: "B", status: "mismatch", documentsUploaded: 3, parentName: "Hassan El Idrissi", bacYear: "2019", bacScore: "12.80", bacMention: "Assez Bien" },
  { id: "3", firstName: "Youssef", lastName: "Amrani", fullName: "Youssef Amrani", dateOfBirth: "2001-01-10", birthplace: "Fès", cin: "CD345678", filiere: "Développement Digital", classe: "DD201", group: "A", status: "pending", documentsUploaded: 1, parentName: "Rachid Amrani", bacYear: "2020", bacScore: "15.20", bacMention: "Bien" },
  { id: "4", firstName: "Khadija", lastName: "Bennani", fullName: "Khadija Bennani", dateOfBirth: "2000-11-05", birthplace: "Marrakech", cin: "BE901234", filiere: "Gestion des Entreprises", classe: "GE301", group: "C", status: "missing", documentsUploaded: 0, parentName: "Omar Bennani", bacYear: "2019", bacScore: "13.00", bacMention: "Assez Bien" },
  { id: "5", firstName: "Omar", lastName: "Tazi", fullName: "Omar Tazi", dateOfBirth: "1999-06-18", birthplace: "Tanger", cin: "BJ567890", filiere: "Infrastructure Digitale", classe: "ID101", group: "A", status: "verified", documentsUploaded: 3, parentName: "Karim Tazi", bacYear: "2018", bacScore: "16.00", bacMention: "Très Bien" },
  { id: "6", firstName: "Sara", lastName: "Mouline", fullName: "Sara Mouline", dateOfBirth: "2001-04-25", birthplace: "Agadir", cin: "BM234567", filiere: "Développement Digital", classe: "DD202", group: "B", status: "mismatch", documentsUploaded: 3, parentName: "Driss Mouline", bacYear: "2020", bacScore: "11.50", bacMention: "Passable" },
  { id: "7", firstName: "Hamza", lastName: "Chraibi", fullName: "Hamza Chraibi", dateOfBirth: "2000-09-30", birthplace: "Oujda", cin: "BN890123", filiere: "Gestion des Entreprises", classe: "GE301", group: "A", status: "verified", documentsUploaded: 3, parentName: "Nabil Chraibi", bacYear: "2019", bacScore: "14.00", bacMention: "Bien" },
  { id: "8", firstName: "Zineb", lastName: "El Fassi", fullName: "Zineb El Fassi", dateOfBirth: "2001-12-08", birthplace: "Meknès", cin: "BP456789", filiere: "Infrastructure Digitale", classe: "ID102", group: "C", status: "pending", documentsUploaded: 2, parentName: "Aziz El Fassi", bacYear: "2020", bacScore: "13.75", bacMention: "Assez Bien" },
  { id: "9", firstName: "Rachid", lastName: "Lahlou", fullName: "Rachid Lahlou", dateOfBirth: "2000-02-14", birthplace: "Kenitra", cin: "BQ112233", filiere: "Développement Digital", classe: "DD201", group: "B", status: "mismatch", documentsUploaded: 3, parentName: "Ali Lahlou", bacYear: "2019", bacScore: "12.00", bacMention: "Assez Bien" },
  { id: "10", firstName: "Nadia", lastName: "Bouazza", fullName: "Nadia Bouazza", dateOfBirth: "2001-08-19", birthplace: "Safi", cin: "BR445566", filiere: "Gestion des Entreprises", classe: "GE302", group: "A", status: "verified", documentsUploaded: 3, parentName: "Mustapha Bouazza", bacYear: "2020", bacScore: "15.00", bacMention: "Bien" },
  { id: "11", firstName: "Amine", lastName: "Kettani", fullName: "Amine Kettani", dateOfBirth: "1999-11-03", birthplace: "El Jadida", cin: "BS778899", filiere: "Infrastructure Digitale", classe: "ID102", group: "B", status: "mismatch", documentsUploaded: 3, parentName: "Youssef Kettani", bacYear: "2018", bacScore: "10.50", bacMention: "Passable" },
  { id: "12", firstName: "Houda", lastName: "Filali", fullName: "Houda Filali", dateOfBirth: "2000-05-27", birthplace: "Tétouan", cin: "BT990011", filiere: "Développement Digital", classe: "DD202", group: "A", status: "verified", documentsUploaded: 3, parentName: "Abdelkader Filali", bacYear: "2019", bacScore: "14.25", bacMention: "Bien" },
];

export const mockMismatches: StudentMismatch[] = [
  {
    student: mockStudents[1],
    mismatches: [
      { field: "Full Name", excelValue: "Fatima Zahra El Idrissi", ocrValue: "Fatima-Zahra El Idrissi", document: "birth_certificate" },
      { field: "Date of Birth", excelValue: "2000-07-22", ocrValue: "2000-07-23", document: "cin" },
    ],
    notes: "",
  },
  {
    student: mockStudents[5],
    mismatches: [
      { field: "CIN Number", excelValue: "BM234567", ocrValue: "BM234568", document: "cin" },
    ],
    notes: "",
  },
  {
    student: mockStudents[8],
    mismatches: [
      { field: "Birthplace", excelValue: "Kenitra", ocrValue: "Kénitra", document: "birth_certificate" },
      { field: "Parent Name", excelValue: "Ali Lahlou", ocrValue: "Ali Lahlou Idrissi", document: "birth_certificate" },
    ],
    notes: "",
  },
  {
    student: mockStudents[10],
    mismatches: [
      { field: "Bac Score", excelValue: "10.50", ocrValue: "10.80", document: "baccalaureate" },
    ],
    notes: "",
  },
];

export const dashboardStats = {
  total: mockStudents.length,
  verified: mockStudents.filter(s => s.status === "verified").length,
  pending: mockStudents.filter(s => s.status === "pending").length,
  mismatches: mockStudents.filter(s => s.status === "mismatch").length,
  missing: mockStudents.filter(s => s.status === "missing").length,
};

/** Group students by filière then classe */
export function groupByFiliereClasse(students: any[]): Record<string, Record<string, any[]>> {
  const grouped: Record<string, Record<string, any[]>> = {};
  const sorted = [...students].sort((a, b) => {
    const filiereA = a.LibelleLong || a.filiere || "Unknown Filiere";
    const filiereB = b.LibelleLong || b.filiere || "Unknown Filiere";
    const classeA = a.CodeDiplome || a.classe || "Unknown Classe";
    const classeB = b.CodeDiplome || b.classe || "Unknown Classe";
    return filiereA.localeCompare(filiereB) || classeA.localeCompare(classeB);
  });
  
  for (const s of sorted) {
    const f = s.LibelleLong || s.filiere || "Unknown Filiere";
    const c = s.CodeDiplome || s.classe || "Unknown Classe";
    if (!grouped[f]) grouped[f] = {};
    if (!grouped[f][c]) grouped[f][c] = [];
    grouped[f][c].push(s);
  }
  return grouped;
}
