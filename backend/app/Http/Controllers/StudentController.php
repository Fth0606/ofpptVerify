<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use ZipArchive;

class StudentController extends Controller
{
    // ─────────────────────────────────────────────
    // STUDENT CRUD
    // ─────────────────────────────────────────────

    public function index()
    {
        return Student::withCount('documents')->get();
    }

    public function show($id)
    {
        $student = Student::findByAnyId($id);
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        // Include document metadata (no file_data blob)
        $student->documents_list = $student->documents()
            ->select('id', 'student_id', 'type', 'original_filename', 'mime_type', 'file_size', 'ocr_extracted_name', 'ocr_extracted_arabic_name', 'ocr_extracted_dob', 'ocr_extracted_cin', 'ocr_extracted_cne', 'ocr_status', 'created_at')
            ->get();
        return $student;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'MatriculeEtudiant' => 'required|unique:students',
            'Nom'               => 'required',
            'Prenom'            => 'required',
            'LibelleLong'       => 'nullable',
            'CodeDiplome'       => 'nullable',
            'DateNaissance'     => 'nullable',
            'Site'              => 'nullable',
            'cin'               => 'nullable',
            'NTelephone'        => 'nullable',
            'Nationalite'       => 'nullable',
            'anneeEtude'        => 'nullable',
            'Nom_Arabe'         => 'nullable',
            'Prenom_arabe'      => 'nullable',
            'NiveauScolaire'    => 'nullable',
        ]);
        return Student::create($data);
    }

    public function bulkStore(Request $request)
    {
        $students = $request->input('students', []);
        $results  = [];

        foreach ($students as $studentData) {
            $getValue = function ($keys) use ($studentData) {
                foreach ($keys as $key) {
                    if (isset($studentData[$key])) return $studentData[$key];
                    foreach ($studentData as $k => $v) {
                        if (strtolower($k) === strtolower($key)) return $v;
                    }
                }
                return null;
            };

            $updateData = [
                'MatriculeEtudiant' => $getValue(['MatriculeEtudiant', 'matriculeetudiant', 'cne', 'massar', 'student_id']),
                'Nom'               => $getValue(['Nom', 'nom', 'lastname', 'last name']),
                'Prenom'            => $getValue(['Prenom', 'prenom', 'firstname', 'first name']),
                'LibelleLong'       => $getValue(['LibelleLong', 'libellelong', 'filiere']),
                'CodeDiplome'       => $getValue(['CodeDiplome', 'codediplome', 'group', 'groupe']),
                'DateNaissance'     => $getValue(['DateNaissance', 'datenaissance', 'dob']),
                'Site'              => $getValue(['Site', 'site']),
                'cin'               => $getValue(['CIN', 'cin']),
                'NTelephone'        => $getValue(['NTelephone', 'ntelephone', 'telephone']),
                'Nationalite'       => $getValue(['Nationalite', 'nationalite']),
                'anneeEtude'        => $getValue(['anneeEtude', 'anneeetude']),
                'Nom_Arabe'         => $getValue(['Nom_Arabe', 'nom_arabe']),
                'Prenom_arabe'      => $getValue(['Prenom_arabe', 'prenom_arabe']),
                'NiveauScolaire'    => $getValue(['NiveauScolaire', 'niveauscolaire']),
            ];

            if (empty($updateData['MatriculeEtudiant'])) $updateData['MatriculeEtudiant'] = $updateData['cin'] ?? uniqid();

            $student = Student::where('MatriculeEtudiant', $updateData['MatriculeEtudiant'])
                ->when(!empty($updateData['cin']), fn($q) => $q->orWhere('cin', $updateData['cin']))
                ->first();

            if ($student) {
                $student->update($updateData);
            } else {
                $student = Student::create($updateData);
            }
            $results[] = $student;
        }

        return response()->json($results);
    }

    public function bulkUpdateStatus(Request $request)
    {
        $updates = $request->input('updates');
        $results = [];
        foreach ($updates as $update) {
            $student = Student::where('cin', $update['cin'])->first();
            if ($student) {
                $student->update([
                    'status'           => $update['status'],
                    'documentsUploaded'=> $update['documentsUploaded'] ?? $student->documentsUploaded,
                    'mismatch_details' => $update['mismatch_details'] ?? null,
                ]);
                $results[] = $student;
            }
        }
        return response()->json($results);
    }

    public function updateStatus(Request $request, $cin)
    {
        $student = Student::where('cin', $cin)->first();
        if ($student) {
            $student->update([
                'status'            => $request->input('status'),
                'documentsUploaded' => $request->input('documentsUploaded', $student->documentsUploaded),
            ]);
            return $student;
        }
        return response()->json(['message' => 'Student not found'], 404);
    }

    public function destroy($id)
    {
        $student = Student::findByAnyId($id);
        if ($student) {
            // Documents cascade-deleted via FK constraint
            $student->delete();
            return response()->json(['message' => 'Student deleted successfully']);
        }
        return response()->json(['message' => 'Student not found'], 404);
    }

    // ─────────────────────────────────────────────
    // DOCUMENT MANAGEMENT (DB-based)
    // ─────────────────────────────────────────────

    /**
     * List document metadata for a student (no binary data).
     */
    public function studentDocuments($id)
    {
        $student = Student::findByAnyId($id);
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        $docs = $student->documents()
            ->select('id', 'student_id', 'type', 'original_filename', 'mime_type', 'file_size', 'ocr_extracted_name', 'ocr_extracted_arabic_name', 'ocr_extracted_dob', 'ocr_extracted_cin', 'ocr_extracted_cne', 'ocr_status', 'created_at')
            ->get();
        return response()->json($docs);
    }

    /**
     * Serve a document image from the database.
     * Returns raw binary with proper MIME type — works like a file URL.
     */
    public function serveDocument($id)
    {
        $doc = Document::find($id);
        if (!$doc) {
            return response()->json(['message' => 'Document not found'], 404);
        }
        $binary = base64_decode($doc->file_data);
        return response($binary, 200)
            ->header('Content-Type', $doc->mime_type)
            ->header('Content-Disposition', 'inline; filename="' . $doc->original_filename . '"')
            ->header('Cache-Control', 'private, max-age=3600');
    }

    /**
     * Upload a single document for a student (from StudentDetail page).
     */
    public function uploadDocument(Request $request, $id)
    {
        // Prevent timeout
        set_time_limit(0);

        try {
            \Illuminate\Support\Facades\DB::statement("SET GLOBAL max_allowed_packet=134217728");
        } catch (\Exception $e) {
            // Ignore
        }

        $request->validate([
            'document' => 'required|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'type'     => 'required|string|in:birth_certificate,baccalaureate,cin,other',
        ]);

        $student = Student::find($id);
        if (!$student) return response()->json(['message' => 'Student not found'], 404);

        $file      = $request->file('document');
        $type      = $request->input('type');
        $mimeType  = $file->getMimeType();
        $fileSize  = $file->getSize();
        $filename  = $file->getClientOriginalName();
        $base64    = $this->compressImage($file->getRealPath(), $mimeType);

        // Replace existing doc of same type for this student
        Document::where('student_id', $student->id)
                ->where('type', $type)
                ->delete();

        $doc = Document::create([
            'student_id'        => $student->id,
            'type'              => $type,
            'original_filename' => $filename,
            'mime_type'         => $mimeType,
            'file_size'         => $fileSize,
            'file_data'         => $base64,
            'ocr_status'        => 'pending',
        ]);

        // Update counters
        $count = $student->documents()->count();
        $student->update(['documentsUploaded' => $count, 'status' => 'pending']);

        return response()->json([
            'message'     => 'Document uploaded successfully',
            'document_id' => $doc->id,
            'type'        => $type,
        ]);
    }

    /**
     * Bulk upload from a ZIP file — stores all documents in the database.
     */
    public function bulkUploadDocuments(Request $request)
    {
        // Prevent timeout during large uploads
        set_time_limit(0);

        try {
            // Attempt to proactively increase max_allowed_packet for large base64 strings
            \Illuminate\Support\Facades\DB::statement("SET GLOBAL max_allowed_packet=134217728");
        } catch (\Exception $e) {
            // Ignore if no SUPER privilege
        }

        $request->validate(['file' => 'required|file|mimes:zip|max:102400']);

        $zipFile  = $request->file('file');
        $zip      = new ZipArchive;
        $tempPath = storage_path('app/temp_upload_' . uniqid());

        if ($zip->open($zipFile->path()) === true) {
            $zip->extractTo($tempPath);
            $zip->close();
        } else {
            return response()->json(['error' => 'Failed to open ZIP file'], 400);
        }

        $results  = [];
        $files    = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($tempPath));

        foreach ($files as $file) {
            if ($file->isDir()) continue;
            $filename = $file->getFilename();
            if (str_starts_with($filename, '.')) continue;

            $relativePath = str_replace($tempPath . DIRECTORY_SEPARATOR, '', $file->getPathname());

            if (preg_match('/([A-Z]{1,2}[0-9]{5,8})/i', $relativePath, $matches)) {
                $cin     = strtoupper($matches[1]);
                $student = Student::where('cin', $cin)->first();

                if ($student) {
                    $ext      = strtolower($file->getExtension());
                    $mimeMap  = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'pdf' => 'application/pdf'];
                    $mimeType = $mimeMap[$ext] ?? 'application/octet-stream';
                    $type     = Document::detectType($filename);
                    $base64   = $this->compressImage($file->getRealPath(), $mimeType);

                    // Replace existing doc of same type
                    Document::where('student_id', $student->id)
                            ->where('type', $type)
                            ->delete();

                    Document::create([
                        'student_id'        => $student->id,
                        'type'              => $type,
                        'original_filename' => $filename,
                        'mime_type'         => $mimeType,
                        'file_size'         => $file->getSize(),
                        'file_data'         => $base64,
                        'ocr_status'        => 'pending',
                    ]);

                    $count = $student->documents()->count();
                    $student->update(['documentsUploaded' => $count, 'status' => 'pending']);
                    $results[$cin] = ($results[$cin] ?? 0) + 1;
                }
            }
        }

        \Illuminate\Support\Facades\File::deleteDirectory($tempPath);
        return response()->json(['message' => 'Documents uploaded and stored in database', 'counts' => $results]);
    }

    /**
     * Delete a specific document.
     */
    public function deleteDocument($id)
    {
        $doc = Document::find($id);
        if (!$doc) return response()->json(['message' => 'Document not found'], 404);

        $student = $doc->student;
        $doc->delete();

        if ($student) {
            $student->update(['documentsUploaded' => $student->documents()->count()]);
        }

        return response()->json(['message' => 'Document deleted successfully']);
    }

    // ─────────────────────────────────────────────
    // GROUP VERIFICATION
    // ─────────────────────────────────────────────

    public function verifyGroup(Request $request)
    {
        set_time_limit(0);
        $groupName = $request->input('group');
        $students  = Student::where('CodeDiplome', $groupName)->with('documents')->get();

        if ($students->isEmpty()) {
            return response()->json(['error' => 'No students found in this group'], 404);
        }

        // Count how many students actually have documents
        $studentsWithDocs = $students->filter(fn($s) => $s->documents->isNotEmpty());

        if ($studentsWithDocs->isEmpty()) {
            return response()->json([
                'error' => 'No documents uploaded yet for any student in group "' . $groupName . '". Please upload documents first.'
            ], 422);
        }

        // Ensure the storage/app directory exists
        $storageAppDir = storage_path('app');
        if (!is_dir($storageAppDir)) {
            mkdir($storageAppDir, 0755, true);
        }

        // Build a ZIP from DB document data
        $zipPath = storage_path('app/temp_verify_' . uniqid() . '.zip');
        $zip     = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return response()->json(['error' => 'Failed to create temporary ZIP file'], 500);
        }

        $filesAdded = 0;
        foreach ($studentsWithDocs as $student) {
            foreach ($student->documents as $doc) {
                $binary = base64_decode($doc->file_data);
                if (!$binary) continue;
                $ext      = match($doc->mime_type) {
                    'image/png'       => 'png',
                    'application/pdf' => 'pdf',
                    default           => 'jpg',
                };
                $zipEntry = $student->cin . '/' . $doc->type . '_' . $doc->id . '.' . $ext;
                $zip->addFromString($zipEntry, $binary);
                $filesAdded++;
            }
        }
        $zip->close();

        if ($filesAdded === 0 || !file_exists($zipPath)) {
            if (file_exists($zipPath)) unlink($zipPath);
            return response()->json(['error' => 'No valid document files found to verify'], 422);
        }

        // Build a JSON mapping of expected student parameters
        $expectedData = [];
        foreach ($studentsWithDocs as $student) {
            $expectedData[$student->cin] = [
                'fullName'       => trim($student->Nom . ' ' . $student->Prenom),
                'fullNameArabic' => trim(($student->Nom_Arabe ?? '') . ' ' . ($student->Prenom_arabe ?? '')),
                'dateOfBirth'    => $student->DateNaissance,
                'cin'            => $student->cin,
                'student_id'     => $student->MatriculeEtudiant
            ];
        }

        try {
            $ocrUrl   = env('OCR_SERVICE_URL', 'http://localhost:5001');
            \Illuminate\Support\Facades\Log::info("Sending group verification request to OCR service: " . $ocrUrl . " for group: " . $groupName);
            
            $response = Http::timeout(3600)
                ->attach('file', file_get_contents($zipPath), 'verify.zip')
                ->post($ocrUrl . '/validate', [
                    'expected_data' => json_encode($expectedData)
                ]);

            \Illuminate\Support\Facades\Log::info("OCR Service response status: " . $response->status());
            
            unlink($zipPath);


            if ($response->successful()) {
                $ocrResults = $response->json();

                foreach ($ocrResults as $res) {
                    $student = Student::where('cin', $res['cin'])->first();
                    if (!$student) continue;

                    $mismatches       = [];
                    $verifiedName     = $res['verified_name']         ?? null;
                    $verifiedArabicName = $res['verified_arabic_name'] ?? null;
                    $verifiedDob      = $res['verified_dob']           ?? null;
                    $isCorrect        = $res['is_correct']             ?? true;

                    if (isset($res['errors'])) {
                        foreach ($res['errors'] as $error) {
                            $mismatches[] = [
                                'document'   => $error['file'],
                                'field'      => isset($error['soft']) && $error['soft'] ? 'Avertissement OCR' : 'Erreur OCR',
                                'excelValue' => 'Document valide',
                                'ocrValue'   => $error['error'],
                                'soft'       => $error['soft'] ?? false,
                            ];
                        }
                    }

                    // Trust the OCR backend — it performs supervised validation
                    if (!$isCorrect && empty($mismatches)) {
                        $mismatches[] = [
                            'document'   => 'Verification Failure',
                            'field'      => 'OCR Général',
                            'excelValue' => 'Correspondances attendues',
                            'ocrValue'   => 'Incohérence détectée dans les données du document',
                        ];
                    }

                    // Persist OCR results back to individual document rows
                    if (isset($res['file_details'])) {
                        foreach ($res['file_details'] as $detail) {
                            // Filename pattern: {type}_{id}.{ext}  (built in verifyGroup)
                            if (preg_match('/^(\w+)_(\d+)\./', $detail['file'], $m)) {
                                $docId = $m[2];
                                Document::where('id', $docId)->update([
                                    'ocr_extracted_name'        => $detail['extracted_name']         ?? null,
                                    'ocr_extracted_arabic_name' => $detail['extracted_arabic_name']  ?? null,
                                    'ocr_extracted_dob'         => $detail['extracted_dob']           ?? null,
                                    'ocr_extracted_cin'         => $detail['extracted_cin']           ?? null,
                                    'ocr_extracted_cne'         => $detail['extracted_cne']           ?? null,
                                    'ocr_status'                => 'processed',
                                ]);
                            }
                        }
                    }

                    $student->update([
                        'status'               => $isCorrect ? 'verified' : 'mismatch',
                        'mismatch_details'     => $mismatches,
                        'verified_arabic_name' => $verifiedArabicName,
                    ]);
                }

                return response()->json($ocrResults);
            }

            return response()->json(['error' => 'OCR Service failed'], 500);

        } catch (\Exception $e) {
            if (file_exists($zipPath)) unlink($zipPath);
            return response()->json(['error' => 'Connection failed: ' . $e->getMessage()], 500);
        }
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────

    private function namesMatch($n1, $n2): bool
    {
        if (empty($n1) || empty($n2)) return false;
        
        $clean = function($name) {
            return strtolower(trim(preg_replace('/[^a-zA-Z0-9\s]/', ' ', $name)));
        };

        $n1_clean = $clean($n1);
        $n2_clean = $clean($n2);
        
        if ($n1_clean === $n2_clean) return true;
        
        $words1 = array_values(array_filter(explode(' ', $n1_clean)));
        $words2 = array_values(array_filter(explode(' ', $n2_clean)));
        
        if (empty($words1) || empty($words2)) return false;
        
        // Exact words subset match
        $intersect = array_intersect($words1, $words2);
        $minLen = min(count($words1), count($words2));
        if (count($intersect) >= $minLen && $minLen > 0) {
            return true;
        }

        // Fuzzy match per word
        $matchedWords = 0;
        foreach ($words1 as $w1) {
            foreach ($words2 as $w2) {
                similar_text($w1, $w2, $percent);
                if ($percent > 85 || levenshtein($w1, $w2) <= 1) { // 1 typo allowed per word, or 85% similarity
                    $matchedWords++;
                    break;
                }
            }
        }
        if ($matchedWords >= count($words1) || $matchedWords >= count($words2)) {
            return true;
        }

        // Failsafe string match (scrambled characters or small typo over whole string)
        $n1_no_space = str_replace(' ', '', $n1_clean);
        $n2_no_space = str_replace(' ', '', $n2_clean);
        
        if ($n1_no_space === $n2_no_space) return true;
        
        $s1 = str_split($n1_no_space); sort($s1); $s1 = implode('', $s1);
        $s2 = str_split($n2_no_space); sort($s2); $s2 = implode('', $s2);
        
        if ($s1 === $s2) return true;
        
        similar_text($n1_no_space, $n2_no_space, $percent_overall);
        if ($percent_overall > 85) return true;
        
        similar_text($s1, $s2, $percent_sorted);
        if ($percent_sorted > 85) return true;
        
        return false;
    }

    private function compressImage($filePath, $mimeType) {
        if (!in_array($mimeType, ['image/jpeg', 'image/png', 'image/jpg'])) {
            return base64_encode(file_get_contents($filePath));
        }

        $image = null;
        if ($mimeType === 'image/jpeg' || $mimeType === 'image/jpg') {
            $image = @imagecreatefromjpeg($filePath);
        } elseif ($mimeType === 'image/png') {
            $image = @imagecreatefrompng($filePath);
        }

        if (!$image) {
            return base64_encode(file_get_contents($filePath));
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $maxSize = 1200;

        if ($width > $maxSize || $height > $maxSize) {
            $ratio = min($maxSize / $width, $maxSize / $height);
            $newWidth = (int)($width * $ratio);
            $newHeight = (int)($height * $ratio);

            $newImage = imagecreatetruecolor($newWidth, $newHeight);

            if ($mimeType === 'image/png') {
                imagealphablending($newImage, false);
                imagesavealpha($newImage, true);
                $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
                imagefilledrectangle($newImage, 0, 0, $newWidth, $newHeight, $transparent);
            }

            imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($image);
            $image = $newImage;
        }

        ob_start();
        if ($mimeType === 'image/png') {
            imagepng($image, null, 8);
        } else {
            imagejpeg($image, null, 70);
        }
        $compressedData = ob_get_clean();
        imagedestroy($image);

        return base64_encode($compressedData);
    }
}
