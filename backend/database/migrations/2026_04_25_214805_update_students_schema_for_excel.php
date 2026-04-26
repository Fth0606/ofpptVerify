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
            // Drop old columns
            $table->dropColumn([
                'student_id',
                'fullName',
                'firstName',
                'lastName',
                'dateOfBirth',
                'birthplace',
                'filiere',
                'classe',
                'group',
                'parentName',
                'bacYear',
                'bacScore',
                'bacMention',
                'cne'
            ]);

            // Add new columns
            $table->string('MatriculeEtudiant')->nullable();
            $table->string('Nom')->nullable();
            $table->string('Prenom')->nullable();
            $table->string('LibelleLong')->nullable();
            $table->string('CodeDiplome')->nullable();
            $table->string('DateNaissance')->nullable();
            $table->string('Site')->nullable();
            $table->string('NTelephone')->nullable();
            $table->string('Nationalite')->nullable();
            $table->string('anneeEtude')->nullable();
            $table->string('Nom_Arabe')->nullable();
            $table->string('Prenom_arabe')->nullable();
            $table->string('NiveauScolaire')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn([
                'MatriculeEtudiant',
                'Nom',
                'Prenom',
                'LibelleLong',
                'CodeDiplome',
                'DateNaissance',
                'Site',
                'NTelephone',
                'Nationalite',
                'anneeEtude',
                'Nom_Arabe',
                'Prenom_arabe',
                'NiveauScolaire'
            ]);

            $table->string('student_id')->nullable();
            $table->string('fullName')->nullable();
            $table->string('firstName')->nullable();
            $table->string('lastName')->nullable();
            $table->string('dateOfBirth')->nullable();
            $table->string('birthplace')->nullable();
            $table->string('filiere')->nullable();
            $table->string('classe')->nullable();
            $table->string('group')->nullable();
            $table->string('parentName')->nullable();
            $table->string('bacYear')->nullable();
            $table->string('bacScore')->nullable();
            $table->string('bacMention')->nullable();
            $table->string('cne')->nullable();
        });
    }
};
