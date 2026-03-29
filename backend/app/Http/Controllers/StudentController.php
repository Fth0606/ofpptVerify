<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use ZipArchive;

class StudentController extends Controller
{
    public function index()
    {
        return Student::all();
    }

    public function show($id)
    {
        $student = Student::findByAnyId($id);
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        return $student;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'student_id' => 'required|unique:students',
            'fullName' => 'required',
            'dateOfBirth' => 'nullable',
            'birthplace' => 'nullable',
            'cin' => 'nullable',
            'filiere' => 'nullable',
            'classe' => 'nullable',
            'group' => 'nullable',
            'parentName' => 'nullable',
            'bacYear' => 'nullable',
            'bacScore' => 'nullable',
            'bacMention' => 'nullable',
        ]);

        return Student::create($data);
    }

    public function bulkStore(Request $request)
    {
        $students = $request->input('students', []);
        $results = [];

        foreach ($students as $studentData) {
            $getValue = function($keys) use ($studentData) {
                foreach ($keys as $key) {
                    if (isset($studentData[$key])) return $studentData[$key];
                    foreach ($studentData as $k => $v) {
                        if (strtolower($k) === strtolower($key)) return $v;
                    }
                }
                return null;
            };

            $studentId = $getValue(['id', 'student_id', 'cne', 'massar']);
            $cin = $getValue(['cin', 'cin_number']);
            $firstName = $getValue(['firstName', 'prenom', 'prénom', 'prã©nom', 'first name', 'firstname']);
            $lastName = $getValue(['lastName', 'nom', 'last name', 'lastname', 'surname']);
            $fullName = $getValue(['fullName', 'full name', 'fullname', 'name']);

            if ((empty($firstName) || empty($lastName)) && !empty($fullName)) {
                if (empty($firstName) && empty($lastName)) {
                    $parts = explode(' ', $fullName, 2);
                    $lastName = $parts[0] ?? '';
                    $firstName = $parts[1] ?? '';
                } elseif (empty($firstName)) {
                    $firstName = trim(str_replace($lastName, '', $fullName));
                } elseif (empty($lastName)) {
                    $lastName = trim(str_replace($firstName, '', $fullName));
                }
            } elseif (!empty($firstName) && !empty($lastName) && empty($fullName)) {
                $fullName = trim($lastName . ' ' . $firstName);
            }

            if (empty($studentId)) $studentId = $cin ?? uniqid();
            if (empty($fullName)) $fullName = 'Student ' . ($cin ?? $studentId);

            $student = Student::where('student_id', $studentId)
                ->when(!empty($cin), function ($query) use ($cin) {
                    return $query->orWhere('cin', $cin);
                })
                ->first();

            $updateData = [
                'student_id' => $studentId,
                'firstName' => $firstName,
                'lastName' => $lastName,
                'fullName' => $fullName,
                'dateOfBirth' => $getValue(['dateOfBirth', 'dob', 'date_of_birth']),
                'birthplace' => $getValue(['birthplace', 'lieu_de_naissance']),
                'cin' => $cin,
                'filiere' => $getValue(['filiere', 'filière', 'branch']),
                'classe' => $getValue(['classe', 'class']),
                'group' => $getValue(['group', 'groupe']),
                'parentName' => $getValue(['parentName', 'parent_name', 'nom_du_parent']),
                'bacYear' => $getValue(['bacYear', 'bac_year', 'année_du_bac']),
                'bacScore' => $getValue(['bacScore', 'bac_score', 'moyenne_du_bac']),
                'bacMention' => $getValue(['bacMention', 'bac_mention', 'mention_du_bac']),
            ];

            if ($student) {
                if ($student->student_id === $updateData['student_id']) unset($updateData['student_id']);
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
                    'status' => $update['status'],
                    'documentsUploaded' => $update['documentsUploaded'] ?? $student->documentsUploaded,
                    'mismatch_details' => $update['mismatch_details'] ?? null,
                    'document_paths' => $update['document_paths'] ?? $student->document_paths
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
                'status' => $request->input('status'),
                'documentsUploaded' => $request->input('documentsUploaded', $student->documentsUploaded)
            ]);
            return $student;
        }
        return response()->json(['message' => 'Student not found'], 404);
    }

    public function destroy($id)
    {
        $student = Student::findByAnyId($id);
        if ($student) {
            $student->delete();
            return response()->json(['message' => 'Student deleted successfully']);
        }
        return response()->json(['message' => 'Student not found'], 404);
    }

    public function uploadDocument(Request $request, $id)
    {
        $request->validate([
            'document' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
            'type' => 'required|string|in:birth_certificate,baccalaureate,cin'
        ]);

        $student = Student::find($id);
        if (!$student) return response()->json(['message' => 'Student not found'], 404);

        $file = $request->file('document');
        $type = $request->input('type');
        $extension = $file->getClientOriginalExtension();
        $filename = $id . '_' . $type . '.' . $extension;
        $path = $file->storeAs('documents', $filename, 'public');

        $documentPaths = $student->document_paths ?? [];
        $documentPaths[$type] = $path;
        
        $student->update([
            'document_paths' => $documentPaths,
            'documentsUploaded' => count($documentPaths)
        ]);
        
        return response()->json(['message' => 'Document uploaded successfully', 'path' => $path, 'type' => $type]);
    }

    public function bulkUploadDocuments(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:zip|max:51200']);

        $zipFile = $request->file('file');
        $zip = new ZipArchive;
        $tempPath = storage_path('app/temp_upload_' . uniqid());
        
        if ($zip->open($zipFile->path()) === TRUE) {
            $zip->extractTo($tempPath);
            $zip->close();
        } else {
            return response()->json(['error' => 'Failed to open ZIP file'], 400);
        }

        $results = [];
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($tempPath));
        
        foreach ($files as $file) {
            if ($file->isDir()) continue;
            $filename = $file->getFilename();
            if (str_starts_with($filename, '.')) continue;
            
            $relativePath = str_replace($tempPath . DIRECTORY_SEPARATOR, '', $file->getPathname());
            
            if (preg_match('/([A-Z]{1,2}[0-9]{5,8})/i', $relativePath, $matches)) {
                $cin = strtoupper($matches[1]);
                $student = Student::where('cin', $cin)->first();
                
                if ($student) {
                    $type = 'other';
                    $lowerName = strtolower($filename);
                    if (str_contains($lowerName, 'cin') || str_contains($lowerName, 'id')) $type = 'cin';
                    elseif (str_contains($lowerName, 'bac')) $type = 'baccalaureate';
                    elseif (str_contains($lowerName, 'naiss') || str_contains($lowerName, 'birth')) $type = 'birth_certificate';
                    
                    $newFilename = $student->id . '_' . $type . '_' . uniqid() . '.' . $file->getExtension();
                    $destination = 'documents/' . $cin . '/' . $newFilename;
                    
                    Storage::disk('public')->put($destination, file_get_contents($file->getRealpath()));
                    
                    $documentPaths = $student->document_paths ?? [];
                    $documentPaths[$type] = $destination;
                    
                    $student->update([
                        'document_paths' => $documentPaths,
                        'documentsUploaded' => count($documentPaths),
                        'status' => 'pending'
                    ]);
                    $results[$cin] = ($results[$cin] ?? 0) + 1;
                }
            }
        }
        \Illuminate\Support\Facades\File::deleteDirectory($tempPath);
        return response()->json(['message' => 'Documents uploaded successfully', 'counts' => $results]);
    }

    private function namesMatch($n1, $n2)
    {
        if (empty($n1) || empty($n2)) return false;
        
        $n1 = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $n1));
        $n2 = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $n2));
        
        if ($n1 === $n2) return true;
        
        $s1 = str_split($n1); sort($s1); $s1 = implode('', $s1);
        $s2 = str_split($n2); sort($s2); $s2 = implode('', $s2);
        
        return $s1 === $s2;
    }

    public function verifyGroup(Request $request)
    {
        set_time_limit(180); // Increase PHP execution time for group OCR
        $groupName = $request->input('group');
        $students = Student::where('group', $groupName)->get();
        if ($students->isEmpty()) return response()->json(['error' => 'No students found'], 404);

        $zipPath = storage_path('app/temp_verify_' . uniqid() . '.zip');
        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE);

        foreach ($students as $student) {
            if (!$student->document_paths) continue;
            foreach ($student->document_paths as $type => $path) {
                if (Storage::disk('public')->exists($path)) {
                    $zip->addFromString($student->cin . '/' . basename($path), Storage::disk('public')->get($path));
                }
            }
        }
        $zip->close();

        try {
            $ocrUrl = env('OCR_SERVICE_URL', 'http://localhost:5001');
            $response = Http::timeout(120)->attach('file', file_get_contents($zipPath), 'verify.zip')->post($ocrUrl . '/validate');
            unlink($zipPath);

            if ($response->successful()) {
                $ocrResults = $response->json();
                foreach ($ocrResults as $res) {
                    $student = Student::where('cin', $res['cin'])->first();
                    if ($student) {
                        $mismatches = [];
                        $verifiedName = $res['verified_name'] ?? null;
                        $verifiedDob = $res['verified_dob'] ?? null;
                        $isCorrect = $res['is_correct'] ?? true;
                        
                        // Add Flask-side errors/mismatches
                        if (isset($res['errors'])) {
                            foreach ($res['errors'] as $error) {
                                $mismatches[] = [
                                    'document' => $error['file'],
                                    'field' => 'OCR Error',
                                    'excelValue' => 'Valid document',
                                    'ocrValue' => $error['error']
                                ];
                            }
                        }

                        // Check against DB name
                        if ($verifiedName && !$this->namesMatch($verifiedName, $student->fullName)) {
                            $isCorrect = false;
                            $mismatches[] = [
                                'document' => 'verification',
                                'field' => 'Full Name',
                                'excelValue' => $student->fullName,
                                'ocrValue' => $verifiedName
                            ];
                        }

                        // Check against DB DOB
                        if ($verifiedDob && $student->dateOfBirth && $student->dateOfBirth !== $verifiedDob) {
                            $isCorrect = false;
                            $mismatches[] = [
                                'document' => 'verification',
                                'field' => 'Date of Birth',
                                'excelValue' => $student->dateOfBirth,
                                'ocrValue' => $verifiedDob
                            ];
                        }

                        // Ensure mismatches array reflects the status
                        if (!$isCorrect && empty($mismatches)) {
                            $mismatches[] = [
                                'document' => 'OCR Service',
                                'field' => 'Validation Status',
                                'excelValue' => 'Verified',
                                'ocrValue' => 'Mismatch detected'
                            ];
                        }

                        $student->update([
                            'status' => $isCorrect ? 'verified' : 'mismatch',
                            'mismatch_details' => $mismatches
                        ]);
                    }
                }
                return response()->json($ocrResults);
            }
            return response()->json(['error' => 'OCR Service failed'], 500);
        } catch (\Exception $e) {
            if (file_exists($zipPath)) unlink($zipPath);
            return response()->json(['error' => 'Connection failed: ' . $e->getMessage()], 500);
        }
    }
}
