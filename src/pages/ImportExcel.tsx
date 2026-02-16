import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, FileSpreadsheet, Check } from "lucide-react";

const samplePreview = [
  { name: "Ahmed Ben Ali", dob: "1999-03-15", cin: "BK123456", filiere: "Développement Digital", classe: "DD201", group: "A" },
  { name: "Fatima Zahra El Idrissi", dob: "2000-07-22", cin: "BH789012", filiere: "Infrastructure Digitale", classe: "ID101", group: "B" },
  { name: "Youssef Amrani", dob: "2001-01-10", cin: "CD345678", filiere: "Développement Digital", classe: "DD201", group: "A" },
];

const ImportExcel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imported, setImported] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleImport = () => {
    setImported(true);
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
      {file && !imported && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>Review the data before importing</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>CIN</TableHead>
                  <TableHead>Filière</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Group</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samplePreview.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.dob}</TableCell>
                    <TableCell>{r.cin}</TableCell>
                    <TableCell>{r.filiere}</TableCell>
                    <TableCell>{r.classe}</TableCell>
                    <TableCell>{r.group}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex justify-end p-4">
            <Button onClick={handleImport}>Import {samplePreview.length} Students</Button>
          </div>
        </Card>
      )}

      {imported && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
              <Check className="h-6 w-6 text-success" />
            </div>
            <p className="font-semibold">Import Successful!</p>
            <p className="text-sm text-muted-foreground">{samplePreview.length} students have been imported.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportExcel;
