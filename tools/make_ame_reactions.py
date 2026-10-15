#!/usr/bin/env python3
"""Build published AME2020 ground-state energies without diagonal-error substitution.

Run from website/: python3 tools/make_ame_reactions.py
Verify without writing: python3 tools/make_ame_reactions.py --check

Inputs are the original official mass_1.mas20.txt, rct1.mas20.txt and
rct2_1.mas20.txt under tools/data/ame2020. No NucleusPlus assets are used.
Fixed-width headers define different mass/reaction layouts; whitespace splitting
would shift fields when a value is '*'. '#' replaces the decimal point and flags
estimated information. Value and uncertainty flags are preserved separately.

Compact public schema (zg-ame2020-reactions-v1):
  metadata: original filenames, HTTPS URLs, byte SHA-256, paper links, column
            layouts, quantity labels/units/source tables and uncertainty scope.
  quantities: 12 reaction keys plus me, BEA and qbm from the mass table;
              BE is A times published BEA, with explicit source tokens.
  records['Z,N']: {Z,N,A,element,source_lines:{mass,rct1,rct2},values:{key:cell}}
  cell: {value,uncertainty,value_extrapolated,uncertainty_extrapolated,
         raw,raw_uncertainty}; numerical units are metadata.quantity_units[key].
        BE raw tokens are scaled Decimal values, not original table tokens;
        source_raw/source_raw_uncertainty retain its published BEA inputs.
  validation: independent mass-JSON central-value comparison with tolerances
              from original printed precision; evaluated uncertainties remain
              distinct from an independence approximation.

This is an evaluated-reference dataset. It must not replace New/model/loaded
mass stencil recalculation or be advertised as a fresh AME mass adjustment.
"""
from pathlib import Path
import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import json
import math
import os
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_BASE = 'https://www-nds.iaea.org/amdc/ame2020/'
TABLES = {
    'rct1': ('rct1.mas20.txt', ('s2n', 's2p', 'qa', 'q2bm', 'qep', 'qbmn')),
    'rct2': ('rct2_1.mas20.txt', ('sn', 'sp', 'q4bm', 'qda', 'qpa', 'qna')),
}
MASS_FIELDS = {'me': (28, 42, 42, 54), 'BEA': (54, 67, 68, 78), 'qbm': (81, 94, 94, 105)}
LABELS = dict(s2n='S(2n)', s2p='S(2p)', qa='Q(alpha)', q2bm='Q(2beta-)',
              qep='Q(EC p)', qbmn='Q(beta- n)', sn='S(n)', sp='S(p)',
              q4bm='Q(4beta-)', qda='Q(d,alpha)', qpa='Q(p,alpha)',
              qna='Q(n,alpha)', me='Mass excess', BEA='Binding energy / nucleon',
              BE='Total binding energy (A × published BEA)', qbm='Q(beta-)')
NUMBER = re.compile(r'^[+-]?(?:\d+(?:[.#]\d*)?|[.#]\d+)$')
PAPERS = [
    {'title': 'The AME2020 atomic mass evaluation (I). Evaluation of input data, and adjustment procedures',
     'citation': 'W. J. Huang et al., Chinese Physics C 45, 030002 (2021)',
     'url': 'https://doi.org/10.1088/1674-1137/abddb0'},
    {'title': 'The AME2020 atomic mass evaluation (II). Tables, graphs and references',
     'citation': 'M. Wang et al., Chinese Physics C 45, 030003 (2021)',
     'url': 'https://doi.org/10.1088/1674-1137/abddaf'},
]


def number(token, uncertainty=False):
    """Strict AME token conversion; retain zero and fractional estimated values."""
    raw = token.strip()
    if raw in ('', '*'):
        return None
    if not NUMBER.fullmatch(raw):
        raise ValueError('Invalid AME numeric token: ' + repr(raw))
    try:
        result = float(Decimal(raw.replace('#', '.')))
    except (InvalidOperation, ValueError) as error:
        raise ValueError('Invalid AME number: ' + raw) from error
    if not math.isfinite(result) or (uncertainty and result < 0):
        raise ValueError('Nonfinite number or negative uncertainty: ' + raw)
    return result


def cell(value, uncertainty):
    raw, error = value.strip(), uncertainty.strip()
    out = dict(value=number(raw), uncertainty=number(error, uncertainty=True),
               value_extrapolated='#' in raw, uncertainty_extrapolated='#' in error,
               raw=raw, raw_uncertainty=error)
    if out['value'] is None and out['uncertainty'] is not None:
        raise ValueError('Missing value with a numeric uncertainty')
    return out


