import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, FileSpreadsheet, Check } from "lucide-react";
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
        // Find values by checking keys case-insensitively and ignoring accents if possible
        const getValue = (possibleKeys: string[]) => {
          const keys = Object.keys(row);
          // Try exact matches first
          const exactMatch = keys.find(k =>
            possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase().trim())
          );
          if (exactMatch) return row[exactMatch];

          // Try partial matches (e.g. "Prenom (Fr)" matching "prenom")
          const partialMatch = keys.find(k =>
            possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()) && pk.length > 3)
          );
          return partialMatch ? row[partialMatch] : null;
        };

        const cin = (getValue(["cin", "id", "cin_number"]) || "").toString().trim().toUpperCase();
        const studentId = (getValue(["id", "student_id", "cne", "massar"]) || cin || Math.random().toString(36).substr(2, 9)).toString().trim();

        // Robust name handling
        let prenom = (getValue(["prenom", "prénom", "prã©nom", "prã©nom", "first name", "firstname"]) || "").toString().trim();
        let nom = (getValue(["nom", "last name", "lastname", "surname"]) || "").toString().trim();
        const fullNameFromRow = (getValue(["fullName", "full name", "name", "nom complet"]) || "").toString().trim();

        // Only split if BOTH are missing but we have a fullName
        if (!nom && !prenom && fullNameFromRow && fullNameFromRow.includes(" ")) {
          const parts = fullNameFromRow.split(" ");
          nom = parts[0];
          prenom = parts.slice(1).join(" ");
        }

        // Prioritize Nom + Prénom concatenation as requested
        const fullName = (nom && prenom)
          ? `${nom} ${prenom}`.trim()
          : (fullNameFromRow || nom || prenom || "Unknown Student");

        return {
          id: studentId,
          firstName: prenom,
          lastName: nom,
          fullName: fullName,
          dateOfBirth: getValue(["dateOfBirth", "dob", "date de naissance"]),
          birthplace: getValue(["birthplace", "lieu de naissance"]),
          cin: cin,
          filiere: getValue(["filiere", "filière", "branch"]),
          classe: getValue(["classe", "class"]),
          group: getValue(["group", "groupe"]),
          parentName: getValue(["parentName", "parent name", "nom du parent"]),
          bacYear: getValue(["bacYear", "bac year", "année du bac"]),
          bacScore: getValue(["bacScore", "bac score", "moyenne du bac"]),
          bacMention: getValue(["bacMention", "bac mention", "mention du bac"]),
        };
      });

      await apiService.bulkStoreStudents(students);
      setImported(true);
      toast.success(`${students.length} students imported successfully`);
    } catch (error: any) {
      console.error("Import error:", error);
      const message = error.message || "Failed to import students to the database";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Student Data</h1>
        <p className="text-muted-foreground">Upload an Excel file with student records</p>
      </div>

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
              <p className="font-medium">Drag & drop your Excel file here</p>
              <p className="text-sm text-muted-foreground">Supports .xlsx and .csv files</p>
            </div>
            <label>
              <input type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileSelect} />
              <Button variant="outline" asChild><span>Browse Files</span></Button>
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
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>Review the data before importing</CardDescription>
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
                Showing first 5 of {previewData.length} records
              </p>
            )}
          </CardContent>
          <div className="flex justify-end p-4">
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${previewData.length} Students`}
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
            <p className="font-semibold">Import Successful!</p>
            <p className="text-sm text-muted-foreground">{previewData.length} students have been imported.</p>
            <Button variant="outline" onClick={() => { setFile(null); setPreviewData([]); setImported(false); }}>
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportExcel;
