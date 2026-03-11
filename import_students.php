<?php
require __DIR__.'/backend/vendor/autoload.php';
$app = require_once __DIR__.'/backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Student;

$csv = array_map('str_getcsv', file('students_complete.csv'));
$header = array_shift($csv);

foreach ($csv as $row) {
    $data = array_combine($header, $row);
    // Map CSV columns to Model columns if they differ
    // students_complete.csv: Nom,Prénom,cin,filiere,classe,dateOfBirth,birthplace,group,parentName,bacYear,bacScore,bacMention,id

    Student::updateOrCreate(
        ['student_id' => $data['id']],
        [
            'firstName' => $data['Prénom'],
            'lastName' => $data['Nom'],
            'fullName' => $data['Nom'] . ' ' . $data['Prénom'],
            'dateOfBirth' => $data['dateOfBirth'],
            'birthplace' => $data['birthplace'],
            'cin' => $data['cin'],
            'filiere' => $data['filiere'],
            'classe' => $data['classe'],
            'group' => $data['group'],
            'parentName' => $data['parentName'],
            'bacYear' => $data['bacYear'],
            'bacScore' => $data['bacScore'],
            'bacMention' => $data['bacMention'],
            'status' => 'pending'
        ]
    );
}
echo "Imported students successfully\n";
