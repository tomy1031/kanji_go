#!/usr/bin/env python3
import csv
import sys

# Add world and order columns to kanji_master.csv
# Stage to World/Order mapping:
# Stage 1-3 -> World 1, Order 1-3
# Stage 4-6 -> World 2, Order 1-3
# Stage 7-9 -> World 3, Order 1-3
# etc.

input_file = 'src/data/kanji_master.csv'
output_file = 'src/data/kanji_master_with_world.csv'

with open(input_file, 'r', encoding='utf-8') as fin, open(output_file, 'w', encoding='utf-8', newline='') as fout:
    reader = csv.DictReader(fin)
    
    # Add new columns: world, order
    fieldnames = list(reader.fieldnames)
    # Insert after 'stage' column
    stage_idx = fieldnames.index('stage')
    fieldnames.insert(stage_idx + 1, 'world')
    fieldnames.insert(stage_idx + 2, 'order')
    
    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()
    
    for row in reader:
        stage_str = row['stage'].strip()
        
        if not stage_str:
            row['world'] = ''
            row['order'] = ''
            writer.writerow(row)
            continue
            
        stage = int(stage_str)
        
        # Calculate world and order from stage
        # Stage 1-3 -> world 1, order 1-3
        # Stage 4-6 -> world 2, order 1-3
        world = ((stage - 1) // 3) + 1
        order = ((stage - 1) % 3) + 1
        
        row['world'] = str(world)
        row['order'] = str(order)
        
        writer.writerow(row)

print(f"Added world/order columns to {output_file}")
print("Example mappings:")
print("  Stage 1 -> World 1, Order 1")
print("  Stage 2 -> World 1, Order 2")
print("  Stage 3 -> World 1, Order 3")
print("  Stage 4 -> World 2, Order 1")
print("  Stage 6 -> World 2, Order 3")
