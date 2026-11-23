#!/usr/bin/env python3
"""Rebuild deterministic RFQ teaching CSVs and independent sample statistics.

Only Python's standard library is used. These are synthetic examples, not
measurements or simulated RFQ transmission. Statistics are calculated from
the rounded CSV values that the browser actually imports.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path

GENERATOR = "tools/generate_rfq_examples.py"
VERSION = 1
COUNT = 256
FWHM = 2 * math.sqrt(2 * math.log(2))


class Random:
    """Explicit 32-bit LCG and Box–Muller normal generator; no hidden state."""

    def __init__(self, seed: int):
        self.state = seed

    def uniform(self) -> float:
        self.state = (1664525 * self.state + 1013904223) & 0xFFFFFFFF
        return (self.state + 0.5) / 4294967296

    def normal(self) -> float:
        return math.sqrt(-2 * math.log(self.uniform())) * math.cos(2 * math.pi * self.uniform())


CASES = [
    ("narrow", 1101, "Narrow bunch", "窄时间束团",
     "Small independent time and energy spreads. No position columns are supplied.",
     "时间与能量展宽较小且独立；此文件不提供位置列。", "independent", "t=1000+2N; E=10+0.12N"),
    ("broad", 1102, "Broad bunch", "宽时间束团",
     "Larger independent spreads for comparison with the narrow example.",
     "较大的独立展宽，可与窄束团示例比较。", "independent", "t=1000+25N; E=10+1.2N"),
    ("positive", 1103, "Positive time–energy correlation", "正时间–能量相关",
     "Later events have higher energy; construction correlation +0.9, finite-sample value shown below.",
     "较晚事件的能量较高；构造相关系数为 +0.9，下方给出有限样本值。", "correlation-positive", "t=1000+15z; E=10+0.8*(0.9z+sqrt(0.19)w)"),
    ("negative", 1104, "Negative time–energy correlation", "负时间–能量相关",
     "Later events have lower energy; construction correlation −0.9, finite-sample value shown below.",
     "较晚事件的能量较低；构造相关系数为 −0.9，下方给出有限样本值。", "correlation-negative", "t=1000+15z; E=10+0.8*(-0.9z+sqrt(0.19)w)"),
    ("tail", 1105, "Late-time tail", "晚到时间拖尾",
     "Gaussian timing jitter plus a positive exponential delay. Gaussian-equivalent width is not a fitted tail width.",
     "高斯时间抖动叠加正指数延迟；高斯等效宽度并非拖尾的拟合宽度。", "skew-tail", "delay=-15*ln(U); t=1000+2N+delay; E=10+0.015*delay+0.2N"),
    ("double", 1106, "Two time peaks", "双时间峰",
     "Equal populations separated in time. One mean and standard deviation do not identify two peaks.",
     "两个等权组分在时间上分离；单一均值和标准差无法识别双峰。", "double-peak", "alternating groups g=±1; t=1000+12g+2N; E=10+0.3g+0.15N"),
    ("drift", 1107, "Drift with event order", "随事件顺序漂移",
     "Time and energy means drift across the recorded event order; inspect the event-index plots.",
     "时间和能量均值随记录顺序漂移；请查看事件序号图。", "drift", "u=i/(n-1)-0.5; t=1000+20u+2N; E=10+u+0.1N"),
    ("outliers", 1108, "Sparse outliers", "稀疏离群点",
     "A narrow core with eight deliberate extreme events. Compare histogram and event-index views.",
     "窄核心中加入八个刻意设置的极端事件；可比较直方图与事件序号图。", "outliers", "narrow core; every32nd event has alternating dt=±60 and dE=±4"),
    ("round-spot", 1109, "Centered round spot", "居中圆形束斑",
     "Centered isotropic transverse coordinates. Radial RMS is measured about the coordinate origin.",
     "居中的各向同性横向坐标；径向均方根相对于坐标原点计算。", "round-spot", "t=1000+6N; E=10+0.25N; x=0.3N; y=0.3N"),
    ("tilted-spot", 1110, "Offset tilted spot", "偏心倾斜束斑",
     "Offset correlated transverse coordinates. Equal axis scale preserves the spot shape; origin-based radial RMS includes the offset.",
     "偏心且相关的横向坐标；坐标轴等比例保留束斑形状，原点径向均方根包含偏移。", "tilted-spot", "x=0.8+0.6z; y=-0.4+0.25*(0.85z+sqrt(1-0.85^2)w)"),
]


def rows_for(key: str, seed: int) -> list[dict[str, float]]:
    r = Random(seed)
    rows = []
    for i in range(COUNT):
        z, w = r.normal(), r.normal()
        t, energy, sx = 1000 + 2 * z, 10 + 0.12 * w, 0.1
        if key == "broad":
            t, energy, sx = 1000 + 25 * z, 10 + 1.2 * w, 0.65
        elif key in ("positive", "negative"):
            rho = 0.9 if key == "positive" else -0.9
            t, energy = 1000 + 15 * z, 10 + 0.8 * (rho * z + math.sqrt(1 - rho * rho) * w)
        elif key == "tail":
            delay = -15 * math.log(r.uniform())
            t, energy = 1000 + 2 * z + delay, 10 + 0.015 * delay + 0.2 * w
        elif key == "double":
            group = 1 if i % 2 else -1
            t, energy = 1000 + 12 * group + 2 * z, 10 + 0.3 * group + 0.15 * w
        elif key == "drift":
            u = i / (COUNT - 1) - 0.5
            t, energy = 1000 + 20 * u + 2 * z, 10 + u + 0.1 * w
        elif key == "outliers" and i % 32 == 0:
            direction = 1 if (i // 32) % 2 else -1
            t, energy = t + 60 * direction, energy + 4 * direction
        elif key in ("round-spot", "tilted-spot"):
            t, energy, sx = 1000 + 6 * z, 10 + 0.25 * w, 0.3
        row = {"t_ns": t, "E_eV": energy}
        if key != "narrow":
            x, y = r.normal(), r.normal()
            row.update(x_mm=sx * x, y_mm=sx * y)
            if key == "tilted-spot":
                row.update(x_mm=0.8 + 0.6 * x, y_mm=-0.4 + 0.25 * (0.85 * x + math.sqrt(1 - 0.85**2) * y))
        rows.append(row)
    return rows


def statistics(rows: list[dict[str, float]]) -> dict:
    n = len(rows)
    mt = math.fsum(r["t_ns"] for r in rows) / n
    me = math.fsum(r["E_eV"] for r in rows) / n
    tt = math.fsum((r["t_ns"] - mt) ** 2 for r in rows) / (n - 1)
    ee = math.fsum((r["E_eV"] - me) ** 2 for r in rows) / (n - 1)
    cov = math.fsum((r["t_ns"] - mt) * (r["E_eV"] - me) for r in rows) / (n - 1)
    st, se = math.sqrt(tt), math.sqrt(ee)
    radial = math.sqrt(math.fsum(r["x_mm"]**2 + r["y_mm"]**2 for r in rows) / n) if "x_mm" in rows[0] else None
    return {"count": n, "mean_t_ns": mt, "mean_E_eV": me, "sigma_t_ns": st, "sigma_E_eV": se,
            "covariance_ns_eV": cov, "correlation": cov / (st * se) if st and se else None,
            "gaussian_equivalent_fwhm_ns": FWHM * st, "radial_rms_mm": radial}


def build(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    entries = []
    for key, seed, en, zh, description_en, description_zh, category, construction in CASES:
        rows = rows_for(key, seed)
        columns = list(rows[0]) + ["source"]
        stream = io.StringIO(newline="")
        writer = csv.DictWriter(stream, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({**{k: f"{v:.9f}" for k, v in row.items()}, "source": "synthetic-teaching"})
        content = stream.getvalue()
        (directory / f"{key}.csv").write_text(content, encoding="utf-8", newline="")
        rounded = [{k: float(v) for k, v in row.items() if k != "source"} for row in csv.DictReader(io.StringIO(content))]
        entries.append({"id": key, "file": f"{key}.csv", "name": {"en": en, "zh": zh},
                        "description": {"en": description_en, "zh": description_zh}, "category": category,
                        "origin": "synthetic-teaching", "seed": seed, "count": len(rows), "columns": columns,
                        "construction": construction, "sha256": hashlib.sha256(content.encode()).hexdigest(),
                        "expected": statistics(rounded)})
    manifest = {"schema": "rfq-teaching-examples-v1", "generator": GENERATOR, "generator_version": VERSION,
                "origin": "synthetic-teaching", "measured": False, "units": {"t_ns": "ns", "E_eV": "eV", "x_mm": "mm", "y_mm": "mm"},
                "conventions": ["N and z,w denote independent standard normal draws; U is uniform on (0,1).",
                                "Statistics use the rounded CSV values, sample standard deviations and covariance (n−1).",
                                "Gaussian-equivalent FWHM = 2 sqrt(2 ln 2) sigma_t; it is not a fitted non-Gaussian width.",
                                "Radial RMS = sqrt(mean(x²+y²)) about the origin, not about the centroid.",
                                "These examples are synthetic teaching data, not measurements or RFQ transport predictions.",
                                "The catalog covers representative shapes, not every possible dataset."], "examples": entries}
    (directory / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "static/data/rfq-examples")
    build(parser.parse_args().output)
