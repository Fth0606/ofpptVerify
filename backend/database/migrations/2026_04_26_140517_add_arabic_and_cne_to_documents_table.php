<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('ocr_extracted_arabic_name')->nullable()->after('ocr_extracted_name');
            $table->string('ocr_extracted_cne')->nullable()->after('ocr_extracted_cin');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['ocr_extracted_arabic_name', 'ocr_extracted_cne']);
        });
    }
};
