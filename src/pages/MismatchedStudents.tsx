import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockStudents, mockMismatches, groupByFiliereClasse, type StudentMismatch } from "@/lib/mock-data";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const docLabel = (doc: string) => {
  switch (doc) {
    case "birth_certificate": return "Birth Certificate";
    case "baccalaureate": return "Baccalaureate";
    case "cin": return "CIN";
    default: return doc;
  }
};

const MismatchedStudents = () => {
  const mismatchStudents = mockStudents.filter(s => s.status === "mismatch");
  const grouped = groupByFiliereClasse(mismatchStudents);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const getMismatches = (studentId: string): StudentMismatch | undefined =>
    mockMismatches.find(m => m.student.id === studentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-warning" />
          Students with Mismatches
        </h1>
        <p className="text-muted-foreground">Students whose document data differs from Excel records, grouped by filière and classe</p>
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
                        const mm = getMismatches(student.id);
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
