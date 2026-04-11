<?php

use App\Http\Controllers\StudentController;
use Illuminate\Support\Facades\Route;

// Public: serve document images (used in <img src="..."> tags — can't send headers)
Route::get('/documents/{id}/file', [StudentController::class, 'serveDocument']);

    // ── Students ──────────────────────────────────────────
    Route::get('/students',              [StudentController::class, 'index']);
    Route::get('/students/{id}',         [StudentController::class, 'show']);
    Route::post('/students',             [StudentController::class, 'store']);
    Route::post('/students/bulk',        [StudentController::class, 'bulkStore']);
    Route::post('/students/bulk-status', [StudentController::class, 'bulkUpdateStatus']);
    Route::post('/students/verify-group',[StudentController::class, 'verifyGroup']);
    Route::post('/students/{cin}/status',[StudentController::class, 'updateStatus']);
    Route::delete('/students/{id}',      [StudentController::class, 'destroy']);

    // ── Documents (per student) ───────────────────────────
    Route::get('/students/{id}/documents',        [StudentController::class, 'studentDocuments']);
    Route::post('/students/{id}/documents',       [StudentController::class, 'uploadDocument']);
    Route::post('/students/bulk-upload-documents',[StudentController::class, 'bulkUploadDocuments']);

    // ── Documents (individual operations) ────────────────
    Route::delete('/documents/{id}',     [StudentController::class, 'deleteDocument']);
