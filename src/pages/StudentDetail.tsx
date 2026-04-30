import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiService, StudentDocument, getDocumentUrl } from "@/lib/api-service";
import type { Student } from "@/lib/api-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Upload, FileText, CreditCard, GraduationCap,
  Loader2, ExternalLink, Trash2, CheckCircle2, Clock, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
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

const statusBadge = (status: string) => {
  switch (status) {
    case "verified": 
      return (
        <Badge className="bg-secondary/15 text-secondary border-secondary/20 rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest shadow-[0_0_15px_rgba(46,125,50,0.1)]">
          CONFORME
        </Badge>
      );
    case "mismatch": 
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/20 rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          ERREUR OCR
        </Badge>
      );
    case "pending": 
      return (
        <Badge className="bg-primary/15 text-primary border-primary/20 rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest">
          EN ATTENTE
        </Badge>
      );
    case "missing": 
      return (
        <Badge variant="outline" className="text-muted-foreground border-dashed rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest">
          DOCS MANQUANTS
        </Badge>
      );
    default: 
      return <Badge className="rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest">{status}</Badge>;
  }
};

const ocrStatusIcon = (status: string) => {
  switch (status) {
    case "processed": return <CheckCircle2 className="h-4 w-4 text-secondary" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-destructive" />;
    default: return <Clock className="h-4 w-4 text-primary" />;
  }
};

