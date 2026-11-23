# traps.github.io

Personal academic site of Zhuang Ge, built with [Hugo](https://gohugo.io/). One set of content, three interchangeable themes.

| Theme | Config | Look |
|---|---|---|
| [Congo](https://github.com/jpanther/congo) | `sites/congo` | Light profile homepage, sapphire colours (same theme as mengkel.github.io) |
| [Blowfish](https://github.com/nunocoracao/blowfish) | `sites/blowfish` | Dark ocean scheme, gradient header, table of contents, recent posts |
| [PaperMod](https://github.com/adityatelange/hugo-PaperMod) | `sites/papermod` | Minimal profile card with buttons, auto light/dark |

Live site: <https://gezhuang0717.github.io/traps.github.io/>

## Structure

```
content/<language>/  public Markdown pages (en, zh, fi, de, ja, fr)
  _index.md         homepage bio
  research.md       research themes
  publications.md   publication list
  projects.md, talks.md, cv.md
  posts/            blog
assets/img/       profile image (processed by Congo/Blowfish)
static/img/       profile image (PaperMod); put cv.pdf in static/
site.yaml         public site configuration and theme choice
sites/<theme>/    generated theme configuration
themes/           git submodules (added by setup.sh)
```

## Local preview

Requires Hugo **extended** ≥ 0.163 and Git.

```bash
./setup.sh                                                   # once
hugo server --configDir sites/congo    --themesDir themes    # or blowfish / papermod
```

Open the local preview URL printed by Hugo.

## Deploy to GitHub Pages

1. This repository is connected: validated pushes to `main` deploy to https://gezhuang0717.github.io/traps.github.io/.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. The selected theme is configured by `live_theme` in the public `site.yaml` (regenerate theme configurations before building).

## Common edits

- Bio: `content/<language>/_index.md`; headline and social links: edit the public `site.yaml`, then regenerate site configuration.
- Colours and theme selection: edit the public site/theme configuration; do not edit generated files by hand.
- Replace `assets/img/zhuang-ge.png` and `static/img/zhuang-ge.png` with a photo.
- Add a blog post in `content/<language>/posts/` using the existing public-content workflow.
