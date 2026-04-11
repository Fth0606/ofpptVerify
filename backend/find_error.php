<?php
$file = fopen('storage/logs/laravel.log', 'r');
if (!$file) exit('Cannot open file');

$latestLines = [];
while (($line = fgets($file)) !== false) {
    if (strpos($line, 'local.ERROR:') !== false) {
        $latestLines[] = $line;
    }
}
fclose($file);

// Show the last 5 errors:
$lastErrors = array_slice($latestLines, -5);
foreach ($lastErrors as $err) {
    echo substr($err, 0, 300) . "\n";
}
