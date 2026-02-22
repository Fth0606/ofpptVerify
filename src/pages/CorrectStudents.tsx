import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockStudents, groupByFiliereClasse } from "@/lib/mock-data";
import { exportVerifiedToExcel, exportVerifiedToPDF } from "@/lib/export-utils";
import { CheckCircle2, FileDown, FileSpreadsheet } from "lucide-react";

const CorrectStudents = () => {
  const verifiedStudents = mockStudents.filter(s => s.status === "verified");
  const grouped = groupByFiliereClasse(verifiedStudents);

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
        {verifiedStudents.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportVerifiedToExcel(verifiedStudents)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportVerifiedToPDF(verifiedStudents)}>
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
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>CIN</TableHead>
                        <TableHead>Date of Birth</TableHead>
                        <TableHead>Birthplace</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead>Parent Name</TableHead>
                        <TableHead>Bac Year</TableHead>
                        <TableHead>Bac Score</TableHead>
                        <TableHead>Mention</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(student => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.fullName}</TableCell>
                          <TableCell>{student.cin}</TableCell>
                          <TableCell>{student.dateOfBirth}</TableCell>
                          <TableCell>{student.birthplace}</TableCell>
                          <TableCell>{student.group}</TableCell>
                          <TableCell>{student.parentName}</TableCell>
                          <TableCell>{student.bacYear}</TableCell>
                          <TableCell>{student.bacScore}</TableCell>
                          <TableCell>{student.bacMention}</TableCell>
                          <TableCell>
                            <Badge className="bg-success/15 text-success border-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Verified
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
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
