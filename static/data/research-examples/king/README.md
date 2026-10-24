# King plot teaching examples / King 图教学示例

These five deterministic datasets are synthetic training inputs, **not measurements**. The source of every number is `tools/make_king_examples.py` in the repository; the JSON provenance identifies its SHA-256, definition and numerical implementation paths. There is no experimental evaluation or retrieval date. Files contain already modified isotope shifts; no raw isotope shifts or isotope masses are inferred.

这五组确定性数据均为教学合成输入，**并非测量值**。数值来源为生成脚本；JSON 来源信息记录脚本 SHA-256、构造定义及计算模块路径。不存在实验评价日期或数据获取日期。文件包含已修正的同位素位移，不推断原始位移或同位素质量。

| Dataset | Purpose / 用途 | Method |
|---|---|---|
| correlated | Exact current five default rows; nonzero within-pair correlations / 当前默认的五行，含同一行 x/y 关联 | EIV |
| heteroscedastic | Unequal x/y uncertainties, rho=0 / 不等双轴误差，rho=0 | EIV |
| exact-x | Explicitly exact synthetic x (sx=0), positive sy / 明确假设合成 x 精确、sy 为正 | EIV |
| ols | Same x,y as correlated, all uncertainties omitted / 与 correlated 同值、完全省略误差 | OLS |
| curved | Constructed y=1+2x+0.3x²; straight-line inadequacy is artificial / 人工构造曲线，直线不适用由构造决定 | EIV |

## Use / 使用

1. Open Research → CLS workstation → King plot. Choose an example and Load, or download CSV/TXT/JSON and use the King file input. All three formats contain identical numeric rows. You can also paste any of the files into the King textarea.
2. x, y, sx and sy are in GHz·u. rho_xy is dimensionless. The global unit cannot silently change: an explicit incompatible unit declaration is rejected. CSV has a named header and provenance comments; TXT has tab-delimited values and comments; JSON uses `traps-king-data-v1` with a points array and provenance.
3. All rows with sx and sy select errors-in-variables automatically. All rows without errors select descriptive OLS. Mixed known/missing errors are rejected. sx=0 explicitly declares exact x; it does not mean an unknown uncertainty. sy must make the fitting covariance nonsingular.
4. Compare the displayed method, both-axis error bars, fit band, fitted parameters, chi-square/dof and source input. CSV result exports retain rho and method; settings save/reopen the exact input text. The curved example intentionally has a poor linear fit, which is not evidence of new physics.

1. 打开 Research → CLS 工作台 → King 图。选择示例后读取，或下载 CSV/TXT/JSON 后通过 King 文件控件载入，也可以直接粘贴文件文本。三种格式数值完全一致。
2. x、y、sx、sy 单位均为 GHz·u；rho_xy 无量纲。显式声明的不兼容单位会被拒绝。CSV 含命名表头与来源注释；TXT 为制表符数值及注释；JSON 使用 `traps-king-data-v1`，包含 points 数组与来源信息。
3. 各行均给出 sx、sy 时自动采用双轴误差拟合；各行均省略误差时采用描述性 OLS；混合已知与缺失误差会被拒绝。sx=0 是明确的精确 x 假设，不代表未知误差。
4. 比较显示的方法、双轴误差棒、拟合带、参数及 χ²/dof。导出 CSV 保留 rho 和方法；设置文件保存并恢复原始输入文本。曲线示例故意不满足直线关系，不能用作新物理证据。

## Assumptions and reproduction / 假设与复现

Different rows are independent in the website textarea. rho only correlates the x/y pair in the same row. Real modified shifts often share reference masses or shifts, so cross-row covariance can matter; provide that through the existing full-covariance numerical API rather than assuming these teaching uncertainties describe an experiment. No preset is a scientific dataset or a fit acceptance criterion.

界面假定不同输入行彼此独立，rho 仅描述同一行的 x/y 相关。真实修正位移常共享参考质量或位移，应通过现有完整协方差 API 提供点间关联。教学误差不能代替实验误差模型，示例也不是拟合验收标准。

Reproduce the files from the website root using `python tools/make_king_examples.py`. The generator has no dependencies, random numbers or network access. Numerical regressions check identical CSV/TXT/JSON rows, metadata, method choice and fit results.
