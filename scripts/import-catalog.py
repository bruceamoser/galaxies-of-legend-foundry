"""Import the active GoL Markdown catalog into the browser workshop."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
design = root / "design"
out = Path(__file__).resolve().parents[1]
sources = {}


def read(path):
    data = path.read_bytes()
    sources[str(path.relative_to(root))] = hashlib.sha256(data).hexdigest()
    return data.decode()


def field(text, label):
    return re.search(r"\*\*" + re.escape(label) + r":\*\* ([^\n]+)", text)[1].split(" · **")[0].strip()


def rows(folder, pattern="*.md"):
    for path in sorted((design / folder).glob(pattern)):
        text = read(path)
        yield path.stem, text.splitlines()[0][2:], text


def rules(text):
    return re.split(r"(?m)^---\s*$", text.split("## Rules", 1)[-1])[0].strip()


catalog = {}
catalog["ancestries"] = [
    dict(id=slug, name=name, hp=int(re.search(r"HP \+(\d+)", t)[1]),
         speed=int(re.search(r"base Speed (\d+)", t)[1]), coins=int(re.search(r"\+(\d+) coins", t)[1]),
         origin=field(t, "Origin"), overview=t.split("## Appearance", 1)[0], traits=[
             dict(id=f"{slug}-{i}", name=title.rstrip("."), text=body.replace("*", ""),
                  level0DP=int(slug == "human" and title == "Learn on the Job."))
             for i, title, body in re.findall(r"(?m)^([1-5])\. \*\*([^*]+)\*\* (.+)$", t)
         ])
    for slug, name, t in rows("ancestries")
]
for kind in ("culture", "background"):
    catalog[kind + "s"] = []
    for slug, name, t in rows("origins", kind + "-*.md"):
        rank, card = re.search(r"\*\*([A-Za-z]+) 1\*\* and \[[^]]+\]\(\.\./cards/([^)]+)\.md\)", t).groups()
        catalog[kind + "s"].append(dict(id=slug, name=name, rank=rank, card=card,
                                      coins=int(re.search(r"\+(\d+) coins", t)[1]),
                                      intro=t.splitlines()[2].strip("*"), text=t.split("## Rules", 1)[0]))
disciplines = [name for _, name, _ in rows("disciplines")]
catalog["disciplines"] = sorted(disciplines)
catalog["classes"] = []
for slug, name, t in rows("classes"):
    prices = {d: [3, 6, 12] for d in disciplines}
    for band, cost in (("Home", [1, 2, 4]), ("Adjacent", [2, 4, 8]), ("Opposed", [4, 8, 16])):
        match = re.search(band + r": ([^.]+)\.", t)
        if match:
            for d in match[1].split(", "):
                prices[d] = cost
    catalog["classes"].append(dict(
        id=slug, name=name, hp=int(re.search(r"HP contribution \+(\d+)", t)[1]),
        coins=int(re.search(r"\+(\d+) coins", t)[1]),
        minimums=re.split(r", | and ", re.search(r"minimum 0 in ([^;]+);", t)[1]),
        ranks=re.search(r"choose two distinct rank-1 disciplines from ([^.]+)", t)[1].split(", "),
        prices=prices, role=re.search(r"(?m)^\*\*In the crew\.\*\* (.+)$", t)[1],
        signatures=re.findall(r"\]\(\.\./cards/(signature-[^)]+)\.md\)", t)))
catalog["cards"] = [
    dict(id=slug, name=name, level=field(t, "Tier / minimum level"),
         dp=int(field(t, "DP")) if field(t, "DP").isdigit() else 0,
         requirement=field(t, "Requirements to learn"), action=field(t, "Action"),
         gear=field(t, "Equipment / acquisition"), attribute=field(t, "Attribute"), text=rules(t))
    for slug, name, t in rows("cards")
]
catalog["equipment"] = [
    dict(id=slug, name=name, price=int(field(t, "Cost").split()[0]),
         bulk=int(field(t, "Bulk")), hands=int(field(t, "Hands")), text=rules(t))
    for slug, name, t in rows("equipment")
]
t = read(design / "rules/languages.md")
catalog["languages"] = [name for name in re.findall(r"(?m)^\| ([^|]+?) \| ", t)
                        if name not in {"Language", "Galactic Standard", "Named local language"}]
wounds = read(design / "rules/wounds.md")
catalog["wounds"] = {}
for section in re.split(r"(?m)^## ", wounds)[1:]:
    family = section.splitlines()[0]
    if family not in {"Physical", "Elemental", "Mental", "Radiant", "Life/Necrotic"}:
        continue
    catalog["wounds"][family] = {
        code: dict(injury=injury, effects=effects, remedy=remedy, rv=rv)
        for code, injury, effects, remedy, rv in re.findall(
            r"(?m)^\| ([1-6]{3}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$", section)
    }
assert len(catalog["wounds"]) == 5 and all(len(rows) == 56 for rows in catalog["wounds"].values())
conditions = read(design / "rules/conditions.md")
catalog["conditions"] = [
    dict(name=name.removesuffix(" X"), numbered=name.endswith(" X"), effect=effect, removal=removal)
    for name, effect, removal in re.findall(r"(?m)^\| ([A-Z][A-Za-z]+(?: X)?) \| ([^|]+) \| ([^|]+) \|$", conditions)
    if name != "Condition"
]
read(design / "player-book/manuscript/02-creation.md")
(out / "web/data/catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
commit = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
dirty = bool(subprocess.check_output(["git", "-C", str(root), "status", "--porcelain", "--", "design"]))
(out / "content/source-lock.json").write_text(json.dumps({
    "baseCommit": commit, "workingTreeSnapshot": dirty, "inputs": sources
}, indent=2) + "\n")