def binding_energy_cell(bea, mass_number):
    """Scale the published correlated BE/A result, including its uncertainty.

    Keep the original tokens distinct: an A-scaled number is not an additional
    precision claim or an independently evaluated total-binding-energy column.
    """
    def scaled(raw):
        if number(raw) is None:
            return raw
        return str(Decimal(raw.replace('#', '.')) * mass_number)
    out = cell(scaled(bea['raw']), scaled(bea['raw_uncertainty']))
    out.update(value_extrapolated=bea['value_extrapolated'],
               uncertainty_extrapolated=bea['uncertainty_extrapolated'],
               raw_is_derived=True, transformation='A × published BEA',
               source_quantity='BEA', source_raw=bea['raw'],
               source_raw_uncertainty=bea['raw_uncertainty'])
    return out


def row_identity(line, reaction):
    """Read fixed identity columns only; headers/page controls are not nuclides."""
    if reaction:
        if len(line) < 11 or not line[1:4].strip().isdigit() or not line[8:11].strip().isdigit():
            return None
        a, z, element = int(line[1:4]), int(line[8:11]), line[5:8].strip()
        n = a - z
    else:
        if len(line) < 23 or not all(line[a:b].strip().isdigit() for a, b in ((4, 9), (9, 14), (14, 19))):
            return None
        n, z, a, element = int(line[4:9]), int(line[9:14]), int(line[14:19]), line[20:23].strip()
    if a < 1 or n < 0 or z < 0 or a != z + n or not re.fullmatch('[A-Za-z]{1,3}', element):
        raise ValueError('Invalid nuclide identity: ' + repr(line[:27]))
    return z, n, a, element


def parse_reactions(text, table):
    if table not in TABLES:
        raise ValueError('Unknown reaction table')
    keys = TABLES[table][1]
    if 'a1,i3,1x,a3,i3,1x,6(f12.4,f10.4)' not in text:
        raise ValueError('Unexpected AME2020 reaction-table format')
    header = 'Q(2B-)' if table == 'rct1' else 'Q(4B-)'
    if header not in text:
        raise ValueError('Reaction-table quantity header mismatch')
    out = {}
    for lineno, line in enumerate(text.splitlines(), 1):
        identity = row_identity(line, reaction=True)
        if identity is None:
            continue
        z, n, a, element = identity
        values = {}
        for index, key in enumerate(keys):
            start = 12 + 22 * index
            try:
                values[key] = cell(line[start:start + 12], line[start + 12:start + 22])
            except ValueError as error:
                raise ValueError(f'{table} line {lineno}, {key}: {error}') from error
        name = f'{z},{n}'
        if name in out:
            raise ValueError(f'Duplicate {table} identity {name}')
        out[name] = dict(Z=z, N=n, A=a, element=element, source_lines={table: lineno}, values=values)
    if not out:
        raise ValueError('No reaction rows found')
    return out


def parse_mass(text):
    if 'f14.6,f12.6,f13.5' not in text or 'BINDING ENERGY/A' not in text:
        raise ValueError('Unexpected AME2020 mass-table format')
    out = {}
    for lineno, line in enumerate(text.splitlines(), 1):
        identity = row_identity(line, reaction=False)
        if identity is None:
            continue
        z, n, a, element = identity
        values = {}
        for key, (v0, v1, e0, e1) in MASS_FIELDS.items():
            values[key] = cell(line[v0:v1], line[e0:e1])
        values['BE'] = binding_energy_cell(values['BEA'], a)
        name = f'{z},{n}'
        if name in out:
            raise ValueError('Duplicate ground-state mass identity ' + name)
        out[name] = dict(Z=z, N=n, A=a, element=element, source_lines={'mass': lineno}, values=values)
    if not out:
        raise ValueError('No mass rows found')
    return out


def precision_half_width(raw):
    """Half a final printed digit, independently of the uncertainty column."""
    token = raw.strip().replace('#', '.')
    if not NUMBER.fullmatch(raw.strip()):
        raise ValueError('No precision for nonnumeric token')
    places = len(token.partition('.')[2])
    return .5 * 10.0**(-places)


