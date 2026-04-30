import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ArrowUpDown, MoreHorizontal, User, Users, Upload, Trash2, Eye, CheckCircle2, AlertCircle, FileWarning, XCircle, ShieldCheck, FileCheck, FileX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, Student } from "@/lib/api-service";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Students = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await apiService.fetchStudents();
      setStudents(data);
    } catch (error) {
      toast.error("Échec du chargement des étudiants depuis la base de données");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDelete = async () => {
    if (!studentToDelete) return;

    try {
      await apiService.deleteStudent(studentToDelete.id);
      toast.success(`L'étudiant ${studentToDelete.Nom} ${studentToDelete.Prenom} a été supprimé avec succès`);
      setStudents(students.filter(s => s.id !== studentToDelete.id));
    } catch (error) {
      toast.error("Échec de la suppression de l'étudiant");
      console.error(error);
    } finally {
      setStudentToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const fullName = `${s.Nom || ''} ${s.Prenom || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
      (s.cin && s.cin.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesGroup = groupFilter === "all" || s.CodeDiplome === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
  });

  const uniqueGroups = Array.from(new Set(students.map(s => s.CodeDiplome).filter(Boolean))).sort();

  const handleVerifyGroup = async () => {
    if (groupFilter === "all") {
      toast.error("Veuillez d'abord sélectionner un groupe");
      return;
    }

    // Check if any student in the filtered group has documents
    const groupStudents = students.filter(s => s.CodeDiplome === groupFilter);
    const withDocs = groupStudents.filter(s => (s.documentsUploaded ?? 0) > 0 || (s as any).documents_count > 0);
    if (withDocs.length === 0) {
      toast.warning(`Aucun document téléversé pour le groupe ${groupFilter}. Veuillez d'abord téléverser des documents.`);
      return;
    }

    setIsVerifying(true);
    const toastId = toast.loading(`Vérification du groupe ${groupFilter}... (0/${withDocs.length})`);
    
    let successCount = 0;
    const currentResults: any[] = [];
    
    try {
      for (let i = 0; i < withDocs.length; i++) {
        const student = withDocs[i];
        toast.loading(`Vérification du groupe ${groupFilter}... (${i + 1}/${withDocs.length}) - ${student.Nom} ${student.Prenom}`, { id: toastId });
        
        try {
          const result = await apiService.verifyStudent(student.cin);
          currentResults.push(result);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to verify student ${student.cin}:`, err);
          // We continue with the next student even if one fails
        }
      }
      
      setResults(currentResults);
      
      if (successCount === withDocs.length) {
        toast.success(`Vérification terminée ! ${successCount} étudiants traités avec succès.`, { id: toastId });
      } else {
        toast.warning(`Vérification terminée avec des erreurs. ${successCount}/${withDocs.length} étudiants traités.`, { id: toastId });
      }
      
      fetchStudents(); // Refresh data
    } catch (error: any) {
      toast.error(`Erreur inattendue pendant la vérification.`, { id: toastId });
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified": 
        return (
          <Badge className="bg-secondary/15 text-secondary border-secondary/20 rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest shadow-lg shadow-secondary/5">
            <ShieldCheck className="h-3 w-3 mr-1.5" />
            CONFORME
          </Badge>
        );
      case "mismatch": 
        return (
          <Badge className="bg-destructive/15 text-destructive border-destructive/20 rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest shadow-lg shadow-destructive/5">
            <AlertCircle className="h-3 w-3 mr-1.5" />
            ANOMALIE
          </Badge>
        );
      case "pending": 
        return (
          <Badge className="bg-primary/15 text-primary border-primary/20 rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest">
            <ArrowUpDown className="h-3 w-3 mr-1.5 animate-bounce" />
            EN ATTENTE
          </Badge>
        );
      case "missing": 
        return (
          <Badge variant="outline" className="text-muted-foreground border-dashed rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest bg-muted/10 opacity-60">
            <FileX className="h-3 w-3 mr-1.5" />
            INCOMPLET
          </Badge>
        );
      default: 
        return <Badge className="rounded-full px-4 py-1.5 font-black text-[10px] uppercase tracking-widest">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight brand-gradient-text">Gestion des Vérifications</h1>
          <p className="text-muted-foreground mt-1">Supervision du processus OCR et validation de l'intégrité des données institutionnelles</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate("/import")} variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold">
            <Users className="mr-2 h-4 w-4" /> Importer Étudiants
          </Button>
          <Button onClick={() => navigate("/upload")} className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 font-bold">
            <Upload className="mr-2 h-4 w-4" /> Téléverser Documents
          </Button>
        </div>
      </div>

      <Card className="glass-card border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
          <div className="flex flex-col xl:flex-row gap-5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, CIN ou Massar..."
                className="pl-11 h-11 rounded-xl bg-background/50 border-primary/10 focus-visible:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-11 rounded-xl bg-background/50 border-primary/10">
                  <Filter className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue placeholder="Filtrer par Statut" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="all">Tous les Statuts</SelectItem>
                  <SelectItem value="verified">Conformes</SelectItem>
                  <SelectItem value="mismatch">Non Concordants</SelectItem>
                  <SelectItem value="pending">En Attente</SelectItem>
                  <SelectItem value="missing">Docs Manquants</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[180px] h-11 rounded-xl bg-background/50 border-primary/10">
                  <Filter className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue placeholder="Filtrer par Groupe" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/10">
                  <SelectItem value="all">Tous les Groupes</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {groupFilter !== "all" && (
                <Button 
                  onClick={handleVerifyGroup} 
                  disabled={isVerifying}
                  className="h-11 rounded-xl bg-secondary hover:bg-secondary/90 text-white shadow-lg shadow-secondary/20 font-bold px-6 min-w-[240px]"
                >
                  {isVerifying ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Traitement en cours...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Vérifier le Groupe {groupFilter}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b border-primary/5">
                  <TableHead className="w-[120px] font-bold text-[11px] uppercase tracking-widest py-5">CIN</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest py-5">Identité (FR)</TableHead>
                  <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest py-5 pr-8">Identité (AR)</TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-widest py-5">Filière / Groupe</TableHead>
                  <TableHead className="text-center font-bold text-[11px] uppercase tracking-widest py-5">Documents</TableHead>
                  <TableHead className="text-center font-bold text-[11px] uppercase tracking-widest py-5">État OCR</TableHead>
                  <TableHead className="text-center font-bold text-[11px] uppercase tracking-widest py-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm font-medium text-muted-foreground italic">Synchronisation des données...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student, idx) => {
                    return (
                      <TableRow
                        key={student.id}
                        className="group hover:bg-primary/5 transition-all cursor-pointer border-b border-primary/5"
                        onClick={() => navigate(`/students/${student.id}`)}
                      >
                        <TableCell className="font-mono font-bold text-sm text-primary/80 py-5">{student.cin}</TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col">
                            <span className="font-bold uppercase text-sm group-hover:text-primary transition-colors">{student.Nom} {student.Prenom}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{student.NiveauScolaire || "Niveau non défini"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5 pr-8 text-right font-arabic" dir="rtl">
                          {student.Nom_Arabe || student.Prenom_arabe
                            ? <span className="font-bold text-base text-secondary/80">{student.Nom_Arabe || ''} {student.Prenom_arabe || ''}</span>
                            : <span className="text-muted-foreground/30 text-xs italic">Non renseigné</span>}
                        </TableCell>
                        <TableCell className="py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold truncate max-w-[150px]">{student.LibelleLong || "Filière inconnue"}</span>
                            <Badge variant="outline" className="w-fit text-[10px] h-5 px-2 mt-1 border-primary/10 bg-primary/5 text-primary font-bold">{student.CodeDiplome || "-"}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-5">
                          {(() => {
                            const actualCount = (student as any).documents_count ?? student.documentsUploaded ?? 0;
                            const percentage = (actualCount / 3) * 100;
                            return (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black ${actualCount === 3 ? "text-secondary" : actualCount > 0 ? "text-amber-500" : "text-destructive"}`}>
                                    {actualCount}/3
                                  </span>
                                  <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-1000 ${actualCount === 3 ? "bg-secondary" : actualCount > 0 ? "bg-amber-500" : "bg-destructive"}`} 
                                      style={{ width: `${percentage}%` }} 
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center py-5">
                          {getStatusBadge(student.status)}
                        </TableCell>
                        <TableCell className="text-center py-5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                              onClick={() => navigate(`/students/${student.id}`)}
                              title="Détails"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all"
                              onClick={() => {
                                setStudentToDelete(student);
                                setIsDeleteDialogOpen(true);
                              }}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-32 text-muted-foreground italic font-medium">
                      Aucune donnée trouvée pour les filtres sélectionnés
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {results.length > 0 && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="bg-primary/5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                Derniers résultats de vérification : {groupFilter}
              </CardTitle>
              <CardDescription>Résultats détaillés pour {results.length} étudiants</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setResults([])}>
              <XCircle className="mr-2 h-4 w-4" /> Effacer les résultats
            </Button>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {results.map((res, idx) => {
                const student = students.find(s => s.cin === res.cin);
                // Use student database status as source of truth if available
                const isCorrect = student ? student.status === "verified" : res.is_correct;
                const dbMismatches = student?.mismatch_details || [];
                
                return (
                  <div key={idx} className={`rounded-xl border-2 p-5 mb-4 ${isCorrect ? "bg-emerald-500/5 border-emerald-500/20 shadow-sm" : "bg-rose-500/5 border-rose-500/20 shadow-md"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isCorrect ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"}`}>
                          {isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-lg leading-none mb-1 text-foreground">CIN: {res.cin}</p>
                          <p className="text-sm text-muted-foreground">{res.folder}</p>
                        </div>
                      </div>
                      <Badge variant={isCorrect ? "success" : "destructive"} className="px-3 py-1">
                        {isCorrect ? "CONCORDANT" : "NON CONCORDANT"}
                      </Badge>
                    </div>

                    {/* Name comparison: OCR extracted vs Database record */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* OCR Extracted */}
                      <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">📄 Extrait des Documents (OCR) :</p>
                        <div className="space-y-1.5">
                          {/* French name from CIN */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 shrink-0">FR :</span>
                            <span className={`text-sm font-semibold ${res.verified_name ? (isCorrect ? "text-green-700" : "text-amber-700") : "text-red-400 italic"}`}>
                              {res.verified_name || "Nom non extrait"}
                            </span>
                          </div>
                          {/* Arabic name from BAC */}
                          <div className="flex items-center gap-1.5" dir="rtl">
                            <span className="text-[10px] text-gray-400 shrink-0">عر :</span>
                            <span className={`text-sm font-semibold ${res.verified_arabic_name ? (isCorrect ? "text-green-700" : "text-amber-700") : "text-red-400 italic"}`}>
                              {res.verified_arabic_name || "الاسم غير مستخرج"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Database Record */}
                      <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">🗄️ Enregistrement Base de données :</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 shrink-0">FR :</span>
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {student ? `${student.Nom} ${student.Prenom}` : "Introuvable"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5" dir="rtl">
                            <span className="text-[10px] text-gray-400 shrink-0">عر :</span>
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                              {student?.Nom_Arabe || student?.Prenom_arabe
                                ? `${student?.Nom_Arabe || ''} ${student?.Prenom_arabe || ''}`.trim()
                                : <span className="text-gray-400 italic font-normal">غير متوفر</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(res.errors && res.errors.length > 0 || dbMismatches.length > 0) && (
                      <div className={`mb-4 p-4 rounded-lg border ${isCorrect ? "bg-amber-500/10 border-amber-500/20" : "bg-rose-500/10 border-rose-500/20"}`}>
                        <p className={`text-xs font-bold mb-2 flex items-center gap-2 ${isCorrect ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                          <AlertCircle className="h-3 w-3" /> {isCorrect ? "Avertissements / Remarques :" : "Détails des Non Concordances / Erreurs :"}
                        </p>
                        <ul className="space-y-1">
                          {/* Prefer DB mismatches if available, fallback to OCR errors */}
                          {dbMismatches.length > 0 ? (
                            dbMismatches.map((m: any, i: number) => (
                              <li key={i} className={`text-xs flex items-start gap-2 ${m.soft ? "text-amber-700" : "text-red-700"}`}>
                                <span className="shrink-0">•</span>
                                <span>
                                  <strong>{m.field}</strong> ({m.document}): 
                                  Attendu "{m.excelValue}", Obtenu "{m.ocrValue}"
                                </span>
                              </li>
                            ))
                          ) : (
                            res.errors && res.errors.map((err: any, i: number) => (
                              <li key={i} className={`text-xs flex items-start gap-2 ${err.soft ? "text-amber-700" : "text-red-700"}`}>
                                <span className="shrink-0">•</span>
                                <span><strong>{err.file}</strong>: {err.error}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Extractions de Documents :</p>
                      <div className="flex flex-wrap gap-3">
                        {res.file_details && res.file_details.map((detail: any, i: number) => {
                          const isBacFile = detail.file.toLowerCase().includes('baccalaureate');
                          return (
                            <div key={i} className={`flex-1 min-w-[220px] p-3 rounded-lg border ${
                              isBacFile 
                                ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800' 
                                : 'bg-white/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700'
                            }`}>
                              <p className="text-[10px] font-bold truncate mb-2 flex items-center gap-1" title={detail.file}>
                                <span>{isBacFile ? '🎓' : '🪪'}</span>
                                <span className="truncate">{detail.file}</span>
                              </p>
                              <div className="space-y-1">
                                {detail.extracted_name && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 shrink-0">Nom :</span>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{detail.extracted_name}</span>
                                  </div>
                                )}
                                {detail.extracted_arabic_name && (
                                  <div className="flex items-center gap-1.5" dir="rtl">
                                    <span className="text-[10px] text-gray-400 shrink-0">الاسم :</span>
                                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 truncate">{detail.extracted_arabic_name}</span>
                                  </div>
                                )}
                                {detail.extracted_cne && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 shrink-0">CNE :</span>
                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{detail.extracted_cne}</span>
                                  </div>
                                )}
                                {detail.extracted_dob && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 shrink-0">D.Nais :</span>
                                    <Badge variant="outline" className="text-[10px] font-normal py-0">{detail.extracted_dob}</Badge>
                                  </div>
                                )}
                                {!detail.extracted_name && !detail.extracted_arabic_name && !detail.extracted_cne && (
                                  <span className="text-xs text-red-400 italic">Aucune donnée extraite</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
            })}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Cela supprimera définitivement <strong>{studentToDelete?.Nom} {studentToDelete?.Prenom}</strong> de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Students;
