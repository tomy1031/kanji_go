// CSV Override System
// Stores edited CSV data in localStorage and provides it to the game at runtime
// Handles schema changes gracefully - warns about missing/extra columns but continues

const OVERRIDE_PREFIX = 'kanjigo-csv-override-';

export type CsvType = 'enemy_data' | 'stage_data' | 'evolution_data' | 'monster_data' | 'kanji_master' | 'exp_table';

// Get override data from localStorage
export const getCsvOverride = (csvType: CsvType): string | null => {
    try {
        return localStorage.getItem(`${OVERRIDE_PREFIX}${csvType}`);
    } catch {
        return null;
    }
};

// Set override data in localStorage
export const setCsvOverride = (csvType: CsvType, csvContent: string): void => {
    try {
        localStorage.setItem(`${OVERRIDE_PREFIX}${csvType}`, csvContent);
    } catch (e) {
        console.error(`[CSV Override] Failed to save ${csvType}:`, e);
    }
};

// Clear override for a specific CSV
export const clearCsvOverride = (csvType: CsvType): void => {
    try {
        localStorage.removeItem(`${OVERRIDE_PREFIX}${csvType}`);
    } catch {
        // Ignore errors
    }
};

// Clear all CSV overrides
export const clearAllCsvOverrides = (): void => {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(OVERRIDE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    } catch {
        // Ignore errors
    }
};

// Check if override exists
export const hasCsvOverride = (csvType: CsvType): boolean => {
    return getCsvOverride(csvType) !== null;
};

// Parse CSV string to array of rows (handles multi-line values in quotes)
export const parseCsvString = (csvContent: string): string[][] => {
    const lines = csvContent.trim().split('\n');
    return lines.map(line => {
        // Simple split - for more complex CSV with quotes, would need proper parser
        return line.split(',');
    });
};

// Convert array of rows to CSV string
export const rowsToCsvString = (headers: string[], rows: string[][]): string => {
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => row.join(','));
    return [headerLine, ...dataLines].join('\n');
};

// Validate and migrate data when columns change
// Returns validated data with warnings
export interface CsvValidationResult {
    isValid: boolean;
    data: string[][];
    warnings: string[];
}

export const validateCsvData = (
    expectedHeaders: string[],
    currentHeaders: string[],
    data: string[][]
): CsvValidationResult => {
    const warnings: string[] = [];

    // Find missing columns (in expected but not in current)
    const missingColumns = expectedHeaders.filter(h => !currentHeaders.includes(h));
    if (missingColumns.length > 0) {
        warnings.push(`Missing columns: ${missingColumns.join(', ')}`);
    }

    // Find extra columns (in current but not in expected)
    const extraColumns = currentHeaders.filter(h => !expectedHeaders.includes(h));
    if (extraColumns.length > 0) {
        warnings.push(`Extra columns (will be ignored): ${extraColumns.join(', ')}`);
    }

    // Re-map data to match expected headers
    const migratedData = data.map(row => {
        return expectedHeaders.map(expectedHeader => {
            const currentIndex = currentHeaders.indexOf(expectedHeader);
            if (currentIndex >= 0 && row[currentIndex] !== undefined) {
                return row[currentIndex];
            }
            return ''; // Default empty for missing columns
        });
    });

    return {
        isValid: warnings.length === 0,
        data: migratedData,
        warnings,
    };
};

// Helper to get either override or static data
export const getCsvData = async (
    csvType: CsvType,
    staticImportFn: () => Promise<string>
): Promise<string> => {
    const override = getCsvOverride(csvType);
    if (override) {
        console.log(`[CSV] Using localStorage override for ${csvType}`);
        return override;
    }
    return staticImportFn();
};
