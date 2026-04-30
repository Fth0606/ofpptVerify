import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, FileSpreadsheet, Check, Info, Star, XCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { apiService } from "@/lib/api-service";
import { toast } from "sonner";

const ImportExcel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [imported, setImported] = useState(false);
  const [importing, setImporting] = useState(false);

  const processExcel = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const bstr = e.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: "yyyy-mm-dd" });
      setPreviewData(data);
    };
    reader.readAsBinaryString(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      processExcel(f);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      setFile(f);
      processExcel(f);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      // Map Excel data to student structure
      const students = previewData.map(row => {
        // Find values by checking keys case-insensitively
        const getValue = (possibleKeys: string[]) => {
          const keys = Object.keys(row);
          // Try exact matches first
          const exactMatch = keys.find(k =>
            possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase().trim())
          );
          if (exactMatch) return row[exactMatch];

          // Try partial matches
          const partialMatch = keys.find(k =>
            possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()) && pk.length > 3)
          );
          return partialMatch ? row[partialMatch] : null;
        };

        return {
          MatriculeEtudiant: getValue(["MatriculeEtudiant", "matriculeetudiant"]),
          Nom: getValue(["Nom", "nom"]),
          Prenom: getValue(["Prenom", "prenom"]),
          LibelleLong: getValue(["LibelleLong", "libellelong"]),
          CodeDiplome: getValue(["CodeDiplome", "codediplome"]),
          DateNaissance: getValue(["DateNaissance", "datenaissance"]),
          Site: getValue(["Site", "site"]),
          CIN: getValue(["CIN", "cin"]),
          NTelephone: getValue(["NTelephone", "ntelephone"]),
          Nationalite: getValue(["Nationalite", "nationalite"]),
          anneeEtude: getValue(["anneeEtude", "anneeetude"]),
          Nom_Arabe: getValue(["Nom_Arabe", "nom_arabe"]),
          Prenom_arabe: getValue(["Prenom_arabe", "prenom_arabe"]),
          NiveauScolaire: getValue(["NiveauScolaire", "niveauscolaire"]),
        };
      });

      await apiService.bulkStoreStudents(students);
      setImported(true);
      toast.success(`${students.length} étudiants importés avec succès`);
    } catch (error: any) {
      console.error("Erreur d'importation :", error);
      const message = error.message || "Échec de l'importation des étudiants dans la base de données";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const excelColumns = [
    { name: "MatriculeEtudiant", example: "2005060600354", required: true,  description: "Matricule de l'étudiant (CNE/Massar)" },
    { name: "Nom",               example: "ALAOUI",        required: true,  description: "Nom de famille (Français)" },
    { name: "Prenom",            example: "FATIHA",        required: true,  description: "Prénom (Français)" },
    { name: "LibelleLong",       example: "DIA_DEVOWFS...",required: true,  description: "Filière détaillée" },
    { name: "CodeDiplome",       example: "DEVOWFS201",    required: true,  description: "Code du groupe/diplôme" },
    { name: "DateNaissance",     example: "06/06/2005",    required: true,  description: "Date de naissance" },
    { name: "Site",              example: "INSTITUT...",   required: true,  description: "Établissement" },
    { name: "CIN",               example: "X436763",       required: true,  description: "Numéro CIN de l'étudiant" },
    { name: "NTelephone",        example: "0719982950",    required: false, description: "Numéro de téléphone" },
    { name: "Nationalite",       example: "Marocain",      required: false, description: "Nationalité" },
    { name: "anneeEtude",        example: "2ème année",    required: false, description: "Année d'étude" },
    { name: "Nom_Arabe",         example: "علوي",           required: false, description: "Nom de famille (Arabe)" },
    { name: "Prenom_arabe",      example: "فتيحة",          required: false, description: "Prénom (Arabe)" },
    { name: "NiveauScolaire",    example: "Baccalauréat",  required: false, description: "Niveau scolaire" },
  ];
  return (
    <div className="space-y-10 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight brand-gradient-text">Importation Massive</h1>
        <p className="text-muted-foreground mt-1">Alimentez la base de données avec les enregistrements officiels du site ISTA/OFPPT</p>
      </div>

      {/* Excel Structure Guide */}
      <Card className="glass-card border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Directives de Formatage</CardTitle>
              <CardDescription className="font-medium">
                Veuillez respecter scrupuleusement la structure des colonnes pour garantir l'intégrité de l'import.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-primary/5">
                  <th className="px-6 py-4 text-left font-bold text-[11px] uppercase tracking-widest">Colonne</th>
                  <th className="px-6 py-4 text-left font-bold text-[11px] uppercase tracking-widest">Exemple</th>
                  <th className="px-6 py-4 text-left font-bold text-[11px] uppercase tracking-widest">Usage</th>
                  <th className="px-6 py-4 text-left font-bold text-[11px] uppercase tracking-widest">Exigence</th>
                </tr>
              </thead>
              <tbody>
                {excelColumns.map((col, i) => (
                  <tr
                    key={col.name}
                    className="border-b border-primary/5 group hover:bg-primary/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <code className="rounded-lg bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">
                        {col.name}
                      </code>
                    </td>
                    <td className="px-6 py-4 font-bold text-muted-foreground">{col.example}</td>
                    <td className="px-6 py-4 text-xs font-medium">{col.description}</td>
                    <td className="px-6 py-4">
                      {col.required ? (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 rounded-full font-bold text-[10px]">
                          CRITIQUE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px] font-bold border-dashed border-muted-foreground/30 text-muted-foreground">
                          FACULTATIF
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="glass-card border-none shadow-xl p-8">
        <CardContent className="p-0">
          <div
            className="group flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-primary/20 bg-primary/5 p-16 transition-all hover:border-primary/50 hover:bg-primary/10 cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="h-20 w-20 rounded-2xl bg-white dark:bg-black/40 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
              <FileSpreadsheet className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold">Déposer le registre Excel</p>
              <p className="text-sm text-muted-foreground max-w-[300px]">Format pris en charge : <span className="font-bold">.xlsx, .csv</span>. Glissez-déposez ou parcourez vos fichiers.</p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileSelect} />
              <Button className="rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 px-10 font-bold h-12" asChild>
                <span>Sélectionner un fichier</span>
              </Button>
            </label>
          </div>
          {file && (
            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="h-12 w-12 rounded-xl bg-white dark:bg-black/40 flex items-center justify-center shadow-sm">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold truncate">{file.name}</p>
                <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => { setFile(null); setPreviewData([]); }}>
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {file && previewData.length > 0 && !imported && (
        <Card className="glass-card border-none shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8">
          <CardHeader className="bg-primary/5 border-b border-primary/10 flex flex-row items-center justify-between py-6">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Aperçu de l'Extraction</CardTitle>
              <CardDescription className="font-medium">Validation préliminaire des données</CardDescription>
            </div>
            <Button onClick={handleImport} disabled={importing} className="rounded-xl bg-secondary hover:bg-secondary/90 text-white shadow-lg shadow-secondary/20 font-bold h-11 px-8">
              {importing ? "Importation..." : `Valider et Importer ${previewData.length} Dossiers`}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b border-primary/5">
                    {Object.keys(previewData[0]).map(key => (
                      <TableHead key={key} className="font-bold text-[10px] uppercase tracking-widest py-4">{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 5).map((r, i) => (
                    <TableRow key={i} className="hover:bg-primary/5 transition-colors border-b border-primary/5">
                      {Object.values(r).map((val: any, j) => (
                        <TableCell key={j} className="text-xs font-medium py-4">{val}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewData.length > 5 && (
              <div className="p-6 text-center border-t border-primary/5 bg-muted/10">
                <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
                  Affichage des 5 premiers sur {previewData.length} enregistrements détectés
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {imported && (
        <Card className="glass-card border-none shadow-2xl overflow-hidden">
          <CardContent className="flex flex-col items-center gap-6 py-20 bg-gradient-to-b from-secondary/5 to-transparent">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-secondary/10 shadow-[0_0_20px_rgba(46,125,50,0.15)] animate-bounce">
              <Check className="h-10 w-10 text-secondary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black brand-gradient-text">Importation Finalisée !</h2>
              <p className="text-muted-foreground font-medium">{previewData.length} dossiers ont été synchronisés avec la base de données centrale.</p>
            </div>
            <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold h-11 px-8" onClick={() => { setFile(null); setPreviewData([]); setImported(false); }}>
              Importer un nouveau registre
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportExcel;
