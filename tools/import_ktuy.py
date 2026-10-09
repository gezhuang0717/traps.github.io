#!/usr/bin/env python3
"""Normalize the public JAEA KTUY05 snapshot, without reinterpreting alpha2 as beta2.

Raw source/PDF audits stay outside this checkout. Only atomic mass excesses are
exported; absent model uncertainty and beta2 remain absent.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

META = dict(name='KTUY05 (2005)',
    url='https://doi.org/10.1143/PTP.113.305', doi='10.1143/PTP.113.305',
    table_url='https://wwwndc.jaea.go.jp/nucldata/mass/KTUY05_m246.dat',
    explanation_url='https://wwwndc.jaea.go.jp/nucldata/mass/KTUY05explanation.pdf',
    reference_table_url='https://wwwndc.jaea.go.jp/nucldata/mass/KTUY05_m246S12np.pdf',
    ref='H. Koura, T. Tachibana, M. Uno, M. Yamada, Prog. Theor. Phys. 113, 305–325 (2005)')
RAW_SHA256 = 'bf4b22407902c38ffbdbb0b0659857f1aaf3a7407e0ae852c609ac67f1d93901'
HEADER = ['ZZ', 'NN', 'Mcal', 'Esh', 'alpha2', 'alpha4', 'alpha6']

def parse_record(line):
    fields = line.split()
    if len(fields) != 7:
        raise ValueError('KTUY05 requires exactly seven columns')
    z, n = int(fields[0]), int(fields[1])
    values = [float(x) for x in fields[2:]]
    if not (2 <= z <= 130 and 2 <= n <= 200 and all(math.isfinite(v) for v in values)):
        raise ValueError('Invalid KTUY05 identity or numerical value')
    return [z, z+n, values[0], None]

def parse(text):
    lines = text.splitlines()
    if not lines or lines[0].split() != HEADER:
        raise ValueError('Unexpected KTUY05 header; review source columns')
    rows = [parse_record(line) for line in lines[1:] if line.strip()]
    identities = [(z, a-z) for z, a, *_ in rows]
    if len(set(identities)) != len(rows):
        raise ValueError('Duplicate KTUY05 identity')
    if identities != sorted(identities):
        raise ValueError('Unexpected KTUY05 row order')
    if len(rows) != 9436:
        raise ValueError(f'KTUY05 snapshot requires 9436 actual rows, found {len(rows)}')
    if rows[0] != [2, 4, 6.29, None] or rows[-1] != [130, 330, 315.13, None]:
        raise ValueError('KTUY05 boundary rows changed')
    if next(r for r in rows if r[:2] == [50, 116]) != [50, 116, -91.21, None]:
        raise ValueError('KTUY05 116Sn column check failed')
    return rows

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('raw', type=Path)
    p.add_argument('--audit', required=True, type=Path)
    a = p.parse_args()
    data = a.raw.read_bytes()
    if hashlib.sha256(data).hexdigest() != RAW_SHA256:
        raise ValueError('Source snapshot changed; independently audit it before updating the importer')
    rows = parse(data.decode('ascii'))
    dst = Path(__file__).parent/'data/massmodels/ktuy05.txt'
    dst.write_text('# KTUY05: Z A atomic-ME(MeV) beta2; - = unavailable (alpha2 is not beta2)\n'
                   + ''.join(f'{z} {mass} {me:.2f} -\n' for z, mass, me, _ in rows))
    report = {**META, 'raw_sha256': RAW_SHA256,
        'normalized_sha256': hashlib.sha256(dst.read_bytes()).hexdigest(),
        'rows': len(rows), 'first': rows[0], 'last': rows[-1],
        'coverage': {'Z': [2, 130], 'N': [2, 200]},
        'mass_precision_keV': 10, 'beta2_precision': None, 'uncertainty': None,
        'validation': {'method': 'independent JAEA PDF versus text table, all 9436 mass/identity rows exact',
            'Sn_checks': 9303, 'S2n_checks': 9171, 'Sp_checks': 9235, 'S2p_checks': 9038,
            'maximum_difference_MeV': .01200000000008, 'tolerance_MeV': .016},
        'note': 'KTUY05 fitted to AME2003; distinct from KTUY04. Both numerical tables contain 9436 rows; explanatory prose says 9437. Missing neighbours remain missing. Source alpha2/alpha4/alpha6 are not beta2; beta2 unavailable. Model sigma unavailable.',
        'reuse': 'attributed numerical facts from public JAEA table; raw table, explanation and paper not redistributed'}
    payload = json.dumps(report, indent=2, ensure_ascii=False)+'\n'
    (dst.parent/'ktuy05-source.json').write_text(payload)
    a.audit.write_text(payload)
    print(payload)

if __name__ == '__main__':
    main()
