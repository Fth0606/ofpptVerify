import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { groupByFiliereClasse } from "@/lib/mock-data";
import { exportVerifiedToExcel, exportVerifiedToPDF } from "@/lib/export-utils";
import { CheckCircle2, FileDown, FileSpreadsheet } from "lucide-react";
import { useState, useEffect } from "react";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";

const CorrectStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await apiService.fetchStudents();
        setStudents(data.filter(s => s.status === "verified"));
      } catch (error) {
        toast.error("Failed to load verified students");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const grouped = groupByFiliereClasse(students);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-success" />
            Verified Students
          </h1>
          <p className="text-muted-foreground">Students whose document data matches Excel records, grouped by filière and classe</p>
        </div>
        {students.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportVerifiedToExcel(students)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportVerifiedToPDF(students)}>
              <FileDown className="mr-2 h-4 w-4" />PDF
            </Button>
          </div>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <p className="font-medium">No verified students yet</p>
            <p className="text-sm text-muted-foreground">Upload and verify documents to see results here</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([filiere, classes]) => (
          <Card key={filiere}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="outline" className="text-sm font-semibold px-3 py-1">{filiere}</Badge>
                <span className="text-xs text-muted-foreground ml-2">
                  {Object.values(classes).flat().length} student{Object.values(classes).flat().length > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(classes).map(([classe, students]) => (
                <div key={classe} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground border-b border-border pb-1">
                    Classe: {classe}
                  </h3>
                  <Table>
                    <TableHeader className="bg-slate-800 hover:bg-slate-800">
                      <TableRow className="hover:bg-transparent border-b-0">
                        <TableHead className="text-white font-bold uppercase py-4">CIN</TableHead>
                        <TableHead className="text-white font-bold uppercase py-4">Nom</TableHead>
                        <TableHead className="text-white font-bold uppercase py-4">Prénom</TableHead>
                        <TableHead className="text-white font-bold uppercase py-4 text-center">Age</TableHead>
                        <TableHead className="text-white font-bold uppercase py-4 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(student => {
                        const calculateAge = (dob: string) => {
                          if (!dob) return "-";
                          try {
                            const birthDate = new Date(dob);
                            if (isNaN(birthDate.getTime())) return "-";
                            const today = new Date();
                            let age = today.getFullYear() - birthDate.getFullYear();
                            const m = today.getMonth() - birthDate.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                              age--;
                            }
                            return age;
                          } catch {
                            return "-";
                          }
                        };

                        return (
                          <TableRow key={student.id} className="border-b">
                            <TableCell className="font-mono text-xs">{student.cin}</TableCell>
                            <TableCell className="font-medium uppercase">{student.lastName || "-"}</TableCell>
                            <TableCell className="font-medium capitalize">{student.firstName || "-"}</TableCell>
                            <TableCell className="text-center">{calculateAge(student.dateOfBirth)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-success/15 text-success border-0">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Verified
                              </Badge>
                            </TableCell>
                          </TableRow>
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

export default CorrectStudents;
