# traps.github.io — ion-trap and nuclear-physics research website

Personal academic site of Zhuang Ge, built with [Hugo](https://gohugo.io/). One set of content, three interchangeable themes.

| Theme | Config | Look |
|---|---|---|
| [Congo](https://github.com/jpanther/congo) | `sites/congo` | Light profile homepage, sapphire colours (same theme as mengkel.github.io) |
| [Blowfish](https://github.com/nunocoracao/blowfish) | `sites/blowfish` | Dark ocean scheme, gradient header, table of contents, recent posts |
| [PaperMod](https://github.com/adityatelange/hugo-PaperMod) | `sites/papermod` | Minimal profile card with buttons, auto light/dark |

The website manual is kept locally (not in this public repository).

Live site: <https://gezhuang0717.github.io/traps.github.io/>

## Structure

```
content/          shared Markdown pages (edit these)
  _index.md       homepage bio
  research.md     research themes + first-author papers
  publications.md full publication list
  projects.md, talks.md, mentorship.md, cv.md
  posts/          blog
assets/img/       profile image (processed by Congo/Blowfish)
static/img/       profile image (PaperMod); put cv.pdf in static/
sites/<theme>/_default/  per-theme config (menus, colours, links)
themes/           git submodules (added by setup.sh)
```

## Local preview

Requires Hugo **extended** ≥ 0.163 and Git.

```bash
./setup.sh                                                   # once
hugo server --configDir sites/congo    --themesDir themes    # or blowfish / papermod
```

Open http://localhost:1313.

## Deploy to GitHub Pages

1. This repository publishes at **https://gezhuang0717.github.io/traps.github.io/**. Only validated changes on main deploy; draft PRs and feature branches do not publish.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Every push rebuilds the site. To switch theme, change `THEME:` in `.github/workflows/hugo.yml`.

## Common edits

- Bio: `content/_index.md`; headline and social links: `sites/<theme>/_default/languages.en.toml` (Congo/Blowfish) or `hugo.toml` (PaperMod).
- Colours: `colorScheme` in `params.toml` (Congo: congo, avocado, cherry, fire, ocean, sapphire, slate; Blowfish has 17 schemes).
- Replace `assets/img/zhuang-ge.png` and `static/img/zhuang-ge.png` with a photo.
- Add a blog post: `hugo new content posts/my-post.md --configDir sites/congo --themesDir themes`.


## Lab RFQ workbench (2026-11-21 proposal)

The **Mathieu Stability Explorer** and **RFQ Design & Optimization** appear as two ordered subtabs under [Lab](https://gezhuang0717.github.io/traps.github.io/lab/#rfq-workbench). [Games → RFQ](https://gezhuang0717.github.io/traps.github.io/games/#g-rfq) retains its trajectory exercise. Its **Open in Lab** link carries the current operating point to the scientific workbench, keeping the language and GitHub Pages project subdirectory.

**Shared inputs:** ionic mass m in u (not mass number A), integer charge state z, signed DC U in volts, single-rod-pair RF peak V in volts, inscribed radius r₀ in mm, and RF frequency f in MHz. The differential RF peak between opposing rod pairs is 2V; do not confuse it with a differential-voltage input in other Paul-cooling modules.

For an **ideal four-rod, infinitely long linear quadrupole**, with Ω=2πf and Q=ze:

\[
a=\frac{8QU}{mr_0^2\Omega^2},\qquad
q=\frac{4QV}{mr_0^2\Omega^2}.
\]

A stable point requires bounded solutions in **both** transverse Mathieu equations, with (aₓ,qₓ)=(a,q) and (aᵧ,qᵧ)=(−a,−q). The DLMF characteristic-value solver and independent RK4 Floquet-monodromy diagnostic provide cross-checks. A boundary is not silently labelled stable. References: [NIST DLMF §28.2](https://dlmf.nist.gov/28.2) and [§28.17](https://dlmf.nist.gov/28.17).

The **RFQ Design** subtab evaluates rod radius rules, electrode clearances, free-space harmonic ratios, ideal RF pseudopotential, local adiabaticity parameter, voltage candidates, and ideal stage comparisons. Six-to-24-rod multipoles **do not receive a four-rod Mathieu classification**. Zero RF has zero RF pseudopotential even if a selected adiabaticity target is satisfied. Neither tab models collisions, axial transport, fringe fields, space charge, measured transmission, extraction bunch width, or end-to-end hardware acceptance; these require independent experimental or simulation validation.

**Reproducibility:** stability SVG/PNG/CSV, geometry SVG, full settings and design logs as JSON/CSV. Game-to-Lab transfer uses a validated URL preset with schema rfq_preset=v1 and voltage convention rfq_voltage_convention=rod-peak. An ion label transferred by URL does **not** establish evaluated mass provenance; select **Fill ion mass** to retrieve a catalogue value.

### Developer validation commands

    python -m pytest tests -q
    node --test tests/*.test.cjs
    python tools/publish.py check --base-url https://gezhuang0717.github.io/traps.github.io/

GitHub Actions validates Python and Node tests, all three Hugo themes, publication privacy, static assets and internal links. Keep changes in reviewed pull requests; do not commit private experiment files, credentials, nonpublic manuals, or unpublished ion-optics settings. The separate account-root repository is **not** a deployment target for this project.

### Historical note

Earlier README instructions described the user-site root deployment at https://gezhuang0717.github.io/. That was not the appropriate base URL for this repository. The project-site base above and the repository-aware GitHub Actions build are authoritative for this project.


### 中文：RFQ 工作台使用说明

进入 [Lab → RFQ 工作台](https://gezhuang0717.github.io/traps.github.io/zh-hans/lab/#rfq-workbench)，依次查看 **Mathieu 稳定性探索**和 **RFQ 杆几何与射频设计**两个子标签。上方共享离子质量 m、电荷数 z、带符号的直流电压 U、单组电极对地射频峰值 V、内切半径 r₀ 以及射频频率 f。**相对两组电极的射频差分峰值为 2V，不可直接用相同数值替代冷却页面的差分电压。**

理想四杆、无限长、无碰撞情况下，Mathieu 参数采用 a = 8zeU/(mr₀²Ω²)、q = 4zeV/(mr₀²Ω²)、Ω = 2πf。图中稳定区指两个横向方程同时有界，并**不等于实测传输效率**。设计子标签可查看杆半径规则、几何间隙、自由空间谐波、赝势、绝热参数及三段 RFQ 理想计算。六杆及以上多极场不采用四杆 Mathieu 判据。所有结果均需标注理想模型、单位与局限性，不能当作 SIMION 原生仿真、氦气冷却实测或束团输出验收结果。

用户从 Games 携带的离子名称仅是输入标签，不自动等同于 AME/NUBASE 数据库的质量来源；需要点击 **Fill ion mass / 填写离子质量** 获取并记录经过来源识别的数值。参数和计算可导出 JSON/CSV 与 SVG/PNG，详情请查看此项目的 GitHub Actions 测试记录。
