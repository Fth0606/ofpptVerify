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
        $students = $request->input('students');
        $results = [];
        foreach ($students as $studentData) {
            $student = Student::updateOrCreate(
                ['student_id' => $studentData['id']],
                [
                    'fullName' => $studentData['fullName'],
                    'dateOfBirth' => $studentData['dateOfBirth'] ?? null,
                    'birthplace' => $studentData['birthplace'] ?? null,
                    'cin' => $studentData['cin'] ?? null,
                    'filiere' => $studentData['filiere'] ?? null,
                    'classe' => $studentData['classe'] ?? null,
                    'group' => $studentData['group'] ?? null,
                    'parentName' => $studentData['parentName'] ?? null,
                    'bacYear' => $studentData['bacYear'] ?? null,
                    'bacScore' => $studentData['bacScore'] ?? null,
                    'bacMention' => $studentData['bacMention'] ?? null,
                ]
            );
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
                    'documentsUploaded' => $update['documentsUploaded'] ?? $student->documentsUploaded
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
}