def comparison(records, ame_json):
    """Recompute central values from the independent browser ME catalogue.

    No evaluated sigma is replaced/validated by diagonal propagation. Source
    printed ME precision bounds the mean comparison, including estimated data.
    """
    masses, precision = {}, {}
    for row in ame_json['rows']:
        z, a, element, me = row[:4]
        key = f'{z},{a-z}'
        if key in masses:
            raise ValueError('Duplicate AME mass JSON identity ' + key)
        if not isinstance(me, (int, float)) or not math.isfinite(me):
            raise ValueError('Nonfinite mass JSON value')
        if key not in records:
            raise ValueError('Mass JSON identity absent from official tables: ' + key)
        original = records[key]['values']['me']
        if me != original['value']:
            raise ValueError('Mass JSON/raw-table central value mismatch: ' + key)
        if records[key]['element'] != element:
            raise ValueError('Mass JSON element mismatch: ' + key)
        masses[(z, a-z)] = me
        precision[(z, a-z)] = precision_half_width(original['raw'])
    if len(masses) != len(records):
        raise ValueError('AME JSON does not cover every published ground-state identity')
    neutron, hydrogen, deuterium, alpha = (0, 1), (1, 0), (1, 1), (2, 2)

    def terms(key, z, n):
        origin = (z, n)
        if key == 'me': return [(1, origin)]
        if key == 'BE': return [(z, hydrogen), (n, neutron), (-1, origin)]
        if key == 'BEA': return [(z/(z+n), hydrogen), (n/(z+n), neutron), (-1/(z+n), origin)]
        if key == 'qbm': return [(1, origin), (-1, (z+1, n-1))]
        if key == 'sn': return [(1, (z,n-1)), (1, neutron), (-1, origin)]
        if key == 's2n': return [(1, (z,n-2)), (2, neutron), (-1, origin)]
        if key == 'sp': return [(1, (z-1,n)), (1, hydrogen), (-1, origin)]
        if key == 's2p': return [(1, (z-2,n)), (2, hydrogen), (-1, origin)]
        if key == 'qa': return [(1, origin), (-1, (z-2,n-2)), (-1, alpha)]
        if key == 'q2bm': return [(1, origin), (-1, (z+2,n-2))]
        if key == 'q4bm': return [(1, origin), (-1, (z+4,n-4))]
        if key == 'qep': return [(1, origin), (-1, (z-2,n+1)), (-1, hydrogen)]
        if key == 'qbmn': return [(1, origin), (-1, (z+1,n-2)), (-1, neutron)]
        if key == 'qda': return [(1, origin), (1, deuterium), (-1, (z-1,n-1)), (-1, alpha)]
        if key == 'qpa': return [(1, origin), (1, hydrogen), (-1, (z-1,n-2)), (-1, alpha)]
        if key == 'qna': return [(1, origin), (1, neutron), (-1, (z-2,n-1)), (-1, alpha)]
        raise ValueError('Unknown quantity ' + key)

    summary = {key: dict(checked=0, missing_published=0, missing_mass_neighbour=0,
                        max_absolute_difference=0., max_precision_ratio=0.) for key in LABELS}
    failures = []
    for record in records.values():
        z, n = record['Z'], record['N']
        for key, published in record['values'].items():
            result = summary[key]
            if published['value'] is None:
                result['missing_published'] += 1
                continue
            # Combine repeated identities before checking dependencies/rounding.
            weights = {}
            for weight, identity in terms(key, z, n):
                weights[identity] = weights.get(identity, 0.) + weight
            weights = {identity: weight for identity, weight in weights.items() if weight != 0}
            if any(identity not in masses for identity in weights):
                result['missing_mass_neighbour'] += 1
                continue
            value = math.fsum(weight*masses[identity] for identity, weight in weights.items())
            tolerance = math.fsum(abs(weight)*precision[identity] for identity, weight in weights.items())
            # BE has the precision of A times its printed BEA source, rather
            # than the last digit of a synthetically scaled decimal string.
            published_precision = (record['A'] * precision_half_width(published['source_raw'])
                                   if key == 'BE' else precision_half_width(published['raw']))
            tolerance += published_precision + 1e-8
            difference = abs(value - published['value'])
            result['checked'] += 1
            result['max_absolute_difference'] = max(result['max_absolute_difference'], difference)
            result['max_precision_ratio'] = max(result['max_precision_ratio'], difference/tolerance)
            if difference > tolerance:
                failures.append(dict(identity=f'{z},{n}', quantity=key, from_mass_json=value,
                                     published=published['value'], difference=difference, tolerance=tolerance))
    return dict(status='PASS' if not failures else 'FAIL', quantities=summary,
                central_value_tolerance='Sum of half-last-printed-digits from each surviving mass coefficient and published value, plus 1e-8 numerical slack; no uncertainty-derived tolerance',
                uncertainty_comparison='Not compared to independent mass propagation: published evaluated uncertainties retain AME correlations; New/model propagation is a different calculation.',
                failures=failures)


