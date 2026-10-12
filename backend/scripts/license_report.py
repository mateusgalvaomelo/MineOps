import importlib.metadata
import json

records = []
for distribution in importlib.metadata.distributions():
    metadata = distribution.metadata
    classifiers = [
        c.replace("License :: ", "") for c in metadata.get_all("Classifier", []) if c.startswith("License ::")
    ]
    records.append(
        {
            "name": metadata["Name"],
            "version": distribution.version,
            "license": metadata.get("License-Expression")
            or classifiers
            or metadata.get("License")
            or "See distribution license file",
        }
    )
print(json.dumps(sorted(records, key=lambda row: row["name"].lower()), indent=2))
