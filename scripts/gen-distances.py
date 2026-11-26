#!/usr/bin/env python3
# Regenerates lib/distances.ts from the UEX Corp API (orbit-to-orbit distances in Gm).
# Usage: python3 scripts/gen-distances.py   (from the repo root)
import json, itertools, statistics, urllib.request, copy
# app location name -> (system, [UEX orbit ids, first preferred])
MAP = {
 "Everus Harbor": ("Stanton",[116]), "Port Tressler": ("Stanton",[190]), "Seraphim Station": ("Stanton",[59]),
 "Baijini Point": ("Stanton",[4]), "Port Olisar": ("Stanton",[59]), "Grim HEX": ("Stanton",[59]),
 "Lorville": ("Stanton",[116]), "Area18": ("Stanton",[4]), "New Babbage": ("Stanton",[190]), "Orison": ("Stanton",[59]),
 "ARC-L1 Wide Forest": ("Stanton",[326]), "ARC-L2 Lively Pathway": ("Stanton",[327]), "ARC-L3 Modern Express": ("Stanton",[328]),
 "ARC-L4 Faint Glen": ("Stanton",[329]), "ARC-L5 Yellow Core": ("Stanton",[330]),
 "CRU-L1 Ambitious Dream": ("Stanton",[331]), "CRU-L4 Shallow Fields": ("Stanton",[332]), "CRU-L5 Beautiful Glen": ("Stanton",[333]),
 "HUR-L1 Green Glade": ("Stanton",[334]), "HUR-L2 Faithful Dream": ("Stanton",[335]), "HUR-L3 Thundering Express": ("Stanton",[336]),
 "HUR-L4 Melodic Fields": ("Stanton",[337]), "HUR-L5 High Course": ("Stanton",[338]),
 "MIC-L1 Shallow Frontier": ("Stanton",[339]), "MIC-L2 Long Forest": ("Stanton",[340]), "MIC-L3 Endless Odyssey": ("Stanton",[341]),
 "MIC-L4 Red Crossroads": ("Stanton",[342]), "MIC-L5 Modern Icarus": ("Stanton",[343]),
 "Pyro Gateway": ("Stanton",[360]), "Nyx Gateway": ("Stanton",[394]), "Terra Gateway": ("Stanton",[361]), "Magnus Gateway": ("Stanton",[359]),
 "Security Post Kareah": ("Stanton",[59]),
 "Stanton Gateway (Pyro)": ("Pyro",[398,386]), "Nyx Gateway (Pyro)": ("Pyro",[395]), "Ruin Station": ("Pyro",[245]),
 "Checkmate": ("Pyro",[392,365]), "Orbituary": ("Pyro",[242]), "Gaslight": ("Pyro",[388,350]),
 "Starlight Service Station": ("Pyro",[393,344]), "Dudley & Daughters": ("Pyro",[391,356]), "Patch City": ("Pyro",[387,346]),
 "Megumi Refueling": ("Pyro",[374,357]), "Endgame": ("Pyro",[355]), "Rod's Fuel 'N Supplies": ("Pyro",[389,352]),
 "Rat's Nest": ("Pyro",[390,353]),
 "Levski": ("Nyx",[325]), "Stanton Gateway (Nyx)": ("Nyx",[397]), "Pyro Gateway (Nyx)": ("Nyx",[396]),
}
SYS = {"Stanton":68,"Pyro":64,"Nyx":55}
out = {}
report=[]
for sysname, sid in SYS.items():
    req = urllib.request.Request(f"https://api.uexcorp.space/2.0/orbits_distances?id_star_system={sid}", headers={"User-Agent": "sc-hauler-planner"})
    d = json.load(urllib.request.urlopen(req))["data"]
    M = {}
    for r in d:
        if r["star_system_origin_name"]==sysname and r["star_system_destination_name"]==sysname:
            M.setdefault((r["id_orbit_origin"],r["id_orbit_destination"]),[]).append(float(r["distance"]))
    names = [n for n,(s,_) in MAP.items() if s==sysname]
    def look(a,b):
        if MAP[a][1][0]==MAP[b][1][0]: return 0.0
        vals=[]
        for x in MAP[a][1]:
            for y in MAP[b][1]:
                for k in ((x,y),(y,x)):
                    if k in M: vals += M[k]
            if vals: break
        return statistics.median(vals) if vals else None
    mat = {}
    for a,b in itertools.combinations(names,2):
        v = look(a,b)
        if v is None: report.append(f"MISSING {sysname}: {a} - {b}")
        mat[f"{a}|{b}"]=v
    out[sysname]={"names":names,"mat":mat}
print("\n".join(report) or "all pairs present")
o = out

# ---- write lib/distances.ts
lines=[]
lines.append('// Distances in Gm (million km) between the places the planner knows, per star system.')
lines.append('// Source: UEX Corp API /2.0/orbits_distances (community-measured, game versions 4.0-4.10,')
lines.append('// fetched 2026-11-26). Stations sit at their orbit\'s entry: Everus Harbor/Lorville = Hurston,')
lines.append('// Port Tressler/New Babbage = microTech, Seraphim/Orison/Grim HEX/Kareah = Crusader,')
lines.append('// Baijini/Area18 = ArcCorp, Levski = Delamar. A pair UEX has no figure for is filled with the')
lines.append('// shortest path through another known place. Regenerate: python3 scripts/gen-distances.py')
lines.append('')
lines.append('export type DistanceTable = { names: string[]; gm: number[] }; // gm: upper triangle, row by row')
lines.append('')
lines.append('export const DISTANCES_GM: Record<string, DistanceTable> = {')
for sysname,v in o.items():
    names=v['names']; n=len(names)
    D=[[0.0]*n for _ in range(n)]
    for i,j in itertools.combinations(range(n),2):
        x=v['mat'].get(f'{names[i]}|{names[j]}')
        D[i][j]=D[j][i]=x if x is not None else float('inf')
    # fill missing via shortest path (Floyd-Warshall only for inf entries)
    F=copy.deepcopy(D)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if F[i][k]+F[k][j]<F[i][j]: F[i][j]=F[i][k]+F[k][j]
    for i in range(n):
        for j in range(n):
            if D[i][j]==float('inf'): D[i][j]=F[i][j]
    tri=[]
    for i in range(n):
        for j in range(i+1,n): tri.append(int(round(D[i][j])))
    lines.append(f'  {sysname}: {{')
    lines.append('    names: [' + ', '.join(json.dumps(x) for x in names) + '],')
    rows=[]
    for k in range(0,len(tri),24): rows.append('      '+', '.join(str(x) for x in tri[k:k+24])+',')
    lines.append('    gm: [\n'+'\n'.join(rows)+'\n    ],')
    lines.append('  },')
lines.append('};')
open('lib/distances.ts','w').write('\n'.join(lines)+'\n')