def build(source_dir, ame_json_file):
    sources, parsed = [], {}
    for table, filename in [('mass', 'mass_1.mas20.txt'), *[(key, value[0]) for key, value in TABLES.items()]]:
        raw = (source_dir / filename).read_bytes()
        text = raw.decode('ascii')
        parsed[table] = parse_mass(text) if table == 'mass' else parse_reactions(text, table)
        sources.append(dict(table=table, filename=filename, url=SOURCE_BASE+filename,
                            sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw),
                            format='AME2020 fixed columns; mass: a1,i3,i5,i5,i5,1x,a3,a4,1x,f14.6,f12.6,f13.5,1x,f10.5,1x,a2,f13.5,f11.5' if table == 'mass' else 'a1,i3,1x,a3,i3,1x,6(f12.4,f10.4)'))
    records = parsed['mass']
    for table in TABLES:
        if records.keys() != parsed[table].keys():
            raise ValueError('Mass and reaction tables have different ground-state coverage')
        for key, incoming in parsed[table].items():
            target = records[key]
            if any(target[field] != incoming[field] for field in ('Z','N','A','element')):
                raise ValueError('Identity disagreement between official tables: ' + key)
            target['values'].update(incoming['values'])
            target['source_lines'].update(incoming['source_lines'])
    ame_raw = ame_json_file.read_bytes()
    validation = comparison(records, json.loads(ame_raw))
    if validation['status'] != 'PASS':
        raise ValueError('Independent mass-catalogue comparison failed: ' + json.dumps(validation['failures'][:12]))
    quantities = [*TABLES['rct1'][1], *TABLES['rct2'][1], *MASS_FIELDS, 'BE']
    return dict(schema='zg-ame2020-reactions-v1', unit='keV',
        metadata=dict(name='AME2020 published ground-state energies', version='AME2020, 3 March 2021 unrounded tables',
            units='keV except BEA (keV/nucleon)', sources=sources, papers=PAPERS,
            quantity_labels=LABELS, quantity_units={key: 'keV/nucleon' if key == 'BEA' else 'keV' for key in quantities},
            quantity_sources={**{key: table for table, (_, keys) in TABLES.items() for key in keys}, **{key: 'mass' for key in MASS_FIELDS}, 'BE': 'mass'},
            quantity_transformations={'BE': 'A × published BEA; uncertainty A × published BEA uncertainty; original BEA tokens retained; no independent nucleon-mass recombination'},
            value_columns='Reaction identity: A[1:4], element[5:8], Z[8:11]; values begin[12], six22-column blocks of value12+uncertainty10; zero-based Python slices',
            mass_value_columns={key: list(value) for key, value in MASS_FIELDS.items()},
            uncertainty_scope='Published evaluated one-standard-deviation uncertainties, including AME mass correlations; not independent-error propagation and not a new mass adjustment.',
            flags='Value and uncertainty # flags are separate; # replaces decimal point; * is unavailable, never zero.',
            comparison_mass_catalogue_sha256=hashlib.sha256(ame_raw).hexdigest()),
        quantities=quantities, records=records, validation=validation)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT/'tools/data/ame2020')
    parser.add_argument('--ame-json', type=Path, default=ROOT/'static/data/ame2020.json')
    parser.add_argument('--output', type=Path, default=ROOT/'static/data/ame2020-reactions.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build(args.source_dir, args.ame_json)
    encoded = json.dumps(result, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
    if args.check:
        if args.output.read_bytes() != encoded:
            raise SystemExit('Generated reaction reference differs; regenerate with reviewed sources')
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        fd, name = tempfile.mkstemp(prefix='.'+args.output.name+'-', dir=args.output.parent)
        try:
            with os.fdopen(fd, 'wb') as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(name, args.output)
        finally:
            if os.path.exists(name):
                os.unlink(name)
    print(json.dumps(dict(status='PASS', records=len(result['records']), quantities=len(result['quantities']),
                          comparisons=sum(item['checked'] for item in result['validation']['quantities'].values()),
                          bytes=len(encoded), check_only=args.check), separators=(',', ':')))


if __name__ == '__main__':
    main()
