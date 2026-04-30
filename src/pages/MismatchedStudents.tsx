import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { groupByFiliereClasse, type StudentMismatch } from "@/lib/mock-data";
import { exportMismatchedToExcel, exportMismatchedToPDF } from "@/lib/export-utils";
import { AlertTriangle, ChevronDown, ChevronUp, FileDown, FileSpreadsheet, ExternalLink, FileWarning, CheckCircle2 } from "lucide-react";
import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";

const docLabel = (doc: string) => {
  switch (doc) {
    case "birth_certificate": return "Extrait de Naissance";
    case "baccalaureate": return "Baccalauréat";
    case "cin": return "CIN";
    case "ocr_process": return "Recherche OCR";
    case "verification": return "Validation";
    default: return doc;
  }
};

const MismatchedStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await apiService.fetchStudents();
        setStudents(data.filter(s => s.status === "mismatch"));
      } catch (error) {
        toast.error("Échec du chargement des étudiants non concordants");
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
    <div className="space-y-10 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 brand-gradient-text">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Anomalies de Vérification
          </h1>
          <p className="text-muted-foreground mt-1 font-medium italic">Registre des non-concordances critiques entre les documents OCR et les données institutionnelles</p>
        </div>
        {students.length > 0 && (
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold h-11" onClick={() => exportMismatchedToExcel(students, [])}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
            </Button>
            <Button className="rounded-xl bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 font-bold h-11" onClick={() => exportMismatchedToPDF(students, [])}>
              <FileDown className="mr-2 h-4 w-4" /> Rapport PDF
            </Button>
          </div>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card className="glass-card border-none shadow-2xl py-20">
          <CardContent className="flex flex-col items-center gap-6 text-center">
            <div className="h-20 w-20 rounded-3xl bg-secondary/10 flex items-center justify-center shadow-lg animate-bounce">
              <CheckCircle2 className="h-10 w-10 text-secondary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black brand-gradient-text">Zéro Anomalie</h2>
              <p className="text-muted-foreground font-medium max-w-[400px]">Tous les documents traités ont été validés et sont conformes aux enregistrements du registre.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([filiere, classes]) => (
          <Card key={filiere} className="glass-card border-none shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
            <CardHeader className="bg-primary/5 border-b border-primary/10 py-6 px-8">
              <CardTitle className="flex items-center gap-3">
                <Badge className="bg-primary/15 text-primary border-primary/20 rounded-full px-4 py-1.5 font-black text-[11px] tracking-widest">
                  FILIÈRE: {filiere}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Object.entries(classes).map(([classe, students]) => (
                <div key={classe} className="space-y-0">
                  <div className="bg-muted/30 px-8 py-3 border-b border-primary/5">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Groupe de Formation: {classe}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow className="hover:bg-transparent border-b border-primary/5">
                          <TableHead className="px-8 font-bold text-[10px] uppercase tracking-widest py-4">Candidat</TableHead>
                          <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest py-4 pr-12">Identité Arabe</TableHead>
                          <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">CIN / DOB</TableHead>
                          <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest py-4">Incidents</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map(student => {
                          const mm = getMismatches(student);
                          const isExpanded = expandedStudent === student.id;
                          return (
                            <Fragment key={student.id}>
                              <TableRow
                                className={`group cursor-pointer transition-colors border-b border-primary/5 ${isExpanded ? "bg-destructive/5" : "hover:bg-primary/5"}`}
                                onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                              >
                                <TableCell className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className="font-black uppercase text-sm group-hover:text-primary transition-colors">{student.Nom} {student.Prenom}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono tracking-tighter uppercase">{student.CodeDiplome}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-5 pr-12 text-right font-arabic" dir="rtl">
                                  <span className="font-bold text-base text-secondary/80 italic">
                                    {(student as any).verified_arabic_name || (student.Nom_Arabe || student.Prenom_arabe 
                                      ? `${student.Nom_Arabe || ''} ${student.Prenom_arabe || ''}`.trim() 
                                      : <span className="text-muted-foreground/30 font-normal">غير متوفر</span>)}
                                  </span>
                                </TableCell>
                                <TableCell className="py-5">
                                  <div className="flex flex-col">
                                    <span className="font-mono font-bold text-xs text-primary">{student.cin}</span>
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">{student.DateNaissance}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-5">
                                  <Badge className="bg-destructive/15 text-destructive border-destructive/20 rounded-full px-3 py-1 font-black text-[10px] tracking-widest">
                                    {mm ? mm.mismatches.length : "?"} ERREUR{mm && mm.mismatches.length > 1 ? "S" : ""}
                                  </Badge>
                                </TableCell>
                                <TableCell className="pr-8 text-center py-5">
                                  <div className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </TableCell>
                              </TableRow>
                              {isExpanded && mm && (
                                <TableRow key={`${student.id}-detail`} className="hover:bg-transparent">
                                  <TableCell colSpan={5} className="p-0 border-b border-primary/5">
                                    <div className="px-12 py-8 bg-destructive/5 space-y-6 animate-in slide-in-from-top-2 duration-300">
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-black text-destructive uppercase tracking-[0.2em]">Rapport d'Analyse Comparative</p>
                                        <Button size="sm" variant="ghost" className="h-8 text-[10px] font-black uppercase tracking-widest hover:text-primary" onClick={() => navigate(`/students/${student.id}`)}>
                                          Voir le dossier complet <ExternalLink className="ml-2 h-3 w-3" />
                                        </Button>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 gap-3">
                                        {mm.mismatches.map((m: any, i: number) => (
                                          <div key={i} className="flex flex-col md:flex-row md:items-center gap-6 rounded-3xl border border-destructive/10 bg-background/80 backdrop-blur-md p-6 shadow-sm group/item hover:border-destructive/30 transition-all">
                                            <div className="flex items-center gap-4 min-w-[180px]">
                                              <div className="h-10 w-10 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive group-hover/item:scale-110 transition-transform">
                                                <FileWarning className="h-5 w-5" />
                                              </div>
                                              <div>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Source Document</p>
                                                <p className="text-xs font-bold">{docLabel(m.document || "OCR")}</p>
                                              </div>
                                            </div>
                                            
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                                              <div className="space-y-1">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Attendu (Registre)</p>
                                                <p className="text-sm font-black text-foreground">"{m.excelValue || "N/A"}"</p>
                                              </div>
                                              <div className="space-y-1">
                                                <p className="text-[10px] font-black text-destructive uppercase tracking-widest opacity-80">Détecté (Extraction)</p>
                                                <p className="text-sm font-black text-destructive">"{m.ocrValue || "VIDE"}"</p>
                                              </div>
                                            </div>
                                            
                                            <Badge variant="outline" className="rounded-full border-destructive/30 text-destructive font-black text-[9px] px-3 py-1 uppercase tracking-wider">
                                              {m.field || "DISCORDANCE"}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                      
                                      <div className="pt-6 border-t border-destructive/10 grid grid-cols-2 md:grid-cols-4 gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                        <div className="flex flex-col gap-1">
                                          <span>Matricule</span>
                                          <span className="text-foreground/80 font-mono text-xs">{student.cin}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <span>Candidat</span>
                                          <span className="text-foreground/80 font-mono text-xs">{student.fullName || `${student.Nom} ${student.Prenom}`}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <span>Code Diplôme</span>
                                          <span className="text-foreground/80 font-mono text-xs">{student.CodeDiplome}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <span>Identifiant</span>
                                          <span className="text-foreground/80 font-mono text-xs">{student.id}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
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

export default MismatchedStudents;