const DOC_TYPES: { key: StudentDocument["type"]; label: string; icon: any }[] = [
  { key: "birth_certificate", label: "Extrait de Naissance", icon: FileText },
  { key: "baccalaureate", label: "Baccalauréat", icon: GraduationCap },
  { key: "cin", label: "CIN (Carte d'identité)", icon: CreditCard },
];

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const StudentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<StudentDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    if (!id) return;
    try {
      const [studentData, docsData] = await Promise.all([
        apiService.fetchStudentById(id),
        apiService.fetchStudentDocuments(id),
      ]);
      setStudent(studentData);
      setDocuments(docsData);
    } catch (error) {
      toast.error("Échec du chargement des détails de l'étudiant");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !uploadingType) return;

    try {
      toast.loading(`Téléversement en cours de ${uploadingType}...`, { id: "upload" });
      await apiService.uploadDocument(id, uploadingType, file);
      toast.success("Document téléversé avec succès", { id: "upload" });
      const docsData = await apiService.fetchStudentDocuments(id);
      setDocuments(docsData);
      if (student) setStudent({ ...student, documentsUploaded: docsData.length });
    } catch (error) {
      toast.error("Échec du téléversement du document", { id: "upload" });
      console.error(error);
    } finally {
      setUploadingType(null);
      e.target.value = "";
    }
  };

  const triggerUpload = (type: string) => {
    setUploadingType(type);
    fileInputRef.current?.click();
  };

  const handleDeleteDoc = async () => {
    if (!docToDelete || !id) return;
    try {
      await apiService.deleteDocument(docToDelete.id);
      toast.success("Document supprimé");
      const docsData = await apiService.fetchStudentDocuments(id);
      setDocuments(docsData);
      if (student) setStudent({ ...student, documentsUploaded: docsData.length });
    } catch {
      toast.error("Échec de la suppression du document");
    } finally {
      setDocToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-bold tracking-widest text-muted-foreground animate-pulse">SYNCHRONISATION DU DOSSIER...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black">Étudiant Introuvable</h2>
          <p className="text-muted-foreground mt-2">Le dossier que vous tentez de consulter n'existe plus ou a été déplacé.</p>
        </div>
        <Button onClick={() => navigate("/students")} className="rounded-xl px-10 h-12 font-bold">
          Retour au Registre
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={onFileChange}
        accept=".pdf,.jpg,.jpeg,.png"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-background shadow-sm border border-primary/5 hover:bg-primary/5 hover:text-primary transition-all" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-4xl font-black tracking-tight brand-gradient-text uppercase">
            {student.Nom} {student.Prenom}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground font-bold text-sm">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>{student.LibelleLong}</span>
            <span className="opacity-20">|</span>
            <span className="font-mono text-xs">{student.Site}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {statusBadge(student.status)}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-6 md:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <Card className="glass-card border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-5 px-6">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              État Civil
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {[
              ["Nom (FR)", student.Nom],
              ["Prénom (FR)", student.Prenom],
              ["Nom Arabe", student.Nom_Arabe, "font-arabic text-lg text-secondary font-bold text-right"],
              ["Prénom Arabe", student.Prenom_arabe, "font-arabic text-lg text-secondary font-bold text-right"],
              ["Né(e) le", student.DateNaissance, "font-mono"],
              ["CIN / Passport", student.cin, "font-mono font-bold text-primary"],
              ["Nationalité", student.Nationalite],
              ["Contact", student.NTelephone, "font-mono"],
            ].map(([label, value, extraClass]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-primary/5 last:border-0 group">
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{label}</span>
                <span className={`text-sm font-bold ${extraClass || ""}`} dir={extraClass?.includes("font-arabic") ? "rtl" : "ltr"}>
                  {value || <span className="text-muted-foreground/30 font-normal italic">Non spécifié</span>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-secondary/5 border-b border-secondary/10 py-5 px-6">
            <CardTitle className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-secondary" />
              Parcours Académique
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {[
              ["Identifiant Unique", student.MatriculeEtudiant, "font-mono font-bold text-secondary"],
              ["Établissement", student.Site, "text-xs"],
              ["Spécialité", student.LibelleLong, "text-xs leading-relaxed"],
              ["Groupe / Code", student.CodeDiplome, "font-mono text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-lg w-fit"],
              ["Année d'étude", student.anneeEtude],
              ["Niveau Diplôme", student.NiveauScolaire],
            ].map(([label, value, extraClass]) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-primary/5 last:border-0 group">
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-secondary transition-colors mt-1">{label}</span>
                <span className={`text-sm font-bold text-right max-w-[60%] ${extraClass || ""}`}>
                  {value || <span className="text-muted-foreground/30 font-normal italic">Non spécifié</span>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Anomalies Card */}
      {student.mismatch_details && student.mismatch_details.length > 0 && (
        <Card className="bg-destructive/5 border-destructive/20 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          <CardHeader className="py-4 border-b border-destructive/10">
            <CardTitle className="text-sm font-black tracking-widest uppercase text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> 
              Rapport de Discordance OCR
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {student.mismatch_details.map((m: any, i: number) => (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${m.soft ? 'bg-amber-500/10 border-amber-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${m.soft ? 'bg-amber-500/20 text-amber-600' : 'bg-destructive/20 text-destructive'}`}>
                  <FileWarning className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">{m.field} <span className="opacity-50">·</span> {m.document}</p>
                  <div className="flex items-center gap-3 font-bold text-sm">
                    <span className="text-muted-foreground">Attendu: <span className="text-foreground">"{m.excelValue}"</span></span>
                    <ArrowLeft className="h-3 w-3 rotate-180 opacity-30" />
                    <span className={m.soft ? "text-amber-600" : "text-destructive"}>Obtenu: "{m.ocrValue}"</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Arabic Verification Results */}
      {(student as any).verified_arabic_name && (
        <Card className="bg-secondary/5 border-secondary/20 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500 delay-250">
          <CardHeader className="py-4 border-b border-secondary/10">
            <CardTitle className="text-sm font-black tracking-widest uppercase text-secondary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> 
              Validation de l'Identité Arabe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 rounded-3xl bg-white dark:bg-black/40 border border-secondary/20 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <FileText className="h-20 w-20" />
                </div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Extrait Baccalauréat</p>
                <p className="font-arabic text-3xl font-black text-secondary text-right" dir="rtl">{(student as any).verified_arabic_name}</p>
              </div>
              <div className="p-5 rounded-3xl bg-white dark:bg-black/40 border border-primary/20 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <CreditCard className="h-20 w-20" />
                </div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Base de Données Centrale</p>
                <p className="font-arabic text-3xl font-black text-primary text-right" dir="rtl">
                  {student.Nom_Arabe || student.Prenom_arabe
                    ? `${student.Nom_Arabe || ''} ${student.Prenom_arabe || ''}`.trim()
                    : <span className="text-muted-foreground/30 font-normal italic text-lg">غير متوفر</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents Section */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            Documents Archivés
            <span className="text-xs font-bold bg-muted px-2 py-1 rounded-full text-muted-foreground">{documents.length}/3</span>
          </h2>
          <Button variant="ghost" size="sm" className="font-bold text-xs hover:text-primary" onClick={() => triggerUpload("any")}>
            <Upload className="h-3 w-3 mr-2" />
            Ajouter un document
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {DOC_TYPES.map((docType) => {
            const doc = documents.find(d => d.type === docType.key);
            const Icon = docType.icon;
            return (
              <Card 
                key={docType.key}
                className={`glass-card border-none shadow-xl overflow-hidden flex flex-col h-full transition-all duration-500 hover:scale-[1.02] ${doc ? "ring-2 ring-secondary/20 shadow-secondary/5" : "opacity-60 border-dashed border-2 border-muted"}`}
              >
                <CardHeader className={`py-4 border-b flex flex-row items-center justify-between ${doc ? "bg-secondary/5 border-secondary/10" : "bg-muted/50 border-muted"}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${doc ? "text-secondary" : "text-muted-foreground"}`} />
                    <CardTitle className="text-xs font-black tracking-widest uppercase">{docType.label}</CardTitle>
                  </div>
                  {doc && ocrStatusIcon(doc.ocr_status)}
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                  {doc ? (
                    <>
                      <div className="relative group aspect-[4/3] bg-muted/20 overflow-hidden">
                        {doc.mime_type.startsWith("image/") ? (
                          <img
                            src={getDocumentUrl(doc.id)}
                            alt={docType.label}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
                            <FileText className="h-12 w-12 text-muted-foreground opacity-20" />
                            <span className="text-xs font-bold text-muted-foreground">Document PDF</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <Button size="icon" variant="secondary" className="rounded-xl h-10 w-10 shadow-xl" asChild>
                            <a href={getDocumentUrl(doc.id)} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-5 w-5" />
                            </a>
                          </Button>
                          <Button size="icon" variant="destructive" className="rounded-xl h-10 w-10 shadow-xl" onClick={() => setDocToDelete(doc)}>
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 space-y-4 flex-1">
                        <div className="space-y-3">
                          {doc.ocr_extracted_name && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nom Détecté</p>
                              <p className="text-xs font-bold truncate text-foreground/80">{doc.ocr_extracted_name}</p>
                            </div>
                          )}
                          {doc.ocr_extracted_arabic_name && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Identité Arabe</p>
                              <p className="text-base font-arabic font-bold text-secondary text-right" dir="rtl">{doc.ocr_extracted_arabic_name}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="pt-4 border-t border-primary/5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span className="truncate max-w-[120px]">{doc.original_filename}</span>
                          <span className="font-bold">{formatBytes(doc.file_size)}</span>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-muted/10 border-t border-primary/5">
                        <Button variant="ghost" className="w-full h-9 rounded-xl text-xs font-bold text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all" onClick={() => triggerUpload(docType.key)}>
                          Remplacer le document
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4">
                      <div className="h-16 w-16 rounded-full border-2 border-dashed border-muted flex items-center justify-center">
                        <Upload className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Document manquant</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-primary/20 h-10 px-6 font-bold text-primary hover:bg-primary/5"
                          onClick={() => triggerUpload(docType.key)}
                          disabled={uploadingType !== null}
                        >
                          Téléverser
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!docToDelete} onOpenChange={() => setDocToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black">Confirmer la Suppression</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium">
              Êtes-vous sûr de vouloir supprimer définitivement <span className="text-foreground font-bold italic">"{docToDelete?.original_filename}"</span> ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl font-bold h-11 border-primary/10">Conserver</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc} className="rounded-xl bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 h-11 px-8 font-bold">
              Supprimer le fichier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentDetail;
