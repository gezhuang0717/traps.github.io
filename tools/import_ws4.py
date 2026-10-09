#!/usr/bin/env python3
"""Normalize WS4 and WS4+RBF numerical facts, without redistributing raw sources.

Input: the author-labelled 2014-June-3 table, columns A Z WS4 WS4+RBF, MeV.
The two columns are distinct variants. Neither deformation nor model sigma is
provided. Private source paths and R code must not enter output metadata.
"""
import argparse, hashlib, json, math
from pathlib import Path

PAPER='10.1016/j.physletb.2014.05.049'
META={
 'ws4':dict(name='WS4 (2014)',ref='N. Wang, M. Liu, X. Wu, J. Meng, Phys. Lett. B 734, 215–219 (2014)',url='https://doi.org/'+PAPER),
 'ws4rbf':dict(name='WS4+RBF (2014)',ref='WS4: N. Wang et al., Phys. Lett. B 734, 215–219 (2014); RBF method: N. Wang, M. Liu, Phys. Rev. C 84, 051303(R) (2011)',url='https://doi.org/'+PAPER),
}
SNAPSHOT='1dab8913daf314c05978fa644d524a4624e5c7abb04aa37ffb3b656046ceded6'

def parse_record(line):
    f=line.split()
    if len(f)!=4:raise ValueError('Expected A Z WS4 WS4+RBF')
    a,z=int(f[0]),int(f[1]); ws4,rbf=map(float,f[2:])
    if not (0<z<=132 and z<=a<=350 and all(math.isfinite(x) for x in (ws4,rbf))):
        raise ValueError('Invalid WS4 identity or mass')
    return z,a,ws4,rbf

def parse(text):
    lines=text.splitlines()
    if len(lines)<16 or lines[13].split()!=['A','Z','WS4','WS4+RBF'] or '2014-June-3' not in lines[:15]:
        raise ValueError('Unrecognized WS4 table header/date')
    rows=[parse_record(s) for s in lines[15:] if s.strip()]
    if len({r[:2] for r in rows})!=len(rows):raise ValueError('Duplicate Z,A')
    if len(rows)!=10237 or rows[0]!=(8,16,-4.3661,-4.3108) or rows[-1]!=(132,350,367.4774,367.1552):
        raise ValueError('Expected complete 10237-row WS4 snapshot')
    return rows

def main():
    p=argparse.ArgumentParser();p.add_argument('raw',type=Path);p.add_argument('--audit',required=True,type=Path);a=p.parse_args()
    raw=a.raw.read_bytes();h=hashlib.sha256(raw).hexdigest()
    if h!=SNAPSHOT:raise ValueError('Unreviewed WS4 snapshot: verify source version before importing')
    rows=parse(raw.decode('cp1252'));out=Path(__file__).parent/'data/massmodels';reports={}
    for key,col in [('ws4',2),('ws4rbf',3)]:
        data='# WS4 author table 2014-June-3: Z A atomic ME(MeV) beta2; - = unavailable\n'+''.join(f'{r[0]} {r[1]} {r[col]:.4f} -\n' for r in rows)
        dst=out/f'{key}.txt';dst.write_text(data)
        report={**META[key],'doi':PAPER,'table_url':'http://www.imqmd.com/mass/','table_date':'2014-June-3',
          'column':'WS4' if key=='ws4' else 'WS4+RBF','raw_sha256':h,'normalized_sha256':hashlib.sha256(data.encode()).hexdigest(),
          'rows':len(rows),'mass_precision_keV':0.1,'beta2_precision':None,'uncertainty':None,
          'related_papers':[{'name':'WS4','doi':PAPER},{'name':'RBF method','doi':'10.1103/PhysRevC.84.051303'}],
          'reuse':'attributed numerical mass predictions only; raw table and proprietary R package not redistributed',
          'note':'Author-labelled 2014 table supplied for verification. Live author-host download unavailable at review; papers verified. WS4 and WS4+RBF are related variants, not independent error estimates. No RBF re-fit to AME2020 or new input masses.'}
        (out/f'{key}-source.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');reports[key]=report
    a.audit.write_text(json.dumps(reports,indent=2,ensure_ascii=False)+'\n');print('WS4 and WS4+RBF: 10237 distinct identities each; columns retained separately.')
if __name__=='__main__':main()
