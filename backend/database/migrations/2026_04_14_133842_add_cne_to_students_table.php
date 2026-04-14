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
        Schema::table('students', function (Blueprint $table) {
            $table->string('cne')->nullable()->after('cin');
        });
        
        // Copy existing student_id to cne if it looks like a CNE
        \Illuminate\Support\Facades\DB::statement("UPDATE students SET cne = student_id WHERE student_id REGEXP '^[A-Z][0-9]{8,9}$' AND cne IS NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('cne');
        });
    }
};
