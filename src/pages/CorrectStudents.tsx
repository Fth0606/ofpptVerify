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
        toast.error("Échec du chargement des étudiants vérifiés");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const grouped = groupByFiliereClasse(students);

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 brand-gradient-text uppercase">
            <CheckCircle2 className="h-8 w-8 text-secondary" />
            Registre des Conformités
          </h1>
          <p className="text-muted-foreground mt-1 font-medium italic">Étudiants dont les dossiers documentaires ont été intégralement validés par le système OCR</p>
        </div>
        {students.length > 0 && (
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold h-11" onClick={() => exportVerifiedToExcel(students)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
            </Button>
            <Button className="rounded-xl bg-secondary hover:bg-secondary/90 text-white shadow-lg shadow-secondary/20 font-bold h-11" onClick={() => exportVerifiedToPDF(students)}>
              <FileDown className="mr-2 h-4 w-4" /> Certificats PDF
            </Button>
          </div>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="glass-card border-none shadow-2xl py-20">
          <CardContent className="flex flex-col items-center gap-6 text-center">
            <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-muted-foreground">Aucune Validation</h2>
              <p className="text-muted-foreground font-medium max-w-[400px]">Lancez le processus de vérification OCR pour alimenter le registre des conformités.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([filiere, classes], idx) => (
          <Card key={filiere} className="glass-card border-none shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <CardHeader className="bg-secondary/5 border-b border-secondary/10 py-6 px-8 flex flex-row items-center justify-between">
              <Badge className="bg-secondary/15 text-secondary border-secondary/20 rounded-full px-4 py-1.5 font-black text-[11px] tracking-widest uppercase">
                FILIÈRE: {filiere}
              </Badge>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {Object.values(classes).flat().length} dossier{Object.values(classes).flat().length > 1 ? "s" : ""} conforme{Object.values(classes).flat().length > 1 ? "s" : ""}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {Object.entries(classes).map(([classe, students]) => (
                <div key={classe} className="space-y-0">
                  <div className="bg-muted/30 px-8 py-3 border-b border-secondary/5">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                      Groupe de Formation: {classe}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow className="hover:bg-transparent border-b border-secondary/5">
                          <TableHead className="px-8 font-bold text-[10px] uppercase tracking-widest py-4">Matricule CIN</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">Candidat (FR)</TableHead>
                          <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest py-4 pr-12">Identité Arabe</TableHead>
                          <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest py-4">Âge</TableHead>
                          <TableHead className="text-right pr-8 font-bold text-[10px] uppercase tracking-widest py-4">Validation</TableHead>
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
                            <TableRow key={student.id} className="group hover:bg-secondary/5 transition-colors border-b border-secondary/5">
                              <TableCell className="px-8 py-5 font-mono font-bold text-xs text-primary">{student.cin}</TableCell>
                              <TableCell className="py-5 font-black uppercase text-sm group-hover:text-secondary transition-colors">
                                {student.Nom} {student.Prenom}
                              </TableCell>
                              <TableCell className="py-5 pr-12 text-right font-arabic" dir="rtl">
                                <span className="font-bold text-base text-secondary italic">
                                  {(student as any).verified_arabic_name || (student.Nom_Arabe || student.Prenom_arabe 
                                    ? `${student.Nom_Arabe || ''} ${student.Prenom_arabe || ''}`.trim() 
                                    : "-")}
                                </span>
                              </TableCell>
                              <TableCell className="text-center py-5 font-bold text-muted-foreground">{calculateAge(student.DateNaissance)} ans</TableCell>
                              <TableCell className="text-right pr-8 py-5">
                                <Badge className="bg-secondary/15 text-secondary border-secondary/20 rounded-full px-3 py-1 font-black text-[9px] tracking-widest">
                                  CONFORME
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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
