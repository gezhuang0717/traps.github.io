#!/usr/bin/env python3
"""Normalize public ULB tables. Raw downloads and audit reports stay private.

Only Z,A,Mcal(MeV),beta2 are retained. Err / Mexp-Mcal is NOT an uncertainty.
HFB14 has blank columns: parse fixed positions, never split-and-shift.
"""
import argparse, hashlib, json, math
from pathlib import Path

META={
 'hfb14':dict(name='HFB-14 (BSk14)',url='https://www.astro.ulb.ac.be/pmwiki/Brusslib/Hfb14',table_url='https://www.astro.ulb.ac.be/Nucdata/Masses/hfb14-plain',ref='S. Goriely et al., Phys. Rev. C 75, 064312 (2007)',doi='10.1103/PhysRevC.75.064312'),
 'hfb24':dict(name='HFB-24 (BSk24)',url='https://doi.org/10.1103/PhysRevC.88.024308',table_url='https://www.astro.ulb.ac.be/bruslib/nucdata/hfb24-dat',ref='S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)',doi='10.1103/PhysRevC.88.024308'),
 'bskg3':dict(name='BSkG3 (2023)',url='https://www.astro.ulb.ac.be/pmwiki/Brusslib/BSkG3',table_url='https://www.astro.ulb.ac.be/bruslib/nucdata/bskg03-dat',ref='G. Grams et al., Eur. Phys. J. A 59, 270 (2023)',doi='10.1140/epja/s10050-023-01158-6'),
 'hfb21':dict(name='HFB-21 (BSk21)',url='https://doi.org/10.1103/PhysRevC.82.035804',table_url='https://www.astro.ulb.ac.be/bruslib/nucdata/hfb21-dat',ref='S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 82, 035804 (2010)',doi='10.1103/PhysRevC.82.035804'),
 'hfb25':dict(name='HFB-25 (BSk25)',url='https://doi.org/10.1103/PhysRevC.88.024308',table_url='https://www.astro.ulb.ac.be/bruslib/nucdata/hfb25-dat',ref='S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)',doi='10.1103/PhysRevC.88.024308'),
 'hfb26':dict(name='HFB-26 (BSk26)',url='https://doi.org/10.1103/PhysRevC.88.024308',table_url='https://www.astro.ulb.ac.be/bruslib/nucdata/hfb26-dat',ref='S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)',doi='10.1103/PhysRevC.88.024308'),
 'hfb27':dict(name='HFB-27 (BSk27)',url='https://doi.org/10.1103/PhysRevC.88.061302',table_url='https://www.astro.ulb.ac.be/bruslib/nucdata/hfb27-dat',ref='S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 061302(R) (2013)',doi='10.1103/PhysRevC.88.061302'),
}

def parse(text,key):
    rows=[];reported={}
    for line in text.splitlines():
        if not line.strip() or not line.lstrip()[0].isdigit():continue
        fields=line.split();z,a=int(fields[0]),int(fields[1]);b=float(fields[2])
        if key=='hfb14':me=float(line[59:68]);sn=line[32:41].strip()
        else:me=float(fields[9]);sn=fields[6]
        if not (0<z<=120 and a>=z and all(math.isfinite(v) for v in (me,b))):raise ValueError(line)
        rows.append([z,a,me,b]);reported[(z,a)]=float(sn) if sn else None
    if len({(z,a) for z,a,*_ in rows})!=len(rows):raise ValueError('Duplicate Z,A')
    if key=='hfb14':assert rows[0]==[8,16,-4.01,0.0] and rows[-1]==[110,360,555.01,0.43]
    elif key=='hfb24':assert rows[0]==[8,16,-2.75,0.0] and rows[-1]==[110,360,563.45,0.09]
    elif key=='bskg3':assert rows[0]==[8,16,-4.51,0.23] and rows[-1]==[118,379,603.70,0.02]
    else:
        expected={'hfb21':(8387,[8,16,-2.62,0.0],[110,360,562.38,0.07]),'hfb25':(9484,[8,16,-2.79,0.0],[120,410,808.82,0.26]),'hfb26':(9511,[8,16,-2.54,0.0],[120,410,811.73,0.26]),'hfb27':(8386,[8,16,-4.40,0.0],[110,360,574.80,0.09])}
        count,first,last=expected[key];assert len(rows)==count and rows[0]==first and rows[-1]==last
    m={(z,a):me for z,a,me,_ in rows};diff=[]
    for (z,a),sn in reported.items():
        if sn is not None and abs(sn)<900 and (z,a-1) in m:
            diff.append(abs(m[(z,a-1)]+8.0713181-m[(z,a)]-sn))
    assert len(diff)>7000 and max(diff)<0.016, (len(diff),max(diff))
    return rows,dict(neutron_separation_checks=len(diff),maximum_difference_MeV=max(diff),tolerance_MeV=0.016)

def main():
    p=argparse.ArgumentParser();p.add_argument('key',choices=META);p.add_argument('raw',type=Path);p.add_argument('--audit',required=True,type=Path);a=p.parse_args()
    rows,check=parse(a.raw.read_text(),a.key);dst=Path(__file__).parent/'data/massmodels'/f'{a.key}.txt'
    text='# Public ULB numerical table: Z A Mcal(MeV) beta2; source precision retained\n'+''.join(f'{z} {mass} {me:.2f} {b:.2f}\n' for z,mass,me,b in rows)
    dst.write_text(text)
    report={**META[a.key], 'raw_sha256':hashlib.sha256(a.raw.read_bytes()).hexdigest(),'normalized_sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'rows':len(rows),'first':rows[0],'last':rows[-1],
      'mass_precision_keV':10,'beta2_precision':0.01,'uncertainty':None,'validation':check,
      'reuse':'attributed numerical facts from public author-hosted table; raw table and webpage not redistributed',
      'note':'Mcal is atomic mass excess, not full atomic mass. Err/Mexp-Mcal is an experimental residual, never model sigma. BSkG3 web page count/range is older than this hashed table; actual parsed coverage retained.'}
    (dst.parent/f'{a.key}-source.json').write_text(json.dumps(report,indent=2)+'\n');a.audit.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
