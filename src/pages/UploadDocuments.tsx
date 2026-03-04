import { useState, useRef } from "react";
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
  file_details: { file: string; extracted_name: string | null; raw_data: any }[];
}

const UploadDocuments = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OCRResult[]>([]);
  const [done, setDone] = useState(false);
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
        setProgress(50);
      }

      const formData = new FormData();
      formData.append("file", zipBlob, isZip ? files[0].name : "documents.zip");

      const ocrUrl = apiService.getOcrUrl();
      const response = await fetch(`${ocrUrl}/validate`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process documents");
      }

      const rawResponse = await response.json();

      if (rawResponse.error) {
        throw new Error(rawResponse.error);
      }

      if (!Array.isArray(rawResponse)) {
        throw new Error("Invalid response format from OCR service");
      }

      const ocrResults: OCRResult[] = rawResponse;


      // Get all students from database to verify names
      const allStudents = await apiService.fetchStudents();

      const enhancedResults = ocrResults.map(res => {
        const student = allStudents.find(s => s.cin.toLowerCase() === res.cin.toLowerCase());
        let finalCorrect = res.is_correct;
        let dbMismatch = false;


        if (student && res.verified_name) {
          // Clean up names for comparison
          const ocrWords = res.verified_name.toLowerCase().split(/\s+/).filter(w => w.length > 1);
          const dbWords = student.fullName.toLowerCase().split(/\s+/).filter(w => w.length > 1);

          // All words in DB name should ideally be in OCR name
          const missingWords = dbWords.filter(dbW => !ocrWords.some(ocrW => ocrW.includes(dbW) || dbW.includes(ocrW)));

          // Strict check: if missing any word or if word counts are too different
          if (missingWords.length > 0 || ocrWords.length < 2) {
            finalCorrect = false;
            dbMismatch = true;
          }
        } else if (!student) {
          finalCorrect = false;
        }

        return {
          ...res,
          is_correct: finalCorrect,
          db_mismatch: dbMismatch,
          student_name: student?.fullName
        };
      });

      setResults(enhancedResults);
      setProgress(100);
      setDone(true);

      // Bulk update student statuses in Laravel based on OCR results
      const statusUpdates = enhancedResults.map(res => ({
        cin: res.cin,
        status: res.is_correct ? "verified" : "mismatch",
        documentsUploaded: res.file_details.length
      }));

      if (statusUpdates.length > 0) {
        await apiService.bulkUpdateStatus(statusUpdates);
      }

      toast.success("Documents processed successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error.message === "Failed to fetch") {
        toast.error("Could not connect to OCR service. Please ensure the Python backend is running on port 5001.");
      } else {
        toast.error(`Error: ${error.message || "An error occurred during document processing"}`);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Student Documents</h1>
        <p className="text-muted-foreground">
          Upload folder or multiple images containing: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Filière / Classe / Student Documents (images)</code>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected Folder Structure</CardTitle>
          <CardDescription>Upload a folder where each student has their own sub-folder named with their CIN (e.g., BB123456)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-4 font-mono text-sm space-y-1">
            <p className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 Root Folder/</p>
            <p className="ml-6 flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 BB123456/</p>
            <p className="ml-12 text-muted-foreground">🖼️ birth.jpg</p>
            <p className="ml-12 text-muted-foreground">🖼️ bac.jpg</p>
            <p className="ml-12 text-muted-foreground">🖼️ cin.jpg</p>
            <p className="ml-6 flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" /> 📁 CC789012/</p>
            <p className="ml-12 text-muted-foreground">...</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-12">
            <Upload className="h-12 w-12 text-primary/60" />
            <p className="font-medium">Select folder or images to process</p>
            <p className="text-sm text-muted-foreground">AI will extract and match names automatically</p>
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
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={handleFolderSelect} disabled={uploading}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Folder
              </Button>
              <Button variant="outline" onClick={handleZipSelect} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                Select ZIP File
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(uploading || progress > 0) && !done && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {progress < 100 ? "Uploading and processing documents with OCR..." : "Processing complete"}
            </p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>OCR Processing Results</span>
              <Badge variant="secondary">{results.length} students processed</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((res, idx) => (
              <div key={idx} className={`rounded-lg border p-4 ${res.is_correct ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {res.is_correct ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-red-600" />}
                    <span className="font-bold">CIN: {res.cin}</span>
                  </div>
                  <Badge variant={res.is_correct ? "success" : "destructive"}>
                    {res.is_correct ? "Matched" : "Mismatch"}
                  </Badge>
                </div>

                <div className="text-sm font-medium mb-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {res.verified_name && (
                    <div className="p-2 rounded bg-white/50 border">
                      <p className="text-xs text-muted-foreground">Extracted from Docs:</p>
                      <p className="text-green-800">{res.verified_name}</p>
                    </div>
                  )}
                  {res.student_name && (
                    <div className="p-2 rounded bg-white/50 border">
                      <p className="text-xs text-muted-foreground">Database Record:</p>
                      <p className="text-blue-800">{res.student_name}</p>
                    </div>
                  )}
                </div>

                {res.db_mismatch && (
                  <p className="text-xs text-red-600 font-bold mb-2 flex items-center gap-1">
                    <FileWarning className="h-3 w-3" /> Data mismatch: Document name does not match database record
                  </p>
                )}

                {!res.student_name && (
                  <p className="text-xs text-amber-600 font-bold mb-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Warning: No student found in database with CIN {res.cin}
                  </p>
                )}

                {res.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {res.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700 flex items-center gap-1">
                        <FileWarning className="h-3 w-3" /> {err.file}: {err.error}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {res.file_details.map((detail, i) => (
                    <div key={i} className="text-xs p-2 rounded bg-white/50 border border-gray-100">
                      <p className="font-semibold truncate" title={detail.file}>{detail.file}</p>
                      <p className="text-gray-600">Extracted: {detail.extracted_name || "N/A"}</p>
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
