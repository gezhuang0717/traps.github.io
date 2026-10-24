"""Every number the reference-isotope card prints equals the original AME2020 text tables, digit for digit (value, uncertainty, '#' flag)."""
import json
import re
import subprocess
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'tools/data/ame2020'
LABEL = ['Atomic mass / u', 'Mass excess / keV', 'Total binding energy / keV', 'Binding energy per nucleon / keV', 'S(n) / keV', 'S(2n) / keV', 'S(p) / keV', 'S(2p) / keV', 'Q(β⁻) / keV', 'Q(EC) / keV', 'Q(α) / keV', 'Q(2β⁻) / keV']
# fixed-width layouts of the original files (see the headers of the files and tools/make_ame_reactions.py)
RCT1 = {'s2n': 0, 's2p': 1, 'qa': 2, 'q2bm': 3}
RCT2 = {'sn': 0, 'sp': 1}


def block(line, k):
    start = 12 + 22 * k
    return line[start:start + 12].strip(), line[start + 12:start + 22].strip()


def shown(value, unc):
    """What the page must print for a published token pair; '#' replaces the decimal point of an extrapolated value."""
    if value == '*':
        return '—'
    est = '#' in value
    clean = lambda t: t.replace('#', '.').rstrip('.')
    return clean(value) + ' ± ' + clean(unc) + (' #' if est else '')


def read_rct(name, keys):
    table = {}
    for line in (RAW / name).read_text(encoding='utf8').split('\n'):
        if len(line) < 34 or not line[1:4].strip().isdigit() or not line[8:11].strip().isdigit() or not line[5:8].strip().isalpha():
            continue
        a, z = int(line[1:4]), int(line[8:11])
        table[(z, a - z)] = {key: block(line, k) for key, k in keys.items()}
    return table


def read_mass():
    table = {}
    for line in (RAW / 'mass_1.mas20.txt').read_text(encoding='utf8').split('\n'):
        if len(line) < 110 or not re.match(r'^[0-9 -]{1,4}', line[:4]) or not line[4:9].strip().lstrip('-').isdigit() or not line[14:19].strip().isdigit():
            continue
        n, z = int(line[4:9]), int(line[9:14])
        m = re.search(r'(\d+)\s+([0-9#.]+)\s+([0-9#.]+)\s*$', line[105:])
        if not m:
            continue
        macro, micro, unc = m.groups()
        micro_clean = micro.replace('#', '.')
        decimals = len(micro_clean.split('.')[1]) if '.' in micro_clean else 0
        value = (Decimal(int(macro)) * 1_000_000 + Decimal(micro_clean)) / 1_000_000
        table[(z, n)] = dict(me=(line[28:42].strip(), line[42:54].strip()), bea=(line[54:67].strip(), line[68:78].strip()), qbm=(line[81:94].strip(), line[94:105].strip()),
                             a=z + n, amu=(f'{value:.{decimals + 6}f}' + ('#' if '#' in micro else ''), f'{Decimal(unc.replace("#", ".")) / 1_000_000:.{decimals + 6}f}'))
    return table


def neg(token):
    return token[1:] if token.startswith('-') else ('-' + token)


def test_card_prints_the_published_tokens():
    node = subprocess.run(['node', str(ROOT / 'tests/ame_display_dump.cjs')], capture_output=True, text=True, check=True)
    printed = {(r['Z'], r['N']): dict(r['rows']) for r in json.loads(node.stdout)}
    mass, r1, r2 = read_mass(), read_rct('rct1.mas20.txt', RCT1), read_rct('rct2_1.mas20.txt', RCT2)
    assert len(printed) == 3557 and len(mass) >= 3557
    checked = 0
    for key, text in printed.items():
        z, n = key
        m, a, b = mass[key], r1.get(key, {}), r2.get(key, {})
        want = {
            'Atomic mass / u': shown(*m['amu']) if '#' not in m['amu'][0] else shown(m['amu'][0], m['amu'][1] + ('#')),
            'Mass excess / keV': shown(*m['me']), 'Binding energy per nucleon / keV': shown(*m['bea']), 'Q(β⁻) / keV': shown(*m['qbm']),
            'S(n) / keV': shown(*b['sn']) if b else '—', 'S(p) / keV': shown(*b['sp']) if b else '—',
            'S(2n) / keV': shown(*a['s2n']) if a else '—', 'S(2p) / keV': shown(*a['s2p']) if a else '—', 'Q(α) / keV': shown(*a['qa']) if a else '—', 'Q(2β⁻) / keV': shown(*a['q2bm']) if a else '—',
        }
        below = mass.get((z - 1, n + 1))
        if below and below['qbm'][0] != '*':
            v, u = below['qbm']
            is_zero = not v.replace('-', '').replace('#', '.').replace('.', '').strip('0')
            want['Q(EC) / keV'] = shown(v.lstrip('-') if is_zero else neg(v), u)      # Q(EC) = -Q(beta-) of the isobar below; a zero stays an unsigned zero
        else:
            want['Q(EC) / keV'] = '—'
        bea_v, bea_u = m['bea']
        if bea_v == '*':
            want['Total binding energy / keV'] = '—'
        else:
            dec = len(re.split(r'[.#]', bea_v, maxsplit=1)[1]) if re.search(r'[.#]', bea_v) else 0
            total = Decimal(m['a']) * Decimal(bea_v.replace('#', '.'))
            err = Decimal(m['a']) * Decimal(bea_u.replace('#', '.'))
            want['Total binding energy / keV'] = f'{total:.{dec}f} ± {err:.{dec}f}' + (' #' if '#' in bea_v else '')
        for label in LABEL:
            got = text[label]
            assert got == want[label], (z, n, label, got, want[label])
            checked += 1
    assert checked == 3557 * 12


def test_ca40_example_from_the_owner_report():
    node = subprocess.run(['node', str(ROOT / 'tests/ame_display_dump.cjs')], capture_output=True, text=True, check=True)
    ca40 = dict(next(r for r in json.loads(node.stdout) if (r['Z'], r['N']) == (20, 20))['rows'])
    assert ca40['Q(2β⁻) / keV'] == '-25852.9632 ± 68.2437'      # the published uncertainty (the daughter 40Ti is poorly known), printed in full
    assert ca40['S(n) / keV'] == '15635.0134 ± 0.5965'
    assert ca40['Atomic mass / u'] == '39.962590850 ± 0.000000022'  # published atomic mass 39 962590.850 ± 0.022 micro-u, not recomputed from the mass excess
