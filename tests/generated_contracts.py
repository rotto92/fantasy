#!/usr/bin/env python3

from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
workbook = load_workbook(ROOT / "fantasy_high_fantasy_archetype_atlas_v4.xlsx", read_only=True, data_only=True)

guide = workbook["Character Viz Guide"]
guide_rows = {
    str(row[0]): str(row[1])
    for row in guide.iter_rows(min_row=2, values_only=True)
    if row[0] and row[1]
}
assert "normalized being/entity or role/vocation concept" in guide_rows["One visual noun"]
assert "named character" not in guide_rows["One visual noun"]
assert "selected normalized concept" in guide_rows["No global edges"]

start = workbook["Start Here"]
assert "normalized-concept atlas" in str(start["A3"].value).lower()
assert "characters and source-native terms are cited evidence" in str(start["A3"].value).lower()
assert "normalized-concept" in str(workbook.properties.subject).lower()
assert "concepts as graph nodes" in str(workbook.properties.description).lower()
assert "only characters are visualization nodes" not in str(workbook.properties.description).lower()

dictionary = workbook["Data Dictionary"]
dictionary_rows = [tuple(str(value or "") for value in row) for row in dictionary.iter_rows(values_only=True)]
assert any(
    row[0] == "Character Catalogue"
    and row[1] == "Character_ID"
    and "never become public graph nodes" in row[5]
    for row in dictionary_rows
)

print("Generated workbook graph contract passed.")
