import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FolderOpen, CheckCircle2, AlertCircle, FileWarning } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { apiService } from "@/lib/api-service";

interface OCRResult {
  cin: string;
  folder: string;
  is_correct: boolean;
  verified_name: string | null;
  student_name?: string;
  db_mismatch?: boolean;
  errors: { file: string; error: string }[];
  file_details: { 
    file: string; 
    extracted_name: string | null; 
    extracted_dob?: string | null;
    extracted_cin?: string | null;
    raw_data: any 
  }[];
  mismatch_details?: Array<{
        document: string;
        field: string;
        excelValue: string;
        ocrValue: string;
    }>;
}

const UploadDocuments = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = () => {
    fileInputRef.current?.click();
  };

  const handleZipSelect = () => {
    zipInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, isZip = false) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setProgress(10);
    setResults([]);
    setDone(false);

    try {
      let zipBlob: Blob;

      if (isZip) {
        zipBlob = files[0];
        setProgress(50);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const path = file.webkitRelativePath || file.name;
          zip.file(path, file);
        }
        setProgress(30);
        zipBlob = await zip.generateAsync({ type: "blob" });
      }

      setProgress(70);

      const response = await apiService.bulkUploadDocuments(zipBlob as File);
      
      const allStudents = await apiService.fetchStudents();
      
      setResults(Object.entries(response.counts || {}).map(([cin, count]) => {
        const student = allStudents.find(s => s.cin.toUpperCase() === cin.toUpperCase());
        return {
          cin,
          folder: cin,
          is_correct: !!student,
          verified_name: `${count} fichier(s) stocké(s)`,
          student_name: student?.fullName,
          errors: [],
          file_details: []
        };
      }));

      setProgress(100);
      setDone(true);
      toast.success("Documents téléversés et stockés avec succès");
    } catch (error: any) {
      console.error("Erreur de téléversement :", error);
      toast.error(`Erreur : ${error.message || "Une erreur est survenue lors du téléversement des documents"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight brand-gradient-text">Téléversement de Documents</h1>
          <p className="text-muted-foreground mt-1">
            Archivage et indexation intelligente des dossiers étudiants par reconnaissance CIN
          </p>
        </div>
      </div>

      <Card className="glass-card border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Standard d'Organisation</CardTitle>
              <CardDescription className="font-medium">Structure arborescente requise pour l'auto-indexation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="rounded-2xl bg-muted/30 p-6 font-mono text-sm space-y-2 border border-primary/5 shadow-inner">
            <div className="flex items-center gap-2 text-primary font-bold"><FolderOpen className="h-4 w-4" /> 📁 Racine_Archives/</div>
            <div className="ml-8 flex items-center gap-2 text-foreground/80 font-bold border-l-2 border-primary/20 pl-4 py-1"><FolderOpen className="h-4 w-4 text-primary/60" /> 📁 BB123456/ <span className="text-[10px] text-muted-foreground font-normal">(CIN Étudiant)</span></div>
            <div className="ml-20 text-muted-foreground/70 flex items-center gap-2 border-l-2 border-primary/10 pl-4">📄 acte_naissance.jpg</div>
            <div className="ml-20 text-muted-foreground/70 flex items-center gap-2 border-l-2 border-primary/10 pl-4">📄 diplome_bac.jpg</div>
            <div className="ml-20 text-muted-foreground/70 flex items-center gap-2 border-l-2 border-primary/10 pl-4">📄 copie_cin.jpg</div>
            <div className="ml-8 flex items-center gap-2 text-foreground/80 font-bold border-l-2 border-primary/20 pl-4 py-1 mt-2"><FolderOpen className="h-4 w-4 text-primary/60" /> 📁 CC789012/</div>
            <div className="ml-20 text-muted-foreground/40 italic">... Dossiers suivants</div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-none shadow-2xl p-10">
        <CardContent className="p-0">
          <div 
            className="group flex flex-col items-center justify-center gap-8 rounded-[2.5rem] border-2 border-dashed border-primary/20 bg-primary/5 p-20 transition-all hover:border-primary/50 hover:bg-primary/10 cursor-pointer text-center"
            onClick={handleFolderSelect}
          >
            <div className="h-24 w-24 rounded-3xl bg-white dark:bg-black/40 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500 relative">
              <Upload className="h-12 w-12 text-primary" />
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-secondary rounded-full flex items-center justify-center shadow-lg animate-pulse">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-2xl font-black">Prêt pour l'archivage ?</p>
              <p className="text-muted-foreground max-w-[400px] font-medium leading-relaxed">
                Glissez votre dossier d'établissement ici ou utilisez les options ci-dessous.
                <br /><span className="text-xs tracking-widest uppercase font-bold text-primary/60">Optimisé pour la reconnaissance OCR OFPPT</span>
              </p>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              onChange={(e) => handleFileChange(e, false)}
              {...({ webkitdirectory: "", directory: "" } as any)}
            />
            <input
              type="file"
              ref={zipInputRef}
              className="hidden"
              accept=".zip"
              onChange={(e) => handleFileChange(e, true)}
            />
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="outline" onClick={(e) => { e.stopPropagation(); handleFolderSelect(); }} disabled={uploading} className="rounded-2xl border-primary/20 h-14 px-8 font-bold hover:bg-primary/5">
                <FolderOpen className="mr-3 h-5 w-5 text-primary" />
                Dossier Complet
              </Button>
              <Button onClick={(e) => { e.stopPropagation(); handleZipSelect(); }} disabled={uploading} className="rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 h-14 px-10 font-bold">
                <Upload className="mr-3 h-5 w-5" />
                Archive ZIP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(uploading || progress > 0) && !done && (
        <Card className="glass-card border-none shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center justify-between font-bold">
              <span className="text-sm tracking-widest uppercase text-primary">Traitement en cours</span>
              <span className="text-xl brand-gradient-text">{progress}%</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-medium italic flex items-center gap-2">
              <div className="h-2 w-2 bg-secondary rounded-full animate-ping" />
              {progress < 100 ? "Analyse OCR des documents et synchronisation cloud..." : "Finalisation de l'archivage..."}
            </p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card className="glass-card border-none shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-10">
          <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-col md:flex-row items-center justify-between py-8">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black">Rapport d'Archivage</CardTitle>
              <CardDescription className="font-bold">{results.length} dossiers identifiés avec succès</CardDescription>
            </div>
            <Button onClick={() => navigate("/students")} className="rounded-xl bg-secondary hover:bg-secondary/90 text-white shadow-lg shadow-secondary/20 font-bold h-11 px-8">
              Lancer la Vérification
            </Button>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {results.map((res, idx) => (
              <div key={idx} className={`rounded-[1.5rem] border p-6 transition-all hover:shadow-lg ${res.is_correct ? "bg-secondary/5 border-secondary/20" : "bg-destructive/5 border-destructive/20"}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm ${res.is_correct ? "bg-secondary/10" : "bg-destructive/10"}`}>
                      {res.is_correct ? <CheckCircle2 className="h-6 w-6 text-secondary" /> : <AlertCircle className="h-6 w-6 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-xs font-black tracking-widest text-muted-foreground uppercase">Dossier CIN</p>
                      <h3 className="text-lg font-black font-mono">{res.cin}</h3>
                    </div>
                  </div>
                  <Badge className={`rounded-full px-4 py-1.5 font-black text-[10px] tracking-widest ${res.is_correct ? "bg-secondary/15 text-secondary border-secondary/20" : "bg-destructive/15 text-destructive border-destructive/20"}`}>
                    {res.is_correct ? "CORRESPONDANCE OK" : "HORS REGISTRE"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {res.verified_name && (
                    <div className="p-4 rounded-2xl bg-background/50 border border-primary/5 shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Indexation OCR</p>
                      <p className="font-bold text-primary">{res.verified_name}</p>
                    </div>
                  )}
                  {res.student_name && (
                    <div className="p-4 rounded-2xl bg-background/50 border border-primary/5 shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Identité Registre</p>
                      <p className="font-bold text-secondary">{res.student_name}</p>
                    </div>
                  )}
                </div>

                {res.db_mismatch && (
                  <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs font-bold text-destructive">
                    <FileWarning className="h-4 w-4" /> Alerte : Le nom extrait du document diffère du registre officiel
                  </div>
                )}

                {res.mismatch_details && (res.mismatch_details as any[]).length > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                    <p className="text-xs font-black text-destructive uppercase tracking-widest mb-3">Anomalies Détectées</p>
                    <div className="space-y-2">
                      {(res.mismatch_details as any[]).map((m: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] font-medium text-destructive/80">
                          <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                          <p>
                            <span className="font-bold underline">{m.document}</span>: {m.field} incorrect 
                            <span className="mx-2 opacity-50">|</span> 
                            Registre: <span className="font-bold">"{m.excelValue}"</span> 
                            <span className="mx-2">→</span> 
                            OCR: <span className="font-bold">"{m.ocrValue}"</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {res.file_details.map((detail, i) => (
                    <div key={i} className="text-[10px] p-3 rounded-xl bg-background/40 border border-primary/5 hover:border-primary/20 transition-colors">
                      <p className="font-black truncate mb-1" title={detail.file}>{detail.file}</p>
                      <p className="text-muted-foreground font-medium">Auto-tag: {detail.extracted_name || "Non identifié"}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UploadDocuments;
