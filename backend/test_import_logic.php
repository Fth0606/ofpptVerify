<?php

// Mocking the environment for a simple script
define('LARAVEL_START', microtime(true));
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\Student;
use Illuminate\Http\Request;
use App\Http\Controllers\StudentController;

$controller = new StudentController();

// Test Data
$testData = [
    'students' => [
        [
            'id' => 'TEST_STUDENT_001',
            'fullName' => 'Test Student with Accents: André Émile',
            'cin' => 'TEST001',
            'filiere' => 'Développement Digital',
            'classe' => 'DEV101'
        ],
        [
            'student_id' => 'TEST_STUDENT_002', // Testing alternative key
            'name' => 'Another Test Student',     // Testing alternative key
            'cin_number' => 'TEST002',            // Testing alternative key
            'filière' => 'Infrastructure Digitale' // Testing alternative key
        ]
    ]
];

echo "--- Testing Bulk Store ---\n";
$request = Request::create('/api/students/bulk', 'POST', $testData);
$response = $controller->bulkStore($request);

echo "Response Status: " . $response->getStatusCode() . "\n";
$data = json_decode($response->getContent(), true);
echo "Records created/updated: " . count($data) . "\n";

foreach ($data as $student) {
    echo "Saved: " . $student['fullName'] . " (ID: " . $student['student_id'] . ", CIN: " . $student['cin'] . ")\n";
}

echo "\n--- Verifying findByAnyId ---\n";
$s1 = Student::findByAnyId('TEST_STUDENT_001');
echo "Found by student_id: " . ($s1 ? "YES" : "NO") . "\n";

$s1_db = Student::findByAnyId($s1->id);
echo "Found by database id: " . ($s1_db ? "YES" : "NO") . "\n";

echo "\n--- Cleanup ---\n";
Student::where('student_id', 'like', 'TEST_STUDENT_%')->delete();
echo "Test data cleaned up.\n";
