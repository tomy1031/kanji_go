#!/usr/bin/env python3
import csv
import sys

# Normalize stage numbers per level
# N5: 1-17 stays the same
# N4: 18-55 becomes 1-38
# N3: 100-129 becomes 1-30

input_file = 'src/data/kanji_master.csv'
output_file = 'src/data/kanji_master_normalized.csv'

with open(input_file, 'r', encoding='utf-8') as fin, open(output_file, 'w', encoding='utf-8', newline='') as fout:
    reader = csv.DictReader(fin)
    writer = csv.DictWriter(fout, fieldnames=reader.fieldnames)
    writer.writeheader()
    
    for row in reader:
        level = row['level']
        stage_str = row['stage'].strip()
        
        if not stage_str:
            writer.writerow(row)
            continue
            
        stage = int(stage_str)
        
        if level == 'N5':
            # N5: keep as is (1-17)
            new_stage = stage
        elif level == 'N4':
            # N4: 18-55 → 1-38
            new_stage = stage - 17
        elif level == 'N3':
            # N3: 100-129 → 1-30
            new_stage = stage - 99
        else:
            new_stage = stage
        
        row['stage'] = str(new_stage)
        writer.writerow(row)

print(f"Normalized stages written to {output_file}")
print("N5: 1-17 (unchanged)")
print("N4: 18-55 → 1-38")
print("N3: 100-129 → 1-30")
