<?php

namespace App\Http\Controllers;

use App\Models\Student;
use Illuminate\Http\Request;

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
            // Helper to find value by multiple possible keys (case-insensitive)
            $getValue = function($keys) use ($studentData) {
                foreach ($keys as $key) {
                    if (isset($studentData[$key])) return $studentData[$key];
                    // Case-insensitive check
                    foreach ($studentData as $k => $v) {
                        if (strtolower($k) === strtolower($key)) return $v;
                    }
                }
                return null;
            };

            $studentId = $getValue(['id', 'student_id', 'cne', 'massar']);
            $cin = $getValue(['cin', 'cin_number']);
            $firstName = $getValue(['firstName', 'prenom', 'prénom', 'prã©nom', 'prã©nom', 'first name', 'firstname']);
            $lastName = $getValue(['lastName', 'nom', 'last name', 'lastname', 'surname']);
            $fullName = $getValue(['fullName', 'full name', 'fullname', 'name']);

            // Robust name resolution: only split if individual parts are missing
            if ((empty($firstName) || empty($lastName)) && !empty($fullName)) {
                // If we have fullName but are missing one of the parts, try to fill the missing one
                if (empty($firstName) && empty($lastName)) {
                    $parts = explode(' ', $fullName, 2);
                    $lastName = $parts[0] ?? '';
                    $firstName = $parts[1] ?? '';
                } elseif (empty($firstName)) {
                    // We have last name, firstName is the rest of fullName
                    $firstName = trim(str_replace($lastName, '', $fullName));
                } elseif (empty($lastName)) {
                    // We have first name, lastName is the rest of fullName
                    $lastName = trim(str_replace($firstName, '', $fullName));
                }
            } elseif (!empty($firstName) && !empty($lastName) && empty($fullName)) {
                $fullName = trim($lastName . ' ' . $firstName);
            }

            // Fallback for missing student_id
            if (empty($studentId)) {
                $studentId = $cin ?? uniqid();
            }

            // Fallback for missing fullName
            if (empty($fullName)) {
                $fullName = 'Student ' . ($cin ?? $studentId);
            }

            // Find student by student_id OR cin to prevent duplicates
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
                // Remove student_id from update if it hasn't changed to avoid unique constraint issues
                if ($student->student_id === $updateData['student_id']) {
                    unset($updateData['student_id']);
                }
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
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        $file = $request->file('document');
        $type = $request->input('type');
        
        // Generate a clean filename: 123_birth_certificate.pdf
        $extension = $file->getClientOriginalExtension();
        $filename = $id . '_' . $type . '.' . $extension;
        
        // Save to public storage
        $path = $file->storeAs('documents', $filename, 'public');

        // Update student record
        $documentPaths = $student->document_paths ?? [];
        $documentPaths[$type] = $path;
        
        $student->update([
            'document_paths' => $documentPaths,
            'documentsUploaded' => count($documentPaths)
        ]);
        
        return response()->json([
            'message' => 'Document uploaded successfully',
            'path' => $path,
            'type' => $type
        ]);
    }
}
