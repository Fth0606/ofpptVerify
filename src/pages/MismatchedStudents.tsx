import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { groupByFiliereClasse, type StudentMismatch } from "@/lib/mock-data";
import { exportMismatchedToExcel, exportMismatchedToPDF } from "@/lib/export-utils";
import { AlertTriangle, ChevronDown, ChevronUp, FileDown, FileSpreadsheet } from "lucide-react";
import { useState, useEffect } from "react";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";

const docLabel = (doc: string) => {
  switch (doc) {
    case "birth_certificate": return "Birth Certificate";
    case "baccalaureate": return "Baccalaureate";
    case "cin": return "CIN";
    case "ocr_process": return "OCR Search";
    case "verification": return "Validation";
    default: return doc;
  }
};

const MismatchedStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await apiService.fetchStudents();
        setStudents(data.filter(s => s.status === "mismatch"));
      } catch (error) {
        toast.error("Failed to load mismatched students");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const grouped = groupByFiliereClasse(students);

  const getMismatches = (student: Student): any => {
    return student.mismatch_details ? {
      studentId: student.id,
      mismatches: student.mismatch_details
    } : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-warning" />
            Students with Mismatches
          </h1>
          <p className="text-muted-foreground">Students whose document data differs from Excel records, grouped by filière and classe</p>
        </div>
        {students.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportMismatchedToExcel(students, [])}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportMismatchedToPDF(students, [])}>
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
          </div>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <p className="font-medium text-success">No mismatches found!</p>
            <p className="text-sm text-muted-foreground">All student data matches their documents</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([filiere, classes]) => (
          <Card key={filiere}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="outline" className="text-sm font-semibold px-3 py-1">{filiere}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(classes).map(([classe, students]) => (
                <div key={classe} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b border-border pb-1">
                    Classe: {classe}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>CIN</TableHead>
                        <TableHead>Date of Birth</TableHead>
                        <TableHead>Birthplace</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Bac</TableHead>
                        <TableHead>Issues</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(student => {
                        const mm = getMismatches(student);
                        const isExpanded = expandedStudent === student.id;
                        return (
                          <>
                            <TableRow
                              key={student.id}
                              className="cursor-pointer hover:bg-warning/5"
                              onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                            >
                              <TableCell className="font-medium">{student.fullName}</TableCell>
                              <TableCell>{student.cin}</TableCell>
                              <TableCell>{student.dateOfBirth}</TableCell>
                              <TableCell>{student.birthplace}</TableCell>
                              <TableCell>{student.group}</TableCell>
                              <TableCell className="text-xs">{student.bacScore} ({student.bacMention})</TableCell>
                              <TableCell>
                                <Badge className="bg-warning/15 text-warning border-0">
                                  {mm ? mm.mismatches.length : "?"} issue{mm && mm.mismatches.length > 1 ? "s" : ""}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </TableCell>
                            </TableRow>
                            {isExpanded && mm && (
                              <TableRow key={`${student.id}-detail`}>
                                <TableCell colSpan={8} className="bg-destructive/5 p-4">
                                  <div className="space-y-2">
                                    <p className="text-sm font-semibold text-destructive">Mismatch Details:</p>
                                    {mm.mismatches.map((m, i) => (
                                      <div key={i} className="flex items-center gap-4 rounded-lg border border-destructive/20 bg-background p-3">
                                        <Badge variant="outline" className="text-xs shrink-0">{docLabel(m.document)}</Badge>
                                        <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
                                          <span className="font-medium">{m.field}</span>
                                          <span>Excel: <strong>{m.excelValue}</strong></span>
                                          <span>Document: <strong className="text-destructive">{m.ocrValue}</strong></span>
                                        </div>
                                      </div>
                                    ))}
                                    <p className="text-xs text-muted-foreground mt-2">Parent: {student.parentName} · Bac Year: {student.bacYear}</p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default MismatchedStudents;
