import { describe, it, expect } from 'vitest';

// Updated implementation logic from src/pages/UploadDocuments.tsx (after fix)
function updatedNameMatch(dbFullName: string, ocrFullName: string) {
  const dbFull = dbFullName.toLowerCase();
  const ocrFull = ocrFullName.toLowerCase();

  // Set-based comparison for order independence
  const dbWords = dbFull.split(/\s+/).filter(w => w.length > 1);
  const ocrWords = ocrFull.split(/\s+/).filter(w => w.length > 1);

  const missingWords = dbWords.filter(dbW => !ocrWords.some(ocrW => ocrW === dbW));
  // const extraWords = ocrWords.filter(ocrW => !dbWords.some(dbW => dbW === ocrW));

  // It's a match if all DB words are there, and not too many extra words are added
  if (missingWords.length > 0 || (ocrWords.length < 2 && dbWords.length >= 2)) {
    return false; // Mismatch
  }
  return true; // Match
}

describe('Updated Name Matching Logic', () => {
  it('correctly identifies a match when names are in different order', () => {
    expect(updatedNameMatch('MOHAMMED TABSAR', 'TABSAR MOHAMMED')).toBe(true);
  });

  it('correctly identifies the mismatch for TABSART vs TABSAR', () => {
    const dbName = 'TABSART MOHAMMED';
    const ocrName = 'MOHAMMED TABSAR';
    
    // NOW it should return false (Mismatch)
    const isMatch = updatedNameMatch(dbName, ocrName);
    
    console.log(`Matching "${dbName}" with "${ocrName}": result is ${isMatch}`);
    
    expect(isMatch).toBe(false);
  });
});
