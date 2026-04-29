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
    case "verified": return <Badge className="bg-green-100 text-green-700 border-0">✅ Vérifié</Badge>;
    case "mismatch": return <Badge className="bg-yellow-100 text-yellow-700 border-0">⚠️ Non Concordant</Badge>;
    case "pending": return <Badge variant="secondary">⏳ En Attente</Badge>;
    case "missing": return <Badge variant="destructive">❌ Manquant</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

const ocrStatusIcon = (status: string) => {
  switch (status) {
    case "processed": return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "failed": return <AlertCircle className="h-3 w-3 text-red-500" />;
    default: return <Clock className="h-3 w-3 text-yellow-500" />;
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
      // Re-fetch documents to reflect the new upload
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
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Chargement des détails de l'étudiant...</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Étudiant introuvable</p>
        <Button variant="ghost" onClick={() => navigate("/students")} className="mt-4">Retour aux Étudiants</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={onFileChange}
        accept=".pdf,.jpg,.jpeg,.png"
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {student.Nom} {student.Prenom}
          </h1>
          <p className="text-muted-foreground">{student.LibelleLong} · {student.Site}</p>
        </div>
        {statusBadge(student.status)}
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Informations Personnelles</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Nom (Français)", student.Nom || "-"],
              ["Prénom (Français)", student.Prenom || "-"],
              ["Date de Naissance", student.DateNaissance],
              ["CIN", student.cin],
              ["Nationalité", student.Nationalite],
              ["Numéro de Téléphone", student.NTelephone],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value || "-"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Informations Académiques</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Matricule (CNE)", student.MatriculeEtudiant],
              ["Site", student.Site],
              ["Libellé Long (Filière)", student.LibelleLong],
              ["Code Diplôme", student.CodeDiplome],
              ["Année d'étude", student.anneeEtude],
              ["Niveau Scolaire", student.NiveauScolaire],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium max-w-[60%] text-right">{value || "-"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Mismatch Details */}
      {student.mismatch_details && student.mismatch_details.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader><CardTitle className="text-base text-red-700">⚠️ Détails des Non Concordances</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {student.mismatch_details.map((m: any, i: number) => (
              <div key={i} className="text-sm p-2 rounded bg-red-100/50 border border-red-200">
                <span className="font-semibold">{m.field}</span> ({m.document}):&nbsp;
                Attendu "<span className="text-blue-700">{m.excelValue}</span>",&nbsp;
                Obtenu "<span className="text-red-700">{m.ocrValue}</span>"
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Documents <span className="text-muted-foreground font-normal text-sm ml-1">({documents.length}/3 téléversés)</span></span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {DOC_TYPES.map((docType) => {
              const doc = documents.find(d => d.type === docType.key);
              const Icon = docType.icon;
              return (
                <div
                  key={docType.key}
                  className={`flex flex-col gap-3 rounded-xl border-2 p-5 transition-all ${doc
                      ? "border-green-300 bg-green-50/40 dark:bg-green-950/20"
                      : "border-dashed border-border"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-6 w-6 ${doc ? "text-green-600" : "text-muted-foreground"}`} />
                    <p className="text-sm font-semibold">{docType.label}</p>
                  </div>

                  {doc ? (
                    <>
                      {/* Thumbnail preview */}
                      {doc.mime_type.startsWith("image/") && (
                        <div className="w-full overflow-hidden rounded-lg border border-green-200 bg-white">
                          <img
                            src={getDocumentUrl(doc.id)}
                            alt={docType.label}
                            className="w-full h-32 object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                      )}

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {ocrStatusIcon(doc.ocr_status)}
                          <span className="capitalize">OCR: {doc.ocr_status}</span>
                        </div>
                        {doc.ocr_extracted_name && (
                          <div className="p-1.5 rounded bg-white border text-[11px]">
                            <span className="text-gray-400">Nom : </span>
                            <span className="font-medium text-gray-700">{doc.ocr_extracted_name}</span>
                          </div>
                        )}
                        {doc.ocr_extracted_arabic && (
                          <div className="p-1.5 rounded bg-white border text-[11px] flex justify-between items-center">
                            <span className="text-gray-400">Nom Arabe : </span>
                            <span className="font-bold text-green-700 text-sm" dir="rtl">{doc.ocr_extracted_arabic}</span>
                          </div>
                        )}
                      {doc.ocr_extracted_dob && (
                          <div className="p-1.5 rounded bg-white border text-[11px]">
                            <span className="text-gray-400">Date Nais. : </span>
                            <span className="font-medium text-gray-700">{doc.ocr_extracted_dob}</span>
                          </div>
                        )}
                        <p className="text-[10px]">{doc.original_filename} · {formatBytes(doc.file_size)}</p>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={getDocumentUrl(doc.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs border-green-300 text-green-700 hover:bg-green-50">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Voir
                          </Button>
                        </a>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 border-red-200 text-red-500 hover:bg-red-50"
                          onClick={() => setDocToDelete(doc)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => triggerUpload(docType.key)}
                        disabled={uploadingType !== null}
                      >
                        Remplacer
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Aucun document téléversé</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerUpload(docType.key)}
                        disabled={uploadingType !== null}
                      >
                        <Upload className="mr-2 h-3 w-3" />
                        Téléverser
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Document Dialog */}
      <AlertDialog open={!!docToDelete} onOpenChange={() => setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le Document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cela supprimera définitivement <strong>{docToDelete?.original_filename}</strong> de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentDetail;
