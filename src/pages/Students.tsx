import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ArrowUpDown, MoreHorizontal, User, Trash2, Eye, CheckCircle2, AlertCircle, FileWarning, XCircle, ShieldCheck, FileCheck, FileX } from "lucide-react";
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
    const toastId = toast.loading(`Vérification du groupe ${groupFilter}... Cela peut prendre une minute.`);
    
    try {
      const response = await apiService.verifyGroup(groupFilter);
      setResults(response);
      toast.success(`Vérification du groupe ${groupFilter} terminée ! ${response.length} étudiants traités.`, { id: toastId });
      fetchStudents(); // Refresh data
    } catch (error: any) {
      const msg = error.message || "La vérification a échoué";
      if (msg.includes("No documents") || msg.includes("Aucun document")) {
        toast.warning(`Aucun document téléversé pour ce groupe. Téléversez des documents d'abord.`, { id: toastId });
      } else {
        toast.error(`La vérification a échoué : ${msg}`, { id: toastId });
      }
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge variant="success">Vérifié</Badge>;
      case "mismatch": return <Badge variant="destructive">Non Concordant</Badge>;
      case "pending": return <Badge variant="secondary">En Attente</Badge>;
      case "missing": return <Badge variant="outline">Docs Manquants</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panneau de Vérification</h1>
          <p className="text-muted-foreground">Sélectionnez un groupe ci-dessous et cliquez sur "Vérifier le Groupe" pour faire correspondre les documents avec les enregistrements.</p>
        </div>
        <Button onClick={() => navigate("/import")} variant="outline">Importer la liste des étudiants</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou CIN..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les Statuts</SelectItem>
                  <SelectItem value="verified">Vérifiés</SelectItem>
                  <SelectItem value="mismatch">Non Concordants</SelectItem>
                  <SelectItem value="pending">En Attente</SelectItem>
                  <SelectItem value="missing">Docs Manquants</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Groupe" />
                </SelectTrigger>
                <SelectContent>
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
                  className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                >
                  {isVerifying ? "Vérification..." : `Lancer la vérification pour ${groupFilter}`}
                </Button>
              )}
            </div>
          </div>
          {groupFilter !== "all" && !isVerifying && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              <strong>Astuce :</strong> Cliquer sur "Lancer la vérification" traitera tous les étudiants de <strong>{groupFilter}</strong> qui ont téléversé des documents.
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CIN <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead>Nom <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead>Prénom <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead>الاسم العربي</TableHead>
                  <TableHead>Filière <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead>Niveau Scolaire <ArrowUpDown className="inline h-3 w-3" /></TableHead>
                  <TableHead className="text-center">Docs</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">Chargement des étudiants...</TableCell>
                  </TableRow>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
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
                      <TableRow
                        key={student.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/students/${student.id}`)}
                      >
                        <TableCell className="font-mono text-sm py-4">{student.cin}</TableCell>
                        <TableCell className="font-medium py-4 uppercase">{student.Nom || "-"}</TableCell>
                        <TableCell className="font-medium py-4 capitalize">{student.Prenom || "-"}</TableCell>
                        <TableCell className="py-4 text-right font-medium" dir="rtl">
                          {student.Nom_Arabe || student.Prenom_arabe
                            ? `${student.Nom_Arabe || ''} ${student.Prenom_arabe || ''}`.trim()
                            : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="py-4">{student.LibelleLong || "-"}</TableCell>
                        <TableCell className="py-4 font-mono text-sm">{student.NiveauScolaire || "-"}</TableCell>
                        <TableCell className="text-center py-4">
                          {(() => {
                            // documents_count is returned by withCount('documents') on the backend
                            const actualCount = (student as any).documents_count ?? student.documentsUploaded ?? 0;
                            if (actualCount >= 3) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                                  <FileCheck className="h-3 w-3" />
                                  {actualCount}/3
                                </span>
                              );
                            } else if (actualCount > 0) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                  <FileCheck className="h-3 w-3" />
                                  {actualCount}/3
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                  <FileX className="h-3 w-3" />
                                  0/3
                                </span>
                              );
                            }
                          })()}
                        </TableCell>
                        <TableCell className="text-center py-4">
                          {getStatusBadge(student.status)}
                        </TableCell>
                        <TableCell className="text-center py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-400"
                              onClick={() => navigate(`/students/${student.id}`)}
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Voir
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 px-3 bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                setStudentToDelete(student);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Supprimer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucun étudiant ne correspond à vos critères
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
