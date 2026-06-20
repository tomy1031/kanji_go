#!/usr/bin/env python3
import csv

# Remove stage column from kanji_master.csv
input_file = 'src/data/kanji_master.csv'
output_file = 'src/data/kanji_master_no_stage.csv'

with open(input_file, 'r', encoding='utf-8') as fin, open(output_file, 'w', encoding='utf-8', newline='') as fout:
    reader = csv.DictReader(fin)
    
    # Remove 'stage' from fieldnames
    fieldnames = [f for f in reader.fieldnames if f != 'stage']
    
    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()
    
    for row in reader:
        # Remove stage field
        row.pop('stage', None)
        writer.writerow(row)

print(f"Removed 'stage' column from kanji_master.csv")
print(f"Output: {output_file}")
