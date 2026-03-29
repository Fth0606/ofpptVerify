<?php

use App\Http\Controllers\StudentController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('api.token')->group(function () {
    Route::get('/students', [StudentController::class, 'index']);
    Route::get('/students/{id}', [StudentController::class, 'show']);
    Route::post('/students', [StudentController::class, 'store']);
    Route::post('/students/bulk', [StudentController::class, 'bulkStore']);
    Route::post('/students/bulk-status', [StudentController::class, 'bulkUpdateStatus']);
    Route::post('/students/bulk-upload-documents', [StudentController::class, 'bulkUploadDocuments']);
    Route::post('/students/verify-group', [StudentController::class, 'verifyGroup']);
    Route::post('/students/{cin}/status', [StudentController::class, 'updateStatus']);
    Route::delete('/students/{id}', [StudentController::class, 'destroy']);
    Route::post('/students/{id}/documents', [StudentController::class, 'uploadDocument']);
});
