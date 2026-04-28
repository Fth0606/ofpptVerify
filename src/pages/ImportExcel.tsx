import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, FileSpreadsheet, Check, Info, Star } from "lucide-react";
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
    { name: "NiveauScolaire",    example: "Baccalauréat",  required: false, description: "Niveau scolaire" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importer les données des étudiants</h1>
        <p className="text-muted-foreground">Téléversez un fichier Excel avec les enregistrements des étudiants</p>
      </div>

      {/* Excel Structure Guide */}
      <Card className="border-blue-200 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base text-blue-800 dark:text-blue-200">Structure requise du fichier Excel</CardTitle>
              <CardDescription className="text-blue-600/80 dark:text-blue-400/80">
                Votre fichier Excel doit contenir les colonnes suivantes (la première ligne doit être l'en-tête)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-200 dark:border-blue-800 bg-blue-100/60 dark:bg-blue-900/30">
                  <th className="px-4 py-2 text-left font-semibold text-blue-800 dark:text-blue-200">Nom de colonne</th>
                  <th className="px-4 py-2 text-left font-semibold text-blue-800 dark:text-blue-200">Exemple</th>
                  <th className="px-4 py-2 text-left font-semibold text-blue-800 dark:text-blue-200">Description</th>
                  <th className="px-4 py-2 text-left font-semibold text-blue-800 dark:text-blue-200">Statut</th>
                </tr>
              </thead>
              <tbody>
                {excelColumns.map((col, i) => (
                  <tr
                    key={col.name}
                    className={`border-b border-blue-100 dark:border-blue-900/50 ${
                      i % 2 === 0
                        ? "bg-white/60 dark:bg-blue-950/10"
                        : "bg-blue-50/40 dark:bg-blue-950/20"
                    }`}
                  >
                    <td className="px-4 py-2">
                      <code className="rounded bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:text-blue-300">
                        {col.name}
                      </code>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">{col.example}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{col.description}</td>
                    <td className="px-4 py-2">
                      {col.required ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                          <Star className="h-2.5 w-2.5" />
                          Obligatoire
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Optionnel
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 p-4 text-xs text-blue-600/80 dark:text-blue-400/80">
            <Star className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
            <span>Les colonnes <strong>obligatoires</strong> doivent être présentes pour que l'import fonctionne correctement. Les colonnes optionnelles peuvent être omises.</span>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-12 transition-colors hover:border-primary/50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-12 w-12 text-primary/60" />
            <div className="text-center">
              <p className="font-medium">Glissez et déposez votre fichier Excel ici</p>
              <p className="text-sm text-muted-foreground">Prend en charge les fichiers .xlsx et .csv</p>
            </div>
            <label>
              <input type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileSelect} />
              <Button variant="outline" asChild><span>Parcourir les fichiers</span></Button>
            </label>
          </div>
          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
              <FileUp className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {file && previewData.length > 0 && !imported && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu</CardTitle>
            <CardDescription>Vérifiez les données avant de les importer</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(previewData[0]).map(key => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 5).map((r, i) => (
                    <TableRow key={i}>
                      {Object.values(r).map((val: any, j) => (
                        <TableCell key={j}>{val}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewData.length > 5 && (
              <p className="p-4 text-xs text-center text-muted-foreground">
                Affichage des 5 premiers sur {previewData.length} enregistrements
              </p>
            )}
          </CardContent>
          <div className="flex justify-end p-4">
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importation..." : `Importer ${previewData.length} Étudiants`}
            </Button>
          </div>
        </Card>
      )}

      {imported && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-semibold">Importation réussie !</p>
            <p className="text-sm text-muted-foreground">{previewData.length} étudiants ont été importés.</p>
            <Button variant="outline" onClick={() => { setFile(null); setPreviewData([]); setImported(false); }}>
              Importer un autre fichier
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportExcel;
