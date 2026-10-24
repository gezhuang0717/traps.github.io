---
title: "质量滤波方程与程序使用手册"
subtitle: "网站与 TrapLab 原生程序的来源和可复现约定"
date: "2026-10-24"
lang: "zh-CN"
---

公开版 2026-10-24。执行配套应用命令前，请先在已单独安装的应用目录打开终端。模块名称用于定位入口，不是下载链接。方程及官方文献保留自已核对的源版本。源 Markdown SHA-256：`d8079636dea09e3c6171f80391c861403ff1354d24c560302b34bb9bca3f1ce3`.

本手册逐项记录 38 个共享质量相关物理量、另列的旧原生 W 指标，以及附录中的 28 个旧结合能配方，包括精确质量模板、单位、正负号、用途、数据来源和单独程序入口。它帮助读者先选择物理问题，再输入一致的质量数据，最后解释计算结果和不确定度。公式来自当前源代码清单；文献定义与实现约定分别标注。它不构成新的质量评价、模型精度验证或实验测量。

机器可读清单与来源：当前清单 · sources.json.

# 从一个可复现问题开始

例如，要研究锡同位素链的中子结合变化，先选择双中子分离能 s2n，并固定 Z 为 50。参考数据来自 AME2020。若把 116Sn 的质量过剩人工增加 10 keV，使用同一原始质量模板时，116Sn 的 S₂ₙ 减少 10 keV，118Sn 的 S₂ₙ 增加 10 keV，116Sn 的双中子壳隙减少 20 keV。这个有意标明为合成的练习说明邻核敏感性，不是新测量。与独立舍入的已公布反应表比较时还可能保留微小印刷差异。

## 网站操作

从网站的 Lab 页面进入核素图，在链图的物理量选择框中选取本手册的键；选择固定 Z、固定 N 或固定 A 的链，再指定核素与范围。颜色图层、分级色条、手动色域、幻数线和 N = Z 线是显示选项，不会改变质量值。选择 AME、新输入、混合模板或理论模型时，要同时核对曲线来源与误差说明。

[网站 Lab](https://gezhuang0717.github.io/traps.github.io/zh-hans/lab/)

当前网站源文件: `layouts/_shortcodes/nuclide-chart.html`; `static/js/nuclide-chart.js`.

## 原生程序与独立代码

在下面的 GUI 项目目录中使用已有启动器。两个独立入口共享质量工作台内核；独立绘图脚本可以生成数据和静态图。命令是操作说明，本次文档构建没有启动 Qt 或重跑质量分析。用新的输出目录保存结果，保留原始输入。

```sh

./Run_private.command apps/ame_nubase.py --quantity s2n --z 50 --minimum 60 --maximum 74
./Run_private.command apps/mulberry_mass.py --quantity s2n --z 50 --minimum 60 --maximum 74
./Run_private.command scripts/plot_mass_workbench.py --help
```

每个量对应的函数、文件和启动参数见各条目与代码索引。GUI 的会话 JSON 保存输入和视图；CSV 保存可编辑质量与结果；PNG、PDF、SVG 是图形。保存结果不自动验证测量来源，静态质量比较也不需要物理运动视频。Windows 运行与原生文件对话框验收不在本次文档构建范围内。

# 带物理量类型的数据输入

当前网站的“我的数据”把粘贴表视为带物理量类型的数据，绝不自动把数值当作质量替换。无表头的 `50,50,8` 中，前两列为 Z = 50 和 N = 50，第三列为数值 8。请明确选择物理量和输入单位。初始类型为自定义，并有明确的自定义单位标签，不是质量过剩。表内每行的物理量、单位、标签或参考列不会自动生效；不同物理量或单位的表应分开输入。

1. 打开“我的数据”，粘贴 `50,50,8`，选择每核子结合能 BE/A、单位 MeV/nucleon 和数值列；误差留为未知，并填写系列标签和参考。按“应用”后，自己的点为 8 MeV/nucleon；A = 100 时，转换预览显示总 BE 为 800 MeV。若选择总 BE，则代表总量 8 MeV；若选择 ME 与 keV，链图上的值是 0.008 MeV。这些是有意选择的输入练习，不是测量记录。
2. 要提供误差，可增加第四个数值列，并选作 sigma。标准不确定度必须非负，单位与输入值相同。空白或未选择的误差表示未知；填入零表示明确报告的零误差。数值和误差按相同比例换算。
3. 自己的数据、AME 和所选模型的显示复选框相互独立。全部 38 个质量滤波量都可作为直接数值输入，并与同一种可用参考量比较。半径、磁矩和四极矩比较采用已有 IAEA 数据；E2 和向上跃迁 B(E2) 使用 NNDC 数据；自定义观测量仅有自己的系列。直接输入点不计算残差；质量选择或最大误差筛选作用于参考和模型曲线，自己的直接输入点仍保留显示。
4. 只有明确需要改变质量表时，才使用“作为测量质量追加”或“替换测量质量”。仅 ME、总 BE、BE/A 和中性原子质量可以采用为质量表输入，而且必须能匹配目录中的基态身份。追加保留旧行和当前重复策略；替换是明确动作，所有行都先验证再修改表。直接输入的 Sn、其他滤波量或性质仍是观测量，不能转成质量。含未知或零误差的重复项不能形成有效加权平均；应改选最后一行优先，或提供正误差。
5. 保存输入与设置 JSON 后，可通过文件入口重新打开，或粘贴后按应用。原始文本、数值与误差列、物理量及单位、标签与参考、自己及参考与模型选择均保留。链图 CSV 保存直接输入的来源；质量表 CSV/JSON 另保存原始物理量、数值、单位、误差状态及输入来源。已有图形 PNG/CSV 控件操作当前所画物理量；原生下载属于独立浏览器验收，不由文档构建证明。

能量链图统一为 MeV，BE/A 为 MeV/nucleon，原子质量为 u，半径为 fm，磁矩为 μ_N，四极矩为 b，E2 为 keV，向上跃迁 B(E2) 为 e²b²。适配器把 e²fm⁴ 乘以 1e-4 转为 e²b²，把四极矩 fm² 乘以 0.01 转为 b。它没有引入新的拟合、协方差估计或质量模型方程。

对应代码：`static/js/chart-typed-data.js` 提供单位、适配、质量行转换、便携保存与重开；`static/js/nuclide-chart.js` 绑定控件；measured-masses 和 measured-masses-ui 处理明确采用为质量表的动作。冻结记录含 88 个专项 Node 和 14 个专项 Python 测试。这是源代码与小型构建证据，不表示文档构建已验收文件选择、下载或完整浏览器流程。

记录见 带类型输入实现 和 源文件冻结。

# 记号 单位与不确定度

Z 是质子数，N 是中子数，$A=Z+N$。公式中的 M 表示中性原子质量过剩 ME，通常以 keV 表示；有些图把数值和不确定度同时除以 1000 后显示为 MeV。B 或 BE 是正总结合能，BEA 是每核子结合能。n、H、d、α 分别表示中子、中性氢、氘和氦原子的质量过剩。核态必须一致，缺失邻核不能用零补齐。

$$
\mathrm{ME}(Z,N)=\bigl[M_{\mathrm{atom}}(Z,N)-Au\bigr]c^2,\qquad A=Z+N
$$

$$
F(Z,N)=\sum_i c_i\,\mathrm{ME}(Z+\Delta Z_i,N+\Delta N_i)+C
$$

模板表中的系数为无量纲数，偏移量 C 与输出采用相容能量单位。相同原始质量在一个公式中多次出现时，必须先合并系数，再传播误差。完整协方差与独立近似分别为：

$$
\sigma_F^2=\boldsymbol{c}^{\mathsf T}\mathbf C\boldsymbol{c},\qquad \sigma_{F,\mathrm{ind}}^2=\sum_i c_i^2\sigma_i^2
$$

AME 直接公布的能量及误差保留其评价相关性；新输入或任意差分使用的原始质量边际误差不能冒充完整评价协方差。所有十四个模型的质量误差保持未知，不由额外模型列或模型之间差别虚构实验误差。下列说明复用已有双语 AME 数据核查手册。

设物理量是质量过剩的线性组合。其方差不仅取决于每个质量的误差，还取决于质量之间的相关性：

$$
q=\sum_i c_i\,\mathrm{ME}_i,\qquad
\sigma_q^2=\sum_i c_i^2\sigma_i^2+2\sum_{i<j}c_i c_j\,\mathrm{Cov}(\mathrm{ME}_i,\mathrm{ME}_j).
$$

对两个质量之差构成的衰变能：

$$
q=\mathrm{ME}_P-\mathrm{ME}_D,\qquad
\sigma_q^2=\sigma_P^2+\sigma_D^2-2\,\mathrm{Cov}(\mathrm{ME}_P,\mathrm{ME}_D).
$$

AME 最小二乘评价通过共同的质谱、衰变和反应约束联系不同质量。公布的能量不确定度保留了这些评价相关性。把所有非对角协方差设为零，是需要明确标注的独立传播近似。母核与子核的正协方差会减小质量差的不确定度；同号系数的组合则会有不同效果。本图比较公布结果与对角近似，没有重建协方差矩阵。方法来源见 [AME2020 第一部分](https://doi.org/10.1088/1674-1137/abddb0)。

采用原子质量约定，基态物理量满足下式。ME 表示以能量为单位的质量过剩，中子 ME 使用同一 AME 来源：

$$
Q_{\beta^-}=\mathrm{ME}(Z,N)-\mathrm{ME}(Z+1,N-1),
$$

$$
Q_{2\beta^-}=\mathrm{ME}(Z,N)-\mathrm{ME}(Z+2,N-2),\qquad
S_{2n}=\mathrm{ME}(Z,N-2)+2\mathrm{ME}_n-\mathrm{ME}(Z,N).
$$

其他双 β 通道必须使用正确的电子阈值：中性原子的双电子俘获质量差为母核减去 Z−2 的子核；电子俘获加 β+ 通道还应减去两个电子静止能，双 β+ 通道减去四个电子静止能。具体通道还需要俘获电子空穴能和子核激发能。仅有基态质量差不能证明共振俘获条件、衰变率或分支比。

## 常数和实现差异

| 配置 | 常数键 | 数值 |
| --- | --- | ---: |
| web | u_keV | 931494.10242 |
| web | electron_u | 0.000548579909065 |
| web | u_kg | 1.6605390666e-27 |
| web | electron_keV | 510.99895000014743 |
| native | u_keV | 931494.10242 |
| native | electron_u | 0.0005485799090441 |
| native | u_kg | 1.66053906892e-27 |
| native | electron_keV | 510.99894998067913 |
| legacy_gsi | ME_n_keV | 8071.3181 |
| legacy_gsi | ME_H_keV | 7288.97106 |
| legacy_gsi | electron_u | 0.000548579909065 |

u_keV 是一个原子质量单位对应的静止能，单位 keV；electron_u 以 u 表示电子质量，electron_keV 为电子静止能；u_kg 单位 kg。旧 ME_n_keV 和 ME_H_keV 为 keV。

| 参考粒子 | ME keV | σ keV |
| --- | ---: | ---: |
| n | 8071.31806 | 0.00044 |
| H | 7288.971064 | 1.3e-05 |
| d | 13135.722895 | 1.5e-05 |
| alpha | 2424.91587 | 0.00015 |

这些常数是当前代码快照的约定。网站与原生默认实现对电子静止能所用的 CODATA 版本存在差异，应按清单保留，不强行抹平。正电子发射使用原子质量时需要相应电子阈值；电子俘获质量差也不是壳层分辨的中微子能量。

**legacy-W** · 旧原生 W 在相邻等质量数中心使用固定四分之一归一化的 D2pS2n。共享 wig 在固定 Z、N 的正负二邻核处采用随奇偶变化的 vpn。旧 R 配方 W1、W2、W3 又是三个不同模板。

**pn-parity** · 旧原生 dVpn 是固定 D2pS2n 的别名，不是一般的奇偶分支 vpn。二者只在偶偶中心相同。其他固定混合差分与各自注明的奇偶分支对应。

**electron-constants** · 网站电子质量采用 AME2020 与 CODATA2018，electron_u 为 5.48579909065e-4。原生默认采用 CODATA2022 的 5.485799090441e-4，同时保留 AME2020 的 u_keV 为 931494.10242。电子俘获加正电子与双正电子阈值分别体现两个、四个电子静止能的微小差异。这里把常数视为固定，不另外增加电子或 u 的误差。

**SI-u** · 网站 u_kg 为 1.66053906660e-27，原生默认为 1.66053906892e-27。差异影响质量与频率转换，不影响纯 keV 质量模板。原生 API 还可明确选择 AME2020_COMPAT 常数配置。

**input-sigma-hash** · 原生实验工作台允许数值和不确定度分别带末尾 #。网站 measured-masses.js 接受数值上的 #，但要求不确定度为普通正数。两侧 AME 原始量都分别保留数值与误差的外推标记。

**light-models** · 网站质量曲面即使对模型也使用实验中子、氢、氦及必要时的实验氘回退。原生 ModelData 只在模型缺失轻粒子时用 AME 补充并保留未知误差，不覆盖模型已经提供的轻粒子。旧 constants.py 舍入轻粒子值另作一套约定。

**published-vs-raw** · 两侧默认参考曲面优先使用 AME 直接公布值、评价误差或带固定阈值的精确逆质量差。传入自定义或模型质量图会关闭这些覆盖规则。独立舍入来源列造成的小差异保留不抹平。

**legacy-Gsym** · R 元数据文字给出的组合没有除以二，但实际执行的 CSV 权重和共享 Gsym 都包含二分之一。此手册按可执行权重记录，并明确保留元数据与实现差异。

**recipe-units** · R 派生配方输入结合能，输出可能为 MeV 或 keV；采用明确的旧 H 质量过剩 7288.97106 keV 以及 Qec 偏移。共享模板的质量与单位约定独立列出，不能仅凭同名量合并。

**recipe-covariance** · 共享 Surface 使用原始质量的对角协方差近似，并保留直接评价覆盖值。GSI apply_energy_operator 可接受按输入表行排序的外加协方差；science.nuclear_mass_operator 的矩阵则按原始系数顺序排列，包含零权重位置。这两种矩阵布局不能互换。

**old-manual-constant-description** · 较早的 NUCLEAR_REFERENCE_EN.md 曾把适配器阈值描述为网站 CODATA2018；当前原生默认实际采用本章所列的混合兼容配置。较早声称完全数值一致的结果只代表其源文件哈希对应的历史状态。

**edition-uncertainty** · 核素图的评价版本差值为 ME2020 减去所选历史评价 ME。两边边际误差均已知时采用平方和开根号。不同评价共享数据和相关性，因此这是对角近似，不是已公布的跨评价协方差误差。

**model-residual-error** · 网站 dmod 显示 AME 质量过剩减模型质量过剩，只带实验误差。这是给定模型中心值条件下的数据误差，不是理论预测总误差。原生模型残差在模型误差缺失时保持误差未知。

## 其他转换与处理方程

### linear_uncertainty

$$
F=\sum_i c_i M_i+C,\quad \sigma_F^2=\sum_i c_i^2\sigma_i^2\quad(\mathrm{diagonal})
$$

先合并同一原始质量的系数再平方。零系数项即使缺失或误差未知也不影响结果；非零项的误差未知则输出误差未知。真实的零误差保持为零，常数偏移按固定量处理。

### full_covariance

$$
\sigma_F^2=\boldsymbol c^\mathsf{T}\mathbf C\boldsymbol c=\sum_i c_i^2C_{ii}+2\sum_{i<j}c_ic_jC_{ij}
$$

只有 GSI 适配器收到明确给定的协方差矩阵时才使用完整形式。直接 AME 评价误差保留原值，但并不由此重建完整协方差矩阵。

### atomic_mass

$$
M_{\mathrm{atom}}/u=A+M(Z,N)/(u c^2),\quad u c^2=931494.10242\ {\mathrm{keV}}
$$

M 表示 keV 质量过剩，不是完整原子质量。原子质量误差为质量过剩误差除以固定换算常数。

### ion_mass

$$
M_{\mathrm{ion}}/u=M_{\mathrm{atom}}/u-q m_e/u+E_{\mathrm{ion}}/(u c^2)
$$

q 为带符号电荷数。电离或束缚修正为正时，相对单纯减电子质量会增大离子质量。若输入修正单位为 eV，分母需额外乘 1000。不虚构该修正或常数的不确定度；网站目录解析不自动加入这些电离能。

### ratio_mass

$$
r=\nu_{\mathrm{ref}}/\nu_{\mathrm{IOI}},\quad M_{\mathrm{IOI,ion}}=r(q_{\mathrm{IOI}}/q_{\mathrm{ref}})M_{\mathrm{ref,ion}}
$$

频率比定义为参考离子频率除待测离子频率。这里的电荷数为正的绝对值。还原中性原子时，加回相应电子质量并减去待测离子的电离修正；比值和参考质量的独立误差项按平方和合成。

### weighted_duplicates

$$
\bar M=\frac{\sum_i M_i/\sigma_i^2}{\sum_i1/\sigma_i^2},\quad \sigma_{\bar M}=(\sum_i1/\sigma_i^2)^{-1/2}\max[1,\sqrt{\chi^2/(k-1)}]
$$

仅用于相互独立的重复输入行，另可选择最后一行优先。散布较大时采用不小于一的 Birge 膨胀因子；这不建模共同装置系统误差，也不是全局 AME 调整。

### residual_cancellation

$$
\Delta F=F_{\mathrm{New}}-F_{\mathrm{AME}},\quad \sigma_{\Delta F}^2=\sum_{\text{replaced }i}c_i^2(\sigma_{{\mathrm{New}},i}^2+\sigma_{{\mathrm{AME}},i}^2)
$$

这是原生工作台残差规则。未更换的共同 AME 原始质量相互抵消，只剩被替换质量的误差贡献。它是明确声明的对角比较，不是把两个嵌套反应误差当作互相独立。

### single_beta_plus

$$
Q_{\beta^+}=M(Z,N)-M(Z-1,N+1)-2e
$$

这是原生 physics.q_beta_plus 和 decay.evaluate 的单正电子通道，与主目录的电子俘获加正电子双弱通道 qecbp 分开。

### state_Qstar

$$
Q^*=Q_{\mathrm{selected\ states}}-E_x,\quad \sigma_{Q^*}=\sqrt{\sigma_Q^2+\sigma_{E_x}^2}
$$

原生 decay.evaluate 使用所选核态。子核态质量已包含其激发能，因此这里的 Ex 是额外能量，不应重复扣除已选子核激发。基态到基态优先采用评价值，否则使用所选 NUBASE 质量的对角近似；缺失误差保持未知。

### general_reaction

$$
Q=\sum_{\mathrm{reactants}}a_i M_i-\sum_{\mathrm{products}}b_j M_j
$$

NuclearData.reaction 检查中性原子反应的总 A 和 Z 守恒，合并重复身份并传播原始质量的对角误差。没有自动加入完整评价协方差或分子束缚修正。

### drip_boundary

$$
S_n>0,\ S_n(N+1)\leq0\quad\text{or analogous }S_{2n},S_p,S_{2p}
$$

dripBoundary 只在紧邻的下一个整数索引存在、有限且不为正时，返回最后一个正分离能样本。缺失样本和数据表边缘不能当作物理滴线；这里没有插值。对其他分离能方向采用相同规则。

### legacy_four_mass_tool

$$
S_n=M_{N-1}+n-M_N,\quad S_{2n}=M_{N-2}+2n-M_N,\quad Q_{\mathrm{EC}}=M_N-M_{\mathrm{daughter}}
$$

gsi_mrtof.science.mass_quantities 可接收四个相互独立、非负的输入误差，采用固定的历史中子质量过剩偏移；不查询协方差。

# 逐项方程与使用说明

每一项都给出当前实现的精确方程和质量模板。代码键保留原样，便于在菜单、命令行和源代码中检索。符号和奇偶因子以方程为准，不能只凭名称推断。正 Q 值只说明指定通道的能量余量；差分尖点也不自动证明唯一的核结构机制。

## 1 me 质量过剩

中性原子质量相对整数质量数的能量差。

用途与获得的信息：统一质量输入，比较评价质量和新测量质量。

$$
M(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-91525.979 ± 0.096 keV

默认评价参考：-91525.979 ± 0.096 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn me --format csv
```

## 2 BE 总结合能

以中性氢原子和中子为参照的正总结合能。

用途与获得的信息：研究整体结合与质量模型；不能与每核子结合能混用。

$$
B(Z,N)=Z H+N n-M(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| H | Z |
| n | N |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

988681.52416 ± 0.10029827565815876 keV

默认评价参考：988681.5256 ± 0.1044 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn BE --format csv
```

## 3 BEA 每核子结合能

总结合能除以质量数。

用途与获得的信息：比较不同质量数核素的平均结合强度。

$$
B(Z,N)/A,\quad A=Z+N
$$

输出单位：keV/nucleon. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -1/A |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| H | Z/A |
| n | N/A |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

8523.116587586206 ± 0.0008646403073979202 keV/nucleon

默认评价参考：8523.1166 ± 0.0009 keV/nucleon

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn BEA --format csv
```

## 4 sn 单中子分离能

从核素移走一个中子所需的能量。

用途与获得的信息：观察中子束缚、壳层与反应阈值；负值表示相应发射在能量上开放。

$$
S_n=M(Z,N-1)+n-M(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`S1n`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 1 |
| 0 | 0 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| n | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

9563.451060000001 ± 0.09716580468456996 keV

默认评价参考：9563.4512 ± 0.0948 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 27

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn sn --format csv
```

## 5 s2n 双中子分离能

从核素移走两个中子所需的能量。

用途与获得的信息：沿同位素链观察平滑趋势和壳层变化，减弱部分奇偶交替。

$$
S_{2n}=M(Z,N-2)+2n-M(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`S2n`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 1 |
| 0 | 0 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| n | 2 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

17108.880120000005 ± 0.10028845596577904 keV

默认评价参考：17108.8797 ± 0.098 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 27

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn s2n --format csv
```

## 6 sp 单质子分离能

从核素移走一个质子所需的能量，使用一致的原子质量约定。

用途与获得的信息：研究质子束缚、阈值及质子滴线附近趋势。

$$
S_p=M(Z-1,N)+H-M(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`S1p`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | 0 | 1 |
| 0 | 0 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| H | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

9278.593064000004 ± 0.09674709385299385 keV

默认评价参考：9278.5934 ± 0.0953 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 28

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn sp --format csv
```

## 7 s2p 双质子分离能

从核素移走两个质子所需的能量。

用途与获得的信息：沿同中子素链比较质子结合与壳层变化。

$$
S_{2p}=M(Z-2,N)+2H-M(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`S2p`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | 0 | 1 |
| 0 | 0 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| H | 2 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

16088.987128000013 ± 0.29221909704192844 keV

默认评价参考：16088.987 ± 0.2899 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 28

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn s2p --format csv
```

## 8 qbm 单贝塔负衰变能

母核与贝塔负衰变子核的中性原子质量差。

用途与获得的信息：判断基态通道的能量允许程度；不由此推断分支比或衰变率。

$$
Q_{\beta^-}=M(Z,N)-M(Z+1,N-1)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 1 | -1 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-4703.959000000003 ± 5.154893985330833 keV

默认评价参考：-4703.9591 ± 5.154 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 29

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qbm --format csv
```

## 9 qec 电子俘获质量差

母核与电子俘获子核的中性原子质量差。

用途与获得的信息：确定总能量余量；实际中微子能量还需减去电子空穴、子核激发和反冲能。

$$
Q_{\mathrm{EC}}=M(Z,N)-M(Z-1,N+1)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -1 | 1 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-3276.221000000005 ± 0.24003333101883997 keV

默认评价参考：-3276.2204 ± 0.2397 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 29

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qec --format csv
```

## 10 qa 阿尔法衰变能

母核减去子核与氦原子的质量差。

用途与获得的信息：比较阿尔法衰变基态阈值；寿命仍取决于穿透与结构因素。

$$
Q_\alpha=M(Z,N)-M(Z-2,N-2)-\alpha
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | -2 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| alpha | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-3376.037870000003 ± 0.26779847367003423 keV

默认评价参考：-3376.0374 ± 0.2664 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 35
- mass-surface.js · `create.derive` · line 29

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qa --format csv
```

## 11 q2bm 双贝塔负质量差

母核与双贝塔负子核的原子质量差。

用途与获得的信息：研究双贝塔基态能量窗口，不等同于完整相空间或半衰期。

$$
Q_{2\beta^-}=M(Z,N)-M(Z+2,N-2)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 2 | -2 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-6262.1860000000015 ± 24.2061903652764 keV

默认评价参考：-6262.1863 ± 24.206 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 35

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q2bm --format csv
```

## 12 q2ec 双电子俘获质量差

母核与双电子俘获子核的原子质量差。

用途与获得的信息：筛查总能量余量；共振俘获还需核态、双空穴能与宽度。

$$
Q_{2{\mathrm{EC}}}=M(Z,N)-M(Z-2,N+2)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 2 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-2813.4900000000052 ± 0.1865904606350496 keV

默认评价参考：-2813.4899 ± 0.1295 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 36

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q2ec --format csv
```

## 13 qecbp 电子俘获伴正电子阈值

双电子俘获原子质量差再减去两个电子静止能。

用途与获得的信息：检查电子俘获加正电子通道；记录网站与原生程序采用的电子常数版本。

$$
Q_{{\mathrm{EC}}\beta^+}=M(Z,N)-M(Z-2,N+2)-2e
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 2 | -1 |

常数偏移：

$$
C=-2e
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-3835.4878999613634 ± 0.1865904606350496 keV

默认评价参考：-3835.487799961358 ± 0.1295 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 37

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qecbp --format csv
```

## 14 q2bp 双正电子阈值

双电子俘获原子质量差再减去四个电子静止能。

用途与获得的信息：检查双正电子基态通道的能量余量，并保留常数版本差异。

$$
Q_{2\beta^+}=M(Z,N)-M(Z-2,N+2)-4e
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 2 | -1 |

常数偏移：

$$
C=-4e
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-4857.4857999227215 ± 0.1865904606350496 keV

默认评价参考：-4857.485699922717 ± 0.1295 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 38

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q2bp --format csv
```

## 15 q4bm 四重贝塔负质量差

沿固定质量数移动四个电荷单位的质量差。

用途与获得的信息：比较四重贝塔基态阈值，不据此证明可观测分支。

$$
Q_{4\beta^-}=M(Z,N)-M(Z+4,N-4)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 4 | -4 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-18479.102000000014 ± 13.017353993803809 keV

默认评价参考：-18479.1015 ± 13.0175 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 39

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn q4bm --format csv
```

## 16 qep 电子俘获伴质子发射能

电子俘获与质子发射组合的原子质量差。

用途与获得的信息：筛查相应末态的总能量余量；实际能级和分支需另外给出。

$$
Q_{{\mathrm{EC}}p}=M(Z,N)-M(Z-2,N+1)-H
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | 1 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| H | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-10730.470064000012 ± 0.6580402724522262 keV

默认评价参考：-10730.4702 ± 0.6573 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 40

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qep --format csv
```

## 17 qbmn 贝塔负伴中子发射能

贝塔负衰变后发射中子的总质量差。

用途与获得的信息：检查贝塔缓发中子基态能量窗口，不把正值当作已测分支。

$$
Q_{\beta^-n}=M(Z,N)-M(Z+1,N-2)-n
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| 1 | -2 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| n | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-12593.88506000001 ± 16.025287554162638 keV

默认评价参考：-12593.8847 ± 16.0256 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 41

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qbmn --format csv
```

## 18 qda 氘入射阿尔法出射反应能

氘入射、阿尔法出射通道的初末态质量差。

用途与获得的信息：比较该通道的基态反应能；实验室束流阈值还涉及运动学。

$$
Q_{(d,\alpha)}=M(Z,N)+d-M(Z-1,N-1)-\alpha
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -1 | -1 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| d | 1 |
| alpha | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

7754.635024999995 ± 0.3159383210770735 keV

默认评价参考：7754.6353 ± 0.3154 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 45

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qda --format csv
```

## 19 qpa 质子入射阿尔法出射反应能

质子入射、阿尔法出射通道的初末态质量差。

用途与获得的信息：比较基态反应能，核态选择和束流运动学另行处理。

$$
Q_{(p,\alpha)}=M(Z,N)+H-M(Z-1,N-2)-\alpha
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -1 | -2 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| H | 1 |
| alpha | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

2705.1991940000007 ± 0.21109245052583003 keV

默认评价参考：2705.1998 ± 0.2103 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 46

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qpa --format csv
```

## 20 qna 中子入射阿尔法出射反应能

中子入射、阿尔法出射通道的初末态质量差。

用途与获得的信息：比较基态通道能量，不等同于反应截面。

$$
Q_{(n,\alpha)}=M(Z,N)+n-M(Z-2,N-1)-\alpha
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1 |
| -2 | -1 | -1 |

轻粒子项

| 粒子 | 系数 |
| --- | ---: |
| n | 1 |
| alpha | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

3163.709189999986 ± 0.263137257149192 keV

默认评价参考：3163.7098 ± 0.2602 keV

[原始数据表](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 36
- mass-surface.js · `create.derive` · line 47

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn qna --format csv
```

## 21 d2n 双中子壳隙指标

相邻双中子分离能之差。

用途与获得的信息：识别同位素链中的局部不连续；形变与相关能也会影响该指标。

$$
\delta_{2n}=M(Z,N-2)-2M(Z,N)+M(Z,N+2)=S_{2n}(Z,N)-S_{2n}(Z,N+2)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`dS2n`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 1 |
| 0 | 0 | -2 |
| 0 | 2 | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

839.3800000000192 ± 0.5354493440093097 keV

默认评价参考：839.3800000000192 ± 0.5354493440093097 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 49

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d2n --format csv
```

## 22 d2p 双质子壳隙指标

相邻双质子分离能之差。

用途与获得的信息：比较同中子素链的壳层变化；不能单独当作纯单粒子能隙。

$$
\delta_{2p}=M(Z-2,N)-2M(Z,N)+M(Z+2,N)=S_{2p}(Z,N)-S_{2p}(Z+2,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`dS2p`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | 0 | 1 |
| 0 | 0 | -2 |
| 2 | 0 | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

5346.266000000018 ± 18.309087251963163 keV

默认评价参考：5346.266000000018 ± 18.309087251963163 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 55

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d2p --format csv
```

## 23 d3n 三点中子奇偶指标

带中子数奇偶因子的三点质量差。

用途与获得的信息：研究中子奇偶交替与配对趋势，采用本代码明确的符号约定。

$$
\Delta_n^{(3)}=\frac{(-1)^N}{2}[M(Z,N-1)-2M(Z,N)+M(Z,N+1)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`D3n`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 * (-1)^N |
| 0 | 0 | -1 * (-1)^N |
| 0 | 1 | 0.5 * (-1)^N |

常数偏移：

$$
C=0
$$

约定：(-1)^N multiplies the full stencil; signs are not absolute-valued.

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`, `pairing-context-satula1998`。其中配对论文只作研究背景，不宣称是本代码定义的直接来源。

### 可核对示例

**116Sn** · 保留原始数据的计算值

1310.185000000005 ± 0.25998942286177723 keV

默认评价参考：1310.185000000005 ± 0.25998942286177723 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 51

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d3n --format csv
```

## 24 d3p 三点质子奇偶指标

带质子数奇偶因子的三点质量差。

用途与获得的信息：研究质子奇偶交替，比较前必须核对奇偶因子与符号。

$$
\Delta_p^{(3)}=\frac{(-1)^Z}{2}[M(Z-1,N)-2M(Z,N)+M(Z+1,N)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`D3p`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | 0 | 0.5 * (-1)^Z |
| 0 | 0 | -1 * (-1)^Z |
| 1 | 0 | 0.5 * (-1)^Z |

常数偏移：

$$
C=0
$$

约定：(-1)^Z multiplies the full stencil; signs are not absolute-valued.

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`, `pairing-context-satula1998`。其中配对论文只作研究背景，不宣称是本代码定义的直接来源。

### 可核对示例

**116Sn** · 保留原始数据的计算值

2438.0185000000056 ± 4.219596455823708 keV

默认评价参考：2438.0185000000056 ± 4.219596455823708 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 52

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d3p --format csv
```

## 25 d5n 五点中子奇偶指标

用五个相邻中子数质量构成的配对指标。

用途与获得的信息：抑制平滑低阶背景，比较中子奇偶结构；缺失任一邻核则不可用。

$$
\Delta_n^{(5)}=\frac{(-1)^N}{8}[-M(Z,N-2)+4M(Z,N-1)-6M(Z,N)+4M(Z,N+1)-M(Z,N+2)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -0.125 * (-1)^N |
| 0 | -1 | 0.5 * (-1)^N |
| 0 | 0 | -0.75 * (-1)^N |
| 0 | 1 | 0.5 * (-1)^N |
| 0 | 2 | -0.125 * (-1)^N |

常数偏移：

$$
C=0
$$

约定：(-1)^N multiplies the full stencil; signs are not absolute-valued.

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`, `pairing-context-satula1998`。其中配对论文只作研究背景，不宣称是本代码定义的直接来源。

### 可核对示例

**116Sn** · 保留原始数据的计算值

1205.2625000000062 ± 0.2597427212647161 keV

默认评价参考：1205.2625000000062 ± 0.2597427212647161 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 53

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d5n --format csv
```

## 26 d5p 五点质子奇偶指标

用五个相邻质子数质量构成的配对指标。

用途与获得的信息：抑制平滑背景并比较质子奇偶结构，保留代码的符号定义。

$$
\Delta_p^{(5)}=\frac{(-1)^Z}{8}[-M(Z-2,N)+4M(Z-1,N)-6M(Z,N)+4M(Z+1,N)-M(Z+2,N)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | 0 | -0.125 * (-1)^Z |
| -1 | 0 | 0.5 * (-1)^Z |
| 0 | 0 | -0.75 * (-1)^Z |
| 1 | 0 | 0.5 * (-1)^Z |
| 2 | 0 | -0.125 * (-1)^Z |

常数偏移：

$$
C=0
$$

约定：(-1)^Z multiplies the full stencil; signs are not absolute-valued.

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`, `pairing-context-satula1998`。其中配对论文只作研究背景，不宣称是本代码定义的直接来源。

### 可核对示例

**116Sn** · 保留原始数据的计算值

1769.735250000007 ± 4.7998167217613625 keV

默认评价参考：1769.735250000007 ± 4.7998167217613625 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 54

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn d5p --format csv
```

## 27 vpn 平均质子中子相互作用指标

四个质量的混合差，用于表征局部质子中子相关。

用途与获得的信息：比较两类核子的平均相互作用趋势；不把局部差分当作唯一的微观相互作用。

$$
\delta V_{pn}(Z,N)=\sum_i b_i B(Z+\Delta Z_i,N+\Delta N_i)\quad\text{(four parity branches)}
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

常数偏移：

$$
C=0
$$

Z 偶数, N 偶数

$$
\delta V_{pn}^{ee}=\frac14[-M(Z,N)+M(Z,N-2)+M(Z-2,N)-M(Z-2,N-2)]
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | -2 | -0.25 |
| -2 | 0 | 0.25 |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.25 |

Z 偶数, N 奇数

$$
\delta V_{pn}^{eo}=\frac12[-M(Z,N)+M(Z,N-1)+M(Z-2,N)-M(Z-2,N-1)]
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | -1 | -0.5 |
| -2 | 0 | 0.5 |
| 0 | -1 | 0.5 |
| 0 | 0 | -0.5 |

Z 奇数, N 偶数

$$
\delta V_{pn}^{oe}=\frac12[-M(Z,N)+M(Z,N-2)+M(Z-1,N)-M(Z-1,N-2)]
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | -2 | -0.5 |
| -1 | 0 | 0.5 |
| 0 | -2 | 0.5 |
| 0 | 0 | -0.5 |

Z 奇数, N 奇数

$$
\delta V_{pn}^{oo}=-M(Z,N)+M(Z,N-1)+M(Z-1,N)-M(Z-1,N-1)
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | -1 | -1 |
| -1 | 0 | 1 |
| 0 | -1 | 1 |
| 0 | 0 | -1 |

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`, `delta-vpn-zhang1989`, `delta-vpn-cakirli2005`, `delta-vpn-cakirli2005-erratum`, `delta-vpn-zhang1989`, `delta-vpn-cakirli2005`, `delta-vpn-cakirli2005-erratum`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

381.54175000000396 ± 0.09641479398930436 keV

默认评价参考：381.54175000000396 ± 0.09641479398930436 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 60

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn vpn --format csv
```

## 28 wig 固定质子数维格纳型尖点指标

在固定质子数方向按实现定义构造的尖点差分。

用途与获得的信息：探索接近中子数等于质子数的局部增强；不能与旧原生程序的等质量数 W 指标混同。

$$
W_N(Z,N)=\delta V_{pn}(Z,N)-\frac12[\delta V_{pn}(Z,N-2)+\delta V_{pn}(Z,N+2)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

常数偏移：

$$
C=0
$$

Z 偶数, N 偶数

$$
0.125M(Z-2,N-4)-0.375M(Z-2,N-2)+0.375M(Z-2,N)-0.125M(Z-2,N+2)-0.125M(Z,N-4)+0.375M(Z,N-2)-0.375M(Z,N)+0.125M(Z,N+2)
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | -4 | 0.125 |
| -2 | -2 | -0.375 |
| -2 | 0 | 0.375 |
| -2 | 2 | -0.125 |
| 0 | -4 | -0.125 |
| 0 | -2 | 0.375 |
| 0 | 0 | -0.375 |
| 0 | 2 | 0.125 |

Z 偶数, N 奇数

$$
0.25M(Z-2,N-3)-0.25M(Z-2,N-2)-0.5M(Z-2,N-1)+0.5M(Z-2,N)+0.25M(Z-2,N+1)-0.25M(Z-2,N+2)-0.25M(Z,N-3)+0.25M(Z,N-2)+0.5M(Z,N-1)-0.5M(Z,N)-0.25M(Z,N+1)+0.25M(Z,N+2)
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | -3 | 0.25 |
| -2 | -2 | -0.25 |
| -2 | -1 | -0.5 |
| -2 | 0 | 0.5 |
| -2 | 1 | 0.25 |
| -2 | 2 | -0.25 |
| 0 | -3 | -0.25 |
| 0 | -2 | 0.25 |
| 0 | -1 | 0.5 |
| 0 | 0 | -0.5 |
| 0 | 1 | -0.25 |
| 0 | 2 | 0.25 |

Z 奇数, N 偶数

$$
0.25M(Z-1,N-4)-0.75M(Z-1,N-2)+0.75M(Z-1,N)-0.25M(Z-1,N+2)-0.25M(Z,N-4)+0.75M(Z,N-2)-0.75M(Z,N)+0.25M(Z,N+2)
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | -4 | 0.25 |
| -1 | -2 | -0.75 |
| -1 | 0 | 0.75 |
| -1 | 2 | -0.25 |
| 0 | -4 | -0.25 |
| 0 | -2 | 0.75 |
| 0 | 0 | -0.75 |
| 0 | 2 | 0.25 |

Z 奇数, N 奇数

$$
0.5M(Z-1,N-3)-0.5M(Z-1,N-2)-M(Z-1,N-1)+M(Z-1,N)+0.5M(Z-1,N+1)-0.5M(Z-1,N+2)-0.5M(Z,N-3)+0.5M(Z,N-2)+M(Z,N-1)-M(Z,N)-0.5M(Z,N+1)+0.5M(Z,N+2)
$$

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | -3 | 0.5 |
| -1 | -2 | -0.5 |
| -1 | -1 | -1 |
| -1 | 0 | 1 |
| -1 | 1 | 0.5 |
| -1 | 2 | -0.5 |
| 0 | -3 | -0.5 |
| 0 | -2 | 0.5 |
| 0 | -1 | 1 |
| 0 | 0 | -1 |
| 0 | 1 | -0.5 |
| 0 | 2 | 0.5 |

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

归属说明：此处按当前代码定义使用；该名称不证明它与某篇论文中的同名指标完全相同。

来源索引：`ame2020`, `filters-implementation`, `delta-vpn-zhang1989`, `delta-vpn-cakirli2005`, `delta-vpn-cakirli2005-erratum`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-6.846624999992855 ± 0.16974401683122736 keV

默认评价参考：-6.846624999992855 ± 0.16974401683122736 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 37
- mass-surface.js · `create.derive` · line 26

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn wig --format csv
```

## 29 D1nS1n 单中子分离能的一步中子差分

单中子分离能沿中子数方向的一步差分。

用途与获得的信息：定位局部斜率或曲率变化；具体方向与正负号见精确模板。

$$
S_n(Z,N)-S_n(Z,N+1)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 1 |
| 0 | 0 | -2 |
| 0 | 1 | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

2620.37000000001 ± 0.5199788457235545 keV

默认评价参考：2620.37000000001 ± 0.5199788457235545 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 24
- mass-surface.js · `create.derive` · line 8

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1nS1n --format csv
```

## 30 D1pS1p 单质子分离能的一步质子差分

单质子分离能沿质子数方向的一步差分。

用途与获得的信息：比较质子方向的局部变化，核对模板中的坐标偏移。

$$
S_p(Z,N)-S_p(Z+1,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -1 | 0 | 1 |
| 0 | 0 | -2 |
| 1 | 0 | 1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

4876.037000000011 ± 8.439192911647416 keV

默认评价参考：4876.037000000011 ± 8.439192911647416 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 25
- mass-surface.js · `create.derive` · line 9

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS1p --format csv
```

## 31 D1nS2n 双中子分离能的一步中子差分

双中子分离能沿中子数方向的一步差分。

用途与获得的信息：观察两中子结合随中子数的局部变化。

$$
S_{2n}(Z,N+1)-S_{2n}(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -1 |
| 0 | -1 | 1 |
| 0 | 0 | 1 |
| 0 | 1 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-602.3480000000127 ± 0.49352912781314134 keV

默认评价参考：-602.3480000000127 ± 0.49352912781314134 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 26
- mass-surface.js · `create.derive` · line 10

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1nS2n --format csv
```

## 32 D1pS2p 双质子分离能的一步质子差分

双质子分离能沿质子数方向的一步差分。

用途与获得的信息：观察两质子结合随质子数的局部变化。

$$
S_{2p}(Z+1,N)-S_{2p}(Z,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -2 | 0 | -1 |
| -1 | 0 | 1 |
| 0 | 0 | 1 |
| 1 | 0 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-2407.838000000018 ± 8.442067578502318 keV

默认评价参考：-2407.838000000018 ± 8.442067578502318 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 27
- mass-surface.js · `create.derive` · line 11

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS2p --format csv
```

## 33 D2pS2n 双中子分离能的两步质子差分

双中子分离能在相隔两个质子的位置作差并归一化。

用途与获得的信息：研究混合质子中子质量曲率；模板中使用负二质子偏移。

$$
\frac14[S_{2n}(Z,N)-S_{2n}(Z-2,N)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

菜单或代码别名：`dVpn`.

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -0.25 |
| 0 | -2 | 0.25 |
| -2 | 0 | 0.25 |
| -2 | -2 | -0.25 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

381.54175000000396 ± 0.09641479398930436 keV

默认评价参考：381.54175000000396 ± 0.09641479398930436 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 28
- mass-surface.js · `create.derive` · line 12

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D2pS2n --format csv
```

## 34 D1pS1n 单中子分离能的一步质子差分

单中子分离能沿质子数方向的一步差分。

用途与获得的信息：比较加入质子对中子结合的局部影响。

$$
S_n(Z,N)-S_n(Z-1,N)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -1 |
| 0 | -1 | 1 |
| -1 | 0 | 1 |
| -1 | -1 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

525.5829999999987 ± 0.31652172121356853 keV

默认评价参考：525.5829999999987 ± 0.31652172121356853 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 29
- mass-surface.js · `create.derive` · line 13

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS1n --format csv
```

## 35 D1pS2n 双中子分离能的一步质子差分

双中子分离能沿质子数方向的一步差分。

用途与获得的信息：比较质子变化对双中子结合的影响。

$$
\frac12[S_{2n}(Z,N)-S_{2n}(Z-1,N)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -0.5 |
| 0 | -2 | 0.5 |
| -1 | 0 | 0.5 |
| -1 | -2 | -0.5 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

398.50500000000466 ± 0.10670637281812179 keV

默认评价参考：398.50500000000466 ± 0.10670637281812179 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 30
- mass-surface.js · `create.derive` · line 14

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D1pS2n --format csv
```

## 36 D2pS1n 单中子分离能的两步质子差分

单中子分离能在相隔两个质子的位置作差并归一化。

用途与获得的信息：核对实际负二质子偏移，避免从名称误推负一偏移。

$$
\frac12[S_n(Z,N)-S_n(Z-2,N)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -0.5 |
| 0 | -1 | 0.5 |
| -2 | 0 | 0.5 |
| -2 | -1 | -0.5 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

260.2425000000003 ± 0.19081535577620581 keV

默认评价参考：260.2425000000003 ± 0.19081535577620581 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 31
- mass-surface.js · `create.derive` · line 15

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn D2pS1n --format csv
```

## 37 Gplus 实现定义的 Gplus 组合

代码内明确给出的质量差分组合，名称本身不是文献定义。

用途与获得的信息：按本手册模板复现并比较局部结构；没有来源依据时不赋予特定文献归属。

$$
\delta_{2n}(Z,N)-\delta_{2n}(Z,N+2)
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 1 |
| 0 | 0 | -3 |
| 0 | 2 | 3 |
| 0 | 4 | -1 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

归属说明：此处按当前代码定义使用；该名称不证明它与某篇论文中的同名指标完全相同。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

157.41400000004796 ± 1.7807846585143303 keV

默认评价参考：157.41400000004796 ± 1.7807846585143303 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 32
- mass-surface.js · `create.derive` · line 16

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn Gplus --format csv
```

## 38 Gsym 实现定义的 Gsym 组合

代码内明确给出的对称差分组合，采用实现约定。

用途与获得的信息：用精确模板分析局部质量结构，不声称它是已核验的标准文献指标。

$$
\frac12[2\delta_{2n}(Z,N)-\delta_{2n}(Z,N-2)-\delta_{2n}(Z,N+2)]
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -4 | -0.5 |
| 0 | -2 | 2 |
| 0 | 0 | -3 |
| 0 | 2 | 2 |
| 0 | 4 | -0.5 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

归属说明：此处按当前代码定义使用；该名称不证明它与某篇论文中的同名指标完全相同。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

29.176000000043132 ± 1.1469616384169088 keV

默认评价参考：29.176000000043132 ± 1.1469616384169088 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 33
- mass-surface.js · `create.derive` · line 17

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn Gsym --format csv
```

## 39 W 旧原生程序的等质量数尖点指标

沿固定质量数方向的维格纳型尖点组合。

用途与获得的信息：探索接近中子数等于质子数的局部结构；它与共享内核固定质子数的 wig 不是同一模板。

$$
W_{\mathrm{isobar}}(Z,N)=V_0(Z,N)-\frac12[V_0(Z-1,N+1)+V_0(Z+1,N-1)],\quad V_0={\mathrm{D2pS2n}}
$$

输出单位：keV. 输入为下列同一核态模板中所需的全部质量；缺失项使结果不可用。

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| -3 | -1 | 0.125 |
| -3 | 1 | -0.125 |
| -2 | -2 | -0.25 |
| -2 | 0 | 0.25 |
| -1 | -3 | 0.125 |
| -1 | -1 | -0.25 |
| -1 | 1 | 0.125 |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.25 |
| 1 | -3 | -0.125 |
| 1 | -1 | 0.125 |

常数偏移：

$$
C=0
$$

约定：中性原子质量过剩，基态，固定 Z 与 N 坐标约定。

来源索引：`ame2020`, `filters-implementation`.

### 可核对示例

**116Sn** · 保留原始数据的计算值

-3.282374999997046 ± 2.6904594664527095 keV

默认评价参考：-3.282374999997046 ± 2.6904594664527095 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：使用本章开头的原始质量合并规则。直接评价参考误差与重新计算的独立近似分开；模型误差未知。

### 对应程序

- energies.py · `Surface.get / Surface._linear / Reference.published` · line 230

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn W --format csv
```

# 旧代码配方的独立附录

本附录保留 R 派生的结合能配方与单独代码入口。名称加上 gsi 前缀，避免和共享质量过剩内核中的同名量混淆。配方常以 MeV 输出，而共享内核通常以 keV 输出；归一化、平移和奇偶筛选也可能不同。先比较精确模板，再比较数值。

## 1 gsi:identity_op 恒等结合能配方

按配方单位返回结合能。

用途：核对输入、能量单位和配方归一化。

结合能形式

$$
10^{-3}[1B(Z,N)]
$$

质量过剩等价形式

$$
10^{-3}[Z H+N n-M(Z,N)]
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.05 |
| n | 0.066 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 2
- nuclear_operator_metadata.csv · `` · line 2

**Z=50, N=66** · 保留原始数据的计算值

988.6815266 ± 9.6e-05 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 2 gsi:S1n 单中子分离能

从核素移走一个中子所需的能量。

用途：观察中子束缚、壳层与反应阈值；负值表示相应发射在能量上开放。

结合能形式

$$
10^{-3}[-1B(Z,N-1)+1B(Z,N)]
$$

质量过剩等价形式

$$
0.001M(Z,N-1)-0.001M(Z,N) + 0.001 n
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.001 |
| 0 | 0 | -0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.001 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 3
- nuclear_operator_metadata.csv · `` · line 3

**Z=50, N=66** · 保留原始数据的计算值

9.563451099999838 ± 9.716480844420989e-05 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 3 gsi:S1p 单质子分离能

从核素移走一个质子所需的能量，使用一致的原子质量约定。

用途：研究质子束缚、阈值及质子滴线附近趋势。

结合能形式

$$
10^{-3}[1B(Z,N)-1B(Z-1,N)]
$$

质量过剩等价形式

$$
-0.001M(Z,N)+0.001M(Z-1,N) + 0.001 H
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -0.001 |
| -1 | 0 | 0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |
| -1 | 0 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.001 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 5
- nuclear_operator_metadata.csv · `` · line 4

**Z=50, N=66** · 保留原始数据的计算值

9.278593059999935 ± 9.67470929795826e-05 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 4 gsi:S2n 双中子分离能

从核素移走两个中子所需的能量。

用途：沿同位素链观察平滑趋势和壳层变化，减弱部分奇偶交替。

结合能形式

$$
10^{-3}[-1B(Z,N-2)+1B(Z,N)]
$$

质量过剩等价形式

$$
0.001M(Z,N-2)-0.001M(Z,N) + 0.002 n
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.001 |
| 0 | 0 | -0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -1.0 |
| 0 | 0 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.002 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 7
- nuclear_operator_metadata.csv · `` · line 5

**Z=50, N=66** · 保留原始数据的计算值

17.10888019999993 ± 0.0001002845950283492 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 5 gsi:S2p 双质子分离能

从核素移走两个质子所需的能量。

用途：沿同中子素链比较质子结合与壳层变化。

结合能形式

$$
10^{-3}[1B(Z,N)-1B(Z-2,N)]
$$

质量过剩等价形式

$$
-0.001M(Z,N)+0.001M(Z-2,N) + 0.002 H
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -0.001 |
| -2 | 0 | 0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |
| -2 | 0 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.002 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 9
- nuclear_operator_metadata.csv · `` · line 6

**Z=50, N=66** · 保留原始数据的计算值

16.08898712000007 ± 0.00029221909588526216 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 6 gsi:D1nS1n 单中子分离能的一步中子差分

单中子分离能沿中子数方向的一步差分。

用途：定位局部斜率或曲率变化；具体方向与正负号见精确模板。

结合能形式

$$
10^{-3}[-1B(Z,N-1)+2B(Z,N)-1B(Z,N+1)]
$$

质量过剩等价形式

$$
0.001M(Z,N-1)-0.002M(Z,N)+0.001M(Z,N+1)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.001 |
| 0 | 0 | -0.002 |
| 0 | 1 | 0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 2.0 |
| 0 | 1 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 11
- nuclear_operator_metadata.csv · `` · line 7

**Z=50, N=66** · 保留原始数据的计算值

2.620369999999866 ± 0.0005199788457235544 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 7 gsi:D1nS2n 双中子分离能的一步中子差分

双中子分离能沿中子数方向的一步差分。

用途：观察两中子结合随中子数的局部变化。

结合能形式

$$
10^{-3}[1B(Z,N-2)-1B(Z,N-1)-1B(Z,N)+1B(Z,N+1)]
$$

质量过剩等价形式

$$
-0.001M(Z,N-2)+0.001M(Z,N-1)+0.001M(Z,N)-0.001M(Z,N+1)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -0.001 |
| 0 | -1 | 0.001 |
| 0 | 0 | 0.001 |
| 0 | 1 | -0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 1.0 |
| 0 | -1 | -1.0 |
| 0 | 0 | -1.0 |
| 0 | 1 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 14
- nuclear_operator_metadata.csv · `` · line 8

**Z=50, N=66** · 保留原始数据的计算值

-0.60234800000012 ± 0.0004935291278131413 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 8 gsi:D2nS2n 双中子壳隙指标

相邻双中子分离能之差。

用途：识别同位素链中的局部不连续；形变与相关能也会影响该指标。

结合能形式

$$
10^{-3}[-1B(Z,N-2)+2B(Z,N)-1B(Z,N+2)]
$$

质量过剩等价形式

$$
0.001M(Z,N-2)-0.002M(Z,N)+0.001M(Z,N+2)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.001 |
| 0 | 0 | -0.002 |
| 0 | 2 | 0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -1.0 |
| 0 | 0 | 2.0 |
| 0 | 2 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 18
- nuclear_operator_metadata.csv · `` · line 9

**Z=50, N=66** · 保留原始数据的计算值

0.8393799999998919 ± 0.0005354493440093097 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 9 gsi:D1pS1p 单质子分离能的一步质子差分

单质子分离能沿质子数方向的一步差分。

用途：比较质子方向的局部变化，核对模板中的坐标偏移。

结合能形式

$$
10^{-3}[-1B(Z+1,N)+2B(Z,N)-1B(Z-1,N)]
$$

质量过剩等价形式

$$
0.001M(Z+1,N)-0.002M(Z,N)+0.001M(Z-1,N)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | 0.001 |
| 0 | 0 | -0.002 |
| -1 | 0 | 0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | -1.0 |
| 0 | 0 | 2.0 |
| -1 | 0 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 21
- nuclear_operator_metadata.csv · `` · line 10

**Z=50, N=66** · 保留原始数据的计算值

4.876036999999997 ± 0.008439192911647417 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 10 gsi:D1pS2p 双质子分离能的一步质子差分

双质子分离能沿质子数方向的一步差分。

用途：观察两质子结合随质子数的局部变化。

结合能形式

$$
10^{-3}[1B(Z+1,N)-1B(Z,N)-1B(Z-1,N)+1B(Z-2,N)]
$$

质量过剩等价形式

$$
-0.001M(Z+1,N)+0.001M(Z,N)+0.001M(Z-1,N)-0.001M(Z-2,N)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | -0.001 |
| 0 | 0 | 0.001 |
| -1 | 0 | 0.001 |
| -2 | 0 | -0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | 0 | -1.0 |
| -2 | 0 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 24
- nuclear_operator_metadata.csv · `` · line 11

**Z=50, N=66** · 保留原始数据的计算值

-2.407838000000197 ± 0.008442067578502318 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 11 gsi:D2pS2p 双质子壳隙指标

相邻双质子分离能之差。

用途：比较同中子素链的壳层变化；不能单独当作纯单粒子能隙。

结合能形式

$$
10^{-3}[-1B(Z+2,N)+2B(Z,N)-1B(Z-2,N)]
$$

质量过剩等价形式

$$
0.001M(Z+2,N)-0.002M(Z,N)+0.001M(Z-2,N)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 2 | 0 | 0.001 |
| 0 | 0 | -0.002 |
| -2 | 0 | 0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 2 | 0 | -1.0 |
| 0 | 0 | 2.0 |
| -2 | 0 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 28
- nuclear_operator_metadata.csv · `` · line 12

**Z=50, N=66** · 保留原始数据的计算值

5.346266000000014 ± 0.018309087251963167 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 12 gsi:D2pS2n 双中子分离能的两步质子差分

双中子分离能在相隔两个质子的位置作差并归一化。

用途：研究混合质子中子质量曲率；模板中使用负二质子偏移。

结合能形式

$$
-0.25B(Z,N-2)+0.25B(Z,N)+0.25B(Z-2,N-2)-0.25B(Z-2,N)
$$

质量过剩等价形式

$$
0.25M(Z,N-2)-0.25M(Z,N)-0.25M(Z-2,N-2)+0.25M(Z-2,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.25 |
| -2 | -2 | -0.25 |
| -2 | 0 | 0.25 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -0.25 |
| 0 | 0 | 0.25 |
| -2 | -2 | 0.25 |
| -2 | 0 | -0.25 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = e，Z_filter = e。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 31
- nuclear_operator_metadata.csv · `` · line 13

**Z=50, N=66** · 保留原始数据的计算值

381.54175000000396 ± 0.09641479398930436 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 13 gsi:D1pS1n 单中子分离能的一步质子差分

单中子分离能沿质子数方向的一步差分。

用途：比较加入质子对中子结合的局部影响。

结合能形式

$$
-1B(Z,N-1)+1B(Z,N)+1B(Z-1,N-1)-1B(Z-1,N)
$$

质量过剩等价形式

$$
1M(Z,N-1)-1M(Z,N)-1M(Z-1,N-1)+1M(Z-1,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | -1 | -1.0 |
| -1 | 0 | 1.0 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |
| -1 | -1 | 1.0 |
| -1 | 0 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = o，Z_filter = o。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 35
- nuclear_operator_metadata.csv · `` · line 14

**Z=51, N=67** · 保留原始数据的计算值

484.877000000095 ± 8.973390106308763 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 14 gsi:D1pS2n 双中子分离能的一步质子差分

双中子分离能沿质子数方向的一步差分。

用途：比较质子变化对双中子结合的影响。

结合能形式

$$
-0.5B(Z,N-2)+0.5B(Z,N)+0.5B(Z-1,N-2)-0.5B(Z-1,N)
$$

质量过剩等价形式

$$
0.5M(Z,N-2)-0.5M(Z,N)-0.5M(Z-1,N-2)+0.5M(Z-1,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.5 |
| 0 | 0 | -0.5 |
| -1 | -2 | -0.5 |
| -1 | 0 | 0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -0.5 |
| 0 | 0 | 0.5 |
| -1 | -2 | 0.5 |
| -1 | 0 | -0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = e，Z_filter = o。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 39
- nuclear_operator_metadata.csv · `` · line 15

**Z=51, N=66** · 保留原始数据的计算值

334.954000000027 ± 9.05529749649342 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 15 gsi:D2pS1n 单中子分离能的两步质子差分

单中子分离能在相隔两个质子的位置作差并归一化。

用途：核对实际负二质子偏移，避免从名称误推负一偏移。

结合能形式

$$
-0.5B(Z,N-1)+0.5B(Z,N)+0.5B(Z-2,N-1)-0.5B(Z-2,N)
$$

质量过剩等价形式

$$
0.5M(Z,N-1)-0.5M(Z,N)-0.5M(Z-2,N-1)+0.5M(Z-2,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 |
| 0 | 0 | -0.5 |
| -2 | -1 | -0.5 |
| -2 | 0 | 0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -0.5 |
| 0 | 0 | 0.5 |
| -2 | -1 | 0.5 |
| -2 | 0 | -0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = o，Z_filter = e。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 43
- nuclear_operator_metadata.csv · `` · line 16

**Z=50, N=67** · 保留原始数据的计算值

401.108499999973 ± 0.43083697612902266 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 16 gsi:Gplus_2n2n2n 实现定义的 Gplus 组合

代码内明确给出的质量差分组合，名称本身不是文献定义。

用途：按本手册模板复现并比较局部结构；没有来源依据时不赋予特定文献归属。

结合能形式

$$
10^{-3}[-1B(Z,N-2)+3B(Z,N)-3B(Z,N+2)+1B(Z,N+4)]
$$

质量过剩等价形式

$$
0.001M(Z,N-2)-0.003M(Z,N)+0.003M(Z,N+2)-0.001M(Z,N+4)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.001 |
| 0 | 0 | -0.003 |
| 0 | 2 | 0.003 |
| 0 | 4 | -0.001 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -1.0 |
| 0 | 0 | 3.0 |
| 0 | 2 | -3.0 |
| 0 | 4 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 47
- nuclear_operator_metadata.csv · `` · line 17

**Z=50, N=66** · 保留原始数据的计算值

0.15741399999990335 ± 0.0017807846585143304 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 17 gsi:Gsym_2n2n2n2n 实现定义的 Gsym 组合

代码内明确给出的对称差分组合，采用实现约定。

用途：用精确模板分析局部质量结构，不声称它是已核验的标准文献指标。

结合能形式

$$
10^{-3}[0.5B(Z,N-4)-2B(Z,N-2)+3B(Z,N)-2B(Z,N+2)+0.5B(Z,N+4)]
$$

质量过剩等价形式

$$
-0.0005M(Z,N-4)+0.002M(Z,N-2)-0.003M(Z,N)+0.002M(Z,N+2)-0.0005M(Z,N+4)
$$

输出单位：MeV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -4 | -0.0005 |
| 0 | -2 | 0.002 |
| 0 | 0 | -0.003 |
| 0 | 2 | 0.002 |
| 0 | 4 | -0.0005 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -4 | 0.5 |
| 0 | -2 | -2.0 |
| 0 | 0 | 3.0 |
| 0 | 2 | -2.0 |
| 0 | 4 | 0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 51
- nuclear_operator_metadata.csv · `` · line 19

**Z=50, N=66** · 保留原始数据的计算值

0.02917599999994991 ± 0.001146961638416909 MeV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 18 gsi:V_1p1n 固定一质子一中子混合配方

以固定的一质子一中子间隔构造四质量混合差分。

用途：研究局部质子中子相关，不能把该固定模板当作全部奇偶分支都相同的一般 vpn。

结合能形式

$$
-1B(Z,N-1)+1B(Z,N)+1B(Z-1,N-1)-1B(Z-1,N)
$$

质量过剩等价形式

$$
1M(Z,N-1)-1M(Z,N)-1M(Z-1,N-1)+1M(Z-1,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | -1 | -1.0 |
| -1 | 0 | 1.0 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |
| -1 | -1 | 1.0 |
| -1 | 0 | -1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 56
- nuclear_operator_metadata.csv · `` · line 22

**Z=50, N=66** · 保留原始数据的计算值

525.5829999998678 ± 0.31652172121356853 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 19 gsi:R1D1n1p 剩余质子中子组合配方

按原配方的位移和结合能权重构造剩余相关指标。

用途：研究局部质子中子相关；必须保留系数、核素筛选和输出单位。

结合能形式

$$
0.5B(Z,N-2)-1B(Z,N-1)+0.5B(Z,N)-0.5B(Z-1,N-2)+1B(Z-1,N-1)-0.5B(Z-1,N)
$$

质量过剩等价形式

$$
-0.5M(Z,N-2)+1M(Z,N-1)-0.5M(Z,N)+0.5M(Z-1,N-2)-1M(Z-1,N-1)+0.5M(Z-1,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -0.5 |
| 0 | -1 | 1.0 |
| 0 | 0 | -0.5 |
| -1 | -2 | 0.5 |
| -1 | -1 | -1.0 |
| -1 | 0 | 0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.5 |
| 0 | -1 | -1.0 |
| 0 | 0 | 0.5 |
| -1 | -2 | -0.5 |
| -1 | -1 | 1.0 |
| -1 | 0 | -0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 60
- nuclear_operator_metadata.csv · `` · line 23

**Z=50, N=66** · 保留原始数据的计算值

127.0779999999213 ± 0.31970650603326795 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 20 gsi:R2D1n1p 剩余质子中子组合配方

按原配方的位移和结合能权重构造剩余相关指标。

用途：研究局部质子中子相关；必须保留系数、核素筛选和输出单位。

结合能形式

$$
-1B(Z,N-1)+1B(Z,N)+0.25B(Z-1,N-3)+0.75B(Z-1,N-1)-1B(Z-1,N)-0.25B(Z-3,N-3)+0.25B(Z-3,N-1)
$$

质量过剩等价形式

$$
1M(Z,N-1)-1M(Z,N)-0.25M(Z-1,N-3)-0.75M(Z-1,N-1)+1M(Z-1,N)+0.25M(Z-3,N-3)-0.25M(Z-3,N-1)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 1.0 |
| 0 | 0 | -1.0 |
| -1 | -3 | -0.25 |
| -1 | -1 | -0.75 |
| -1 | 0 | 1.0 |
| -3 | -3 | 0.25 |
| -3 | -1 | -0.25 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -1.0 |
| 0 | 0 | 1.0 |
| -1 | -3 | 0.25 |
| -1 | -1 | 0.75 |
| -1 | 0 | -1.0 |
| -3 | -3 | -0.25 |
| -3 | -1 | 0.25 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = o，Z_filter = o。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 66
- nuclear_operator_metadata.csv · `` · line 25

**Z=51, N=67** · 保留原始数据的计算值

103.33525000009104 ± 8.973651308831872 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 21 gsi:Pgap3N_even 三点中子配对配方

按所列权重计算三点差分，并在比较流程中应用指定的奇偶筛选。

用途：比较奇偶交替，保留 even 或 odd 分支；筛选不是对结果取绝对值。

结合能形式

$$
-0.5B(Z,N-1)+1B(Z,N)-0.5B(Z,N+1)
$$

质量过剩等价形式

$$
0.5M(Z,N-1)-1M(Z,N)+0.5M(Z,N+1)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 |
| 0 | 0 | -1.0 |
| 0 | 1 | 0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -0.5 |
| 0 | 0 | 1.0 |
| 0 | 1 | -0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = e，Z_filter = e。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 73
- nuclear_operator_metadata.csv · `` · line 27

**Z=50, N=66** · 保留原始数据的计算值

1310.1849999999395 ± 0.25998942286177723 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 22 gsi:Pgap3N_odd 三点中子配对配方

按所列权重计算三点差分，并在比较流程中应用指定的奇偶筛选。

用途：比较奇偶交替，保留 even 或 odd 分支；筛选不是对结果取绝对值。

结合能形式

$$
0.5B(Z,N-1)-1B(Z,N)+0.5B(Z,N+1)
$$

质量过剩等价形式

$$
-0.5M(Z,N-1)+1M(Z,N)-0.5M(Z,N+1)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -0.5 |
| 0 | 0 | 1.0 |
| 0 | 1 | -0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.5 |
| 0 | 0 | -1.0 |
| 0 | 1 | 0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = o，Z_filter = o。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 76
- nuclear_operator_metadata.csv · `` · line 29

**Z=51, N=67** · 保留原始数据的计算值

1061.3474999999744 ± 6.255797251350143 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 23 gsi:Pgap3Z_even 三点质子配对配方

按所列权重计算三点差分，并在比较流程中应用指定的奇偶筛选。

用途：比较奇偶交替，保留 even 或 odd 分支；筛选不是对结果取绝对值。

结合能形式

$$
-0.5B(Z+1,N)+1B(Z,N)-0.5B(Z-1,N)
$$

质量过剩等价形式

$$
0.5M(Z+1,N)-1M(Z,N)+0.5M(Z-1,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | 0.5 |
| 0 | 0 | -1.0 |
| -1 | 0 | 0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | -0.5 |
| 0 | 0 | 1.0 |
| -1 | 0 | -0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = e，Z_filter = e。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 79
- nuclear_operator_metadata.csv · `` · line 31

**Z=50, N=66** · 保留原始数据的计算值

2438.0185000000056 ± 4.219596455823708 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 24 gsi:Pgap3Z_odd 三点质子配对配方

按所列权重计算三点差分，并在比较流程中应用指定的奇偶筛选。

用途：比较奇偶交替，保留 even 或 odd 分支；筛选不是对结果取绝对值。

结合能形式

$$
0.5B(Z+1,N)-1B(Z,N)+0.5B(Z-1,N)
$$

质量过剩等价形式

$$
-0.5M(Z+1,N)+1M(Z,N)-0.5M(Z-1,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | -0.5 |
| 0 | 0 | 1.0 |
| -1 | 0 | -0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | 0 | 0.5 |
| 0 | 0 | -1.0 |
| -1 | 0 | 0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = o，Z_filter = o。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 82
- nuclear_operator_metadata.csv · `` · line 33

**Z=51, N=67** · 保留原始数据的计算值

793.9364999999525 ± 4.732536238635685 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 25 gsi:W1 旧配方的维格纳型组合

按本条给出的结合能权重构造尖点或对称组合。

用途：比较局部结构时明确 W 配方版本，不与共享 wig 或其他 W 指标混同。

结合能形式

$$
-0.25B(Z,N-2)+0.375B(Z,N)-0.125B(Z,N+2)+0.375B(Z-2,N-2)-0.5B(Z-2,N)+0.125B(Z-2,N+2)-0.125B(Z-4,N-2)+0.125B(Z-4,N)
$$

质量过剩等价形式

$$
0.25M(Z,N-2)-0.375M(Z,N)+0.125M(Z,N+2)-0.375M(Z-2,N-2)+0.5M(Z-2,N)-0.125M(Z-2,N+2)+0.125M(Z-4,N-2)-0.125M(Z-4,N)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | 0.25 |
| 0 | 0 | -0.375 |
| 0 | 2 | 0.125 |
| -2 | -2 | -0.375 |
| -2 | 0 | 0.5 |
| -2 | 2 | -0.125 |
| -4 | -2 | 0.125 |
| -4 | 0 | -0.125 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -2 | -0.25 |
| 0 | 0 | 0.375 |
| 0 | 2 | -0.125 |
| -2 | -2 | 0.375 |
| -2 | 0 | -0.5 |
| -2 | 2 | 0.125 |
| -4 | -2 | -0.125 |
| -4 | 0 | 0.125 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 85
- nuclear_operator_metadata.csv · `` · line 35

**Z=50, N=66** · 保留原始数据的计算值

21.63537499999802 ± 0.841936801740487 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 26 gsi:W2 旧配方的维格纳型组合

按本条给出的结合能权重构造尖点或对称组合。

用途：比较局部结构时明确 W 配方版本，不与共享 wig 或其他 W 指标混同。

结合能形式

$$
-0.125B(Z+1,N-1)+0.125B(Z+1,N+1)-0.125B(Z-1,N-3)+0.5B(Z-1,N-1)-0.375B(Z-1,N+1)+0.125B(Z-3,N-3)-0.375B(Z-3,N-1)+0.25B(Z-3,N+1)
$$

质量过剩等价形式

$$
0.125M(Z+1,N-1)-0.125M(Z+1,N+1)+0.125M(Z-1,N-3)-0.5M(Z-1,N-1)+0.375M(Z-1,N+1)-0.125M(Z-3,N-3)+0.375M(Z-3,N-1)-0.25M(Z-3,N+1)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | -1 | 0.125 |
| 1 | 1 | -0.125 |
| -1 | -3 | 0.125 |
| -1 | -1 | -0.5 |
| -1 | 1 | 0.375 |
| -3 | -3 | -0.125 |
| -3 | -1 | 0.375 |
| -3 | 1 | -0.25 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 1 | -1 | -0.125 |
| 1 | 1 | 0.125 |
| -1 | -3 | -0.125 |
| -1 | -1 | 0.5 |
| -1 | 1 | -0.375 |
| -3 | -3 | 0.125 |
| -3 | -1 | -0.375 |
| -3 | 1 | 0.25 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 93
- nuclear_operator_metadata.csv · `` · line 36

**Z=50, N=66** · 保留原始数据的计算值

35.21899999995367 ± 1.7382872542031136 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 27 gsi:W3 旧配方的维格纳型组合

按本条给出的结合能权重构造尖点或对称组合。

用途：比较局部结构时明确 W 配方版本，不与共享 wig 或其他 W 指标混同。

结合能形式

$$
-0.25B(Z,N-1)+0.25B(Z,N+1)-0.25B(Z-1,N-2)-0.5B(Z-1,N-1)+0.25B(Z-1,N)+0.5B(Z-1,N+1)+0.25B(Z-2,N-1)-0.25B(Z-2,N+1)+0.25B(Z-3,N-2)+0.5B(Z-3,N-1)-0.25B(Z-3,N)-0.5B(Z-3,N+1)
$$

质量过剩等价形式

$$
0.25M(Z,N-1)-0.25M(Z,N+1)+0.25M(Z-1,N-2)+0.5M(Z-1,N-1)-0.25M(Z-1,N)-0.5M(Z-1,N+1)-0.25M(Z-2,N-1)+0.25M(Z-2,N+1)-0.25M(Z-3,N-2)-0.5M(Z-3,N-1)+0.25M(Z-3,N)+0.5M(Z-3,N+1)
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | 0.25 |
| 0 | 1 | -0.25 |
| -1 | -2 | 0.25 |
| -1 | -1 | 0.5 |
| -1 | 0 | -0.25 |
| -1 | 1 | -0.5 |
| -2 | -1 | -0.25 |
| -2 | 1 | 0.25 |
| -3 | -2 | -0.25 |
| -3 | -1 | -0.5 |
| -3 | 0 | 0.25 |
| -3 | 1 | 0.5 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | -1 | -0.25 |
| 0 | 1 | 0.25 |
| -1 | -2 | -0.25 |
| -1 | -1 | -0.5 |
| -1 | 0 | 0.25 |
| -1 | 1 | 0.5 |
| -2 | -1 | 0.25 |
| -2 | 1 | -0.25 |
| -3 | -2 | 0.25 |
| -3 | -1 | 0.5 |
| -3 | 0 | -0.25 |
| -3 | 1 | -0.5 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | 0.0 |
| n | 0.0 |

offset_latex:

$$
0
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 101
- nuclear_operator_metadata.csv · `` · line 37

**Z=50, N=66** · 保留原始数据的计算值

1336.5740000000224 ± 4.919423759445816 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

## 28 gsi:Qec 电子俘获质量差

母核与电子俘获子核的中性原子质量差。

用途：确定总能量余量；实际中微子能量还需减去电子空穴、子核激发和反冲能。

结合能形式

$$
-1B(Z,N)+1B(Z-1,N+1)-782.34704
$$

质量过剩等价形式

$$
1M(Z,N)-1M(Z-1,N+1) + -1 H + 1 n -782.34704
$$

输出单位：keV

精确模板 `terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | 1.0 |
| -1 | 1 | -1.0 |

精确模板 `be_terms`

| ΔZ | ΔN | 系数 |
| ---: | ---: | ---: |
| 0 | 0 | -1.0 |
| -1 | 1 | 1.0 |

精确模板 `light_terms`

| 粒子 | 系数 |
| --- | ---: |
| H | -1.0 |
| n | 1.0 |

offset_latex:

$$
-782.34704
$$


奇偶筛选：N_filter = oe，Z_filter = oe。e 表示偶数，o 表示奇数，oe 表示二者；comparison 在计算之后筛选，apply_energy_operator 本身不做这一筛选。

- nuclear.py · `operator_catalog / apply_energy_operator / comparison` · line 147
- nuclear_operator_weights.csv · `` · line 113
- nuclear_operator_metadata.csv · `` · line 38

**Z=50, N=66** · 保留原始数据的计算值

-3276.220999999881 ± 0.24003333101883997 keV

重算值与评价值及其误差分开列出，保留来源舍入差异。完整原始输入、标记与哈希见 inventory-delivery.json 中该条目的 worked_example。

误差说明：结合重复原始质量后使用所声明的协方差近似。若配方只有单个质量边际误差，不能由此恢复完整 AME 评价协方差。

# 数据链接与文献来源

以下记录区分原始数据表、论文定义、历史评价与代码约定。下载日期不等于评价日期；在线现行版本不必与本地固定快照相同。完整 URL、校验值、检索状态和限制见同目录 sources.json 与 inventory-delivery.json。

## ame2020

W. J. Huang et al., Chinese Physics C 45, 030002 (2021); M. Wang et al., Chinese Physics C 45, 030003 (2021).

评价或版本日期：2020

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/abddaf)
- DOI [10.1088/1674-1137/abddb0](https://doi.org/10.1088/1674-1137/abddb0)
- DOI [10.1088/1674-1137/abddaf](https://doi.org/10.1088/1674-1137/abddaf)
- [mass_1.mas20.txt](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)
- [rct1.mas20.txt](https://www-nds.iaea.org/amdc/ame2020/rct1.mas20.txt)
- [rct2_1.mas20.txt](https://www-nds.iaea.org/amdc/ame2020/rct2_1.mas20.txt)

## ame2016

W. J. Huang et al., Chinese Physics C 41, 030002 (2017); M. Wang et al., Chinese Physics C 41, 030003 (2017).

评价或版本日期：2016

原始数值取得日期：2026-10-23T02:53:19.900902Z

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/41/3/030002)
- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/41/3/030003)
- [actual recorded numerical source](https://www-nds.iaea.org/amdc/ame2016/mass16.txt)
- DOI [10.1088/1674-1137/41/3/030002](https://doi.org/10.1088/1674-1137/41/3/030002)
- DOI [10.1088/1674-1137/41/3/030003](https://doi.org/10.1088/1674-1137/41/3/030003)

## ame2012

G. Audi et al., Chinese Physics C 36, 1287–1602 (2012); M. Wang et al., Chinese Physics C 36, 1603–2014 (2012).

评价或版本日期：2012

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/36/12/002)
- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/36/12/003)
- [actual recorded numerical source](https://amdc.impcas.ac.cn/masstables/Ame2012/mass.mas12)
- DOI [10.1088/1674-1137/36/12/002](https://doi.org/10.1088/1674-1137/36/12/002)
- DOI [10.1088/1674-1137/36/12/003](https://doi.org/10.1088/1674-1137/36/12/003)

## ame2003

A. H. Wapstra, G. Audi and C. Thibault, Nuclear Physics A 729, 129–336 (2003); G. Audi, A. H. Wapstra and C. Thibault, Nuclear Physics A 729, 337–676 (2003).

评价或版本日期：2003

原始数值取得日期：2026-10-23T02:53:22.411179Z

- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- [actual recorded numerical source](https://amdc.impcas.ac.cn/masstables/Ame2003/mass.mas03)
- DOI [10.1016/j.nuclphysa.2003.11.002](https://doi.org/10.1016/j.nuclphysa.2003.11.002)
- DOI [10.1016/j.nuclphysa.2003.11.003](https://doi.org/10.1016/j.nuclphysa.2003.11.003)

## ame1995

G. Audi and A. H. Wapstra, Nuclear Physics A 595, 409–480 (1995).

评价或版本日期：1995

原始数值取得日期：2026-10-23T02:53:27.079438Z

- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- [actual recorded numerical source](https://amdc.impcas.ac.cn/masstables/Ame1995/mass_rmd.mas95)
- DOI [10.1016/0375-9474(95)00445-9](https://doi.org/10.1016/0375-9474(95)00445-9)

## nubase2020

F. G. Kondev, M. Wang, W. J. Huang, S. Naimi and G. Audi, Chinese Physics C 45, 030001 (2021).

评价或版本日期：2020

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/abddae)
- [primary metadata/reference](https://www-nds.iaea.org/amdc/)
- DOI [10.1088/1674-1137/abddae](https://doi.org/10.1088/1674-1137/abddae)

## nubase2016

G. Audi, F. G. Kondev, M. Wang, W. J. Huang and S. Naimi, Chinese Physics C 41, 030001 (2017).

评价或版本日期：2016

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/41/3/030001)
- DOI [10.1088/1674-1137/41/3/030001](https://doi.org/10.1088/1674-1137/41/3/030001)

## nubase2012

G. Audi et al., Chinese Physics C 36, 1157–1286 (2012).

评价或版本日期：2012

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://cpc.ihep.ac.cn/article/doi/10.1088/1674-1137/36/12/001)
- DOI [10.1088/1674-1137/36/12/001](https://doi.org/10.1088/1674-1137/36/12/001)

## nubase2003

G. Audi, O. Bersillon, J. Blachot and A. H. Wapstra, Nuclear Physics A 729, 3–128 (2003).

评价或版本日期：2003

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://amdc.impcas.ac.cn/nubase/nubase2003/nubtab03.asc)
- DOI [10.1016/j.nuclphysa.2003.11.001](https://doi.org/10.1016/j.nuclphysa.2003.11.001)

## nubase1997

G. Audi, O. Bersillon, J. Blachot and A. H. Wapstra, Nuclear Physics A 624, 1–124 (1997).

评价或版本日期：1997

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://www.sciencedirect.com/science/article/pii/S037594749700482X)
- DOI [10.1016/S0375-9474(97)00482-X](https://doi.org/10.1016/S0375-9474(97)00482-X)

## angeli-marinova-2013

I. Angeli and K. P. Marinova, Atomic Data and Nuclear Data Tables 99, 69–95 (2013).

评价或版本日期：2013

原始数值取得日期：2026-10-23

- [primary metadata/reference](https://www-nds.iaea.org/radii/)
- DOI [10.1016/j.adt.2011.12.006](https://doi.org/10.1016/j.adt.2011.12.006)

## livechart

International Atomic Energy Agency Nuclear Data Section, LiveChart Data Download API, v1 (v0 alias), official API guide.

评价或版本日期：Field-dependent; guide identifies ENSDF April 2022 snapshot plus AME2020/NUBASE2020 and named radii/moment evaluations

原始数值取得日期：2026-10-23

- [primary metadata/reference](https://www-nds.iaea.org/relnsd/vcharthtml/api_v0_guide.html)
- [primary metadata/reference](https://nds.iaea.org/relnsd/v1/data)

## stone-long-lived

N. J. Stone, IAEA INDC(NDS)-0794 (November 2019).

评价或版本日期：2019-11

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://nds.iaea.org/records/x2773-kj397)
- DOI [10.61092/iaea.yjpc-cns6](https://doi.org/10.61092/iaea.yjpc-cns6)

## stone-short-lived

N. J. Stone, IAEA INDC(NDS)-0816 (September 2020).

评价或版本日期：2020-09

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://nds.iaea.org/records/5g7ec-evw90)
- DOI [10.61092/iaea.1p48-p6c6](https://doi.org/10.61092/iaea.1p48-p6c6)

## stone-quadrupole

N. J. Stone, IAEA INDC(NDS)-0833.

评价或版本日期：未记录

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://nds.iaea.org/records/xk3d8-tw250)

## be2

B. Pritychenko, M. Birch, B. Singh and M. Horoi, Atomic Data and Nuclear Data Tables 107, 1–139 (2016); erratum 114, 371–374 (2017).

评价或版本日期：2016

原始数值取得日期：2026-10-23T02:53:18.448505Z

- [primary metadata/reference](https://www.nndc.bnl.gov/be2/)
- [primary metadata/reference](https://www.nndc.bnl.gov/be2/help.html)
- [primary metadata/reference](https://arxiv.org/abs/1312.5975)
- [actual source JSON distribution](https://www.nndc.bnl.gov/be2/data/adopted-entries.json)
- DOI [10.1016/j.adt.2015.10.001](https://doi.org/10.1016/j.adt.2015.10.001)
- DOI [10.1016/j.adt.2016.08.002](https://doi.org/10.1016/j.adt.2016.08.002)

## be2-raman2001

S. Raman, C. W. Nestor Jr. and P. Tikkanen, Atomic Data and Nuclear Data Tables 78, 1–128 (2001).

评价或版本日期：2001

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://www.nndc.bnl.gov/be2/)
- DOI [10.1006/adnd.2001.0858](https://doi.org/10.1006/adnd.2001.0858)

## codata2018

NIST, Fundamental Physical Constants, 2018 CODATA adjustment, extensive listing.

评价或版本日期：2018

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://physics.nist.gov/cuu/pdf/all_2018.pdf)

## codata2022

NIST, Fundamental Physical Constants, 2022 CODATA adjustment, complete listing.

评价或版本日期：2022

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://physics.nist.gov/cuu/Constants/Table/allascii.txt)

## delta-vpn-zhang1989

J.-Y. Zhang, R. F. Casten and D. S. Brenner, Physics Letters B 227, 1–5 (1989).

评价或版本日期：1989

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://www.sciencedirect.com/science/article/pii/0370269389912732/pdf)
- DOI [10.1016/0370-2693(89)91273-2](https://doi.org/10.1016/0370-2693(89)91273-2)

## delta-vpn-cakirli2005

R. B. Cakirli, D. S. Brenner, R. F. Casten and E. A. Millman, Physical Review Letters 94, 092501 (2005).

评价或版本日期：2005

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.94.092501)
- DOI [10.1103/PhysRevLett.94.092501](https://doi.org/10.1103/PhysRevLett.94.092501)

## delta-vpn-cakirli2005-erratum

R. B. Cakirli, D. S. Brenner, R. F. Casten and E. A. Millman, Physical Review Letters 95, 119903 (2005).

评价或版本日期：2005

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.95.119903)
- DOI [10.1103/PhysRevLett.95.119903](https://doi.org/10.1103/PhysRevLett.95.119903)

## pairing-context-satula1998

W. Satuła, J. Dobaczewski and W. Nazarewicz, Physical Review Letters 81, 3599–3602 (1998).

评价或版本日期：1998

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [primary metadata/reference](https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.81.3599)
- DOI [10.1103/PhysRevLett.81.3599](https://doi.org/10.1103/PhysRevLett.81.3599)

## frdm1995

P. Möller, J.R. Nix, W.D. Myers, W.J. Swiatecki, At. Data Nucl. Data Tables 59, 185 (1995)

评价或版本日期：1992 calculation, 1995 publication

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1006/adnd.1995.1002)
- [verified primary alternative metadata](https://arxiv.org/abs/nucl-th/9308022)
- DOI [10.1006/adnd.1995.1002](https://doi.org/10.1006/adnd.1995.1002)

## frdm2012

P. Möller, A.J. Sierk, T. Ichikawa, H. Sagawa, At. Data Nucl. Data Tables 109–110, 1–204 (2016)

评价或版本日期：2012 model, 2016 publication

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1016/j.adt.2015.10.002)
- [verified primary alternative metadata](https://arxiv.org/abs/1508.06294)
- DOI [10.1016/j.adt.2015.10.002](https://doi.org/10.1016/j.adt.2015.10.002)

## hfb17

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. Lett. 102, 152503 (2009)

评价或版本日期：2009

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevLett.102.152503)
- DOI [10.1103/PhysRevLett.102.152503](https://doi.org/10.1103/PhysRevLett.102.152503)

## hfbd1m

S. Goriely, S. Hilaire, M. Girod, S. Péru, Phys. Rev. Lett. 102, 242501 (2009)

评价或版本日期：2009

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevLett.102.242501)
- DOI [10.1103/PhysRevLett.102.242501](https://doi.org/10.1103/PhysRevLett.102.242501)

## hfb14

S. Goriely et al., Phys. Rev. C 75, 064312 (2007)

评价或版本日期：2007

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevC.75.064312)
- [recorded source table](https://www.astro.ulb.ac.be/Nucdata/Masses/hfb14-plain)
- DOI [10.1103/PhysRevC.75.064312](https://doi.org/10.1103/PhysRevC.75.064312)

## hfb24

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)

评价或版本日期：2013

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevC.88.024308)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb24-dat)
- DOI [10.1103/PhysRevC.88.024308](https://doi.org/10.1103/PhysRevC.88.024308)

## bskg3

G. Grams et al., Eur. Phys. J. A 59, 270 (2023)

评价或版本日期：2023

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1140/epja/s10050-023-01158-6)
- [verified primary alternative metadata](https://arxiv.org/abs/2307.14276)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/bskg03-dat)
- DOI [10.1140/epja/s10050-023-01158-6](https://doi.org/10.1140/epja/s10050-023-01158-6)

## hfb21

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 82, 035804 (2010)

评价或版本日期：2010

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevC.82.035804)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb21-dat)
- DOI [10.1103/PhysRevC.82.035804](https://doi.org/10.1103/PhysRevC.82.035804)

## hfb25

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)

评价或版本日期：2013

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevC.88.024308)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb25-dat)
- DOI [10.1103/PhysRevC.88.024308](https://doi.org/10.1103/PhysRevC.88.024308)

## hfb26

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 024308 (2013)

评价或版本日期：2013

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevC.88.024308)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb26-dat)
- DOI [10.1103/PhysRevC.88.024308](https://doi.org/10.1103/PhysRevC.88.024308)

## hfb27

S. Goriely, N. Chamel, J.M. Pearson, Phys. Rev. C 88, 061302(R) (2013)

评价或版本日期：2013

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1103/PhysRevC.88.061302)
- [recorded source table](https://www.astro.ulb.ac.be/bruslib/nucdata/hfb27-dat)
- DOI [10.1103/PhysRevC.88.061302](https://doi.org/10.1103/PhysRevC.88.061302)

## ktuy05

H. Koura, T. Tachibana, M. Uno, M. Yamada, Prog. Theor. Phys. 113, 305–325 (2005)

评价或版本日期：2005; fitted to AME2003

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1143/PTP.113.305)
- [verified primary alternative metadata](https://academic.oup.com/ptp/issue/113/2)
- [recorded source table](https://wwwndc.jaea.go.jp/nucldata/mass/KTUY05_m246.dat)
- DOI [10.1143/PTP.113.305](https://doi.org/10.1143/PTP.113.305)

## ws4

N. Wang, M. Liu, X. Wu, J. Meng, Phys. Lett. B 734, 215–219 (2014)

评价或版本日期：2014-June-3 author-labelled table

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1016/j.physletb.2014.05.049)
- [verified primary alternative metadata](https://arxiv.org/abs/1405.2616)
- [recorded source table](http://www.imqmd.com/mass/)
- DOI [10.1016/j.physletb.2014.05.049](https://doi.org/10.1016/j.physletb.2014.05.049)

## ws4rbf

WS4: N. Wang et al., Phys. Lett. B 734, 215–219 (2014); RBF method: N. Wang, M. Liu, Phys. Rev. C 84, 051303(R) (2011)

评价或版本日期：2014-June-3 author-labelled table; RBF method 2011

原始数值取得日期：未记录，不能把本次链接检查日期当成数据取得日期

- [model paper](https://doi.org/10.1016/j.physletb.2014.05.049)
- [verified primary alternative metadata](https://journals.aps.org/prc/abstract/10.1103/PhysRevC.84.051303)
- [recorded source table](http://www.imqmd.com/mass/)
- DOI [10.1016/j.physletb.2014.05.049](https://doi.org/10.1016/j.physletb.2014.05.049)
- DOI [10.1103/PhysRevC.84.051303](https://doi.org/10.1103/PhysRevC.84.051303)

# 单独程序与源文件索引

在 GUI 项目目录运行下列入口；这些命令由清单记录，没有在本次文档生成时执行。每个科学文件的完整哈希与行号保留在 inventory-delivery.json，避免把文档生成误写成新的科学或原生 GUI 验收。

```sh
./Run_private.command -m traplab_nuclear quantity 116Sn s2n --format csv
```

```sh
./Run_private.command traplab.py gui --page mass_landscape --standalone
```

```sh
./Run_private.command traplab.py gui --page nuclear_chart --standalone
```

```sh
./Run_private.command traplab.py gui --page mass_workbench --standalone
```

```sh
./Run_private.command apps/ame_nubase.py --quantity s2n --z 50 --minimum 60 --maximum 74
```

```sh
./Run_private.command apps/mulberry_mass.py --quantity s2n --z 50 --minimum 60 --maximum 74
```

```sh
./Run_private.command scripts/plot_mass_workbench.py --input private_examples/mass_workbench_v2/116Sn_ME.csv --quantity s2n --z 50 --minimum 60 --maximum 74 --models ws4rbf frdm2012 --output outputs/mass_workbench/FRESH_RUN_NAME --formats png pdf svg
```

```sh
from gsi_mrtof.science import nuclear_mass_operator; nuclear_mass_operator(records,z,n,[(dN,dZ,coefficient),...],offset_keV=0,covariance=None)
```

```sh
from gsi_mrtof.nuclear import apply_energy_operator; result=apply_energy_operator('R1D1n1p',table,be_unit='keV',covariance=None)
```

```sh
./Run_private.command -m gsi_mrtof run ame_analysis --inputs @PATH_TO_INPUTS_JSON
```

```sh
const P=require('./static/js/physics.js'),S=require('./static/js/mass-surface.js'); const {derive}=S.create(getter,{MEn,MEH,MEa,MEd},betaLookup,evaluatedLookup); derive(Z,N,'ame').s2n;
```

- energies.py · `8a8e6ad37aec99fabf5a5d87f5ec3ab70dc998589e990ba8ff7dc74191377677`
- constants.py · `76c6d2fe38d002795b2ff4997b1850fe125ad35bcb13aca8d6152c34194c37e3`
- models.py · `e6cc878e85d0bbdaf38fbe65da97776fe7b9dda802cb1c8b8ef0a33c28dc3c0f`
- service.py · `d1578556ae15e80f6ef3a325a1ddd0af52260a46c6644208c10bdfe87be8eb03`
- decay.py · `44337db5aa71ec5c0b3f11750673e57ef0ed1045dcfabc61b948926bd849e2a6`
- __main__.py · `4d66bd55cb44e79b39a2df3994907e268546e510583c40d6a1211ac191854c08`
- nuclear_reference.py · `e92474c8cf387d607fcfb7404fbc3065bd2326e4dd05be23b095c9328bf2556d`
- physics.py · `ed1487953b7e3998bbb6d00a6952b8fe54d9bbfd4d2c1d81b3a8d97e26ee15cd`
- mass_workbench.py · `384516621386296cb0739d796ea6d3a7ce32ec67479c4053ecc31ce893b8977c`
- mass_landscape.py · `51b25b54eca939360911ae571572f99ce62b7a4f778229e364189542386a806a`
- nuclear_chart.py · `b5247847f7836fe80e6292a2b4bc3fa7c4008ae9cd9d1dfda90fae38b9f772c4`
- mass_tools.py · `9a87d2f3d46a816a32a90687b3cd83fc3af3ad71a0654b4dd0a7d3d1be62604e`
- mass_workbench_ui.py · `3f03ecf297f24db5fff2c99bc3d51ebd3f7029d6e8f5012686e31b4e3aa0b78f`
- plot_mass_workbench.py · `caacefbba4df1eda7887b75f33e2bd1bf491b58b5066cf2fcc1cbfaf6a42b6f9`
- ame_nubase.py · `4fae5f046e983f4dfee8f765848127663811c70d0faef80c75d4a91df6dde1a4`
- mulberry_mass.py · `b9cfa27bf5ba371d891deb24148b80653c7731b1e26f0ca8533166c52d41f157`
- run_individual.py · `e1edc328dd460b0267498165827a3934690ad57ec60fea40c54d8e2e7846804a`
- nuclear.py · `721f27ce9a6a1d44af4d7e25bb7a285a10b73f03967ad04b8473dd4b07a5116b`
- science.py · `7988e5dbebdd7e5e9d0e33db2a9a138a1555d80d79b72f71d0e24164c75becb1`
- __main__.py · `31fc3c5fa727f82c7ed0c53b17feb4b28b06f75a0a3743f7c5332d9096757490`
- nuclear_operator_metadata.csv · `e7ac96558532287f83f84f145e2196f72129db10fe6574d29eec3abec52138af`
- nuclear_operator_weights.csv · `50691edddf6b7b1c8b9207ca281c719769c155468a1bb04b9b94e1b71dfc6865`
- NUCLEAR_REFERENCE_EN.md · `e8f684dc1273542210fbb9450ba1bcd0b24670788d2a375d9e3fc915471c9228`
- NUCLEAR_DATA_EN.md · `7c32914782e2b39bc0d008b865c95f67f6a6552ce4fab02cdf286adda03395a9`
- MASS_WORKBENCH_EN.md · `280072337fe3aed9eb9624e35cd2d76a068199c3a738144136b8fedb6c54772e`
- AME_MULBERRY_FEATURE_REVIEW_EN.md · `28fa3b49ccde73f90cc08299093a5d221d6db39962dd539c040120a13acd9e96`
- mass-surface.js · `0563dd3aa7ba2633d9867051dc4035db91195bd736106926ad3fc0963bdb8fcc`
- physics.js · `7bdf10025e7571b1dea722c2407305f2c2332a24cdcc184baaec317087c0746a`
- ame-evaluated.js · `e4fc2de8ef689dd32765e4c2ad2bfe86081c713179ce89e65c9e5f0deda70cfd`
- nuclide-chart.js · `7ea908222322320624d4e2c2b277d3cb23c5292fe6a2180afe03d0ac91870bd5`
- mass-quantity-menu.js · `68654dd057ac856e1caf35b8e35bb1be52be1eb49677c2885be22f12226f69ad`
- measured-masses.js · `730f1daed0677af8848b09c05d3bf709b42db0d2d3310e9a435c9c51409158c0`
- ame2020_reference.csv · `f8cddd5544c1d7fa3f56213c58b3bde1d1e6cc7ec3c69e8b7933bfdb1612fca8`
- ame2020_reference_metadata.csv · `df9652aa9e6985686583eb3782bd568232356c8fbaace073778986d4cc5c448f`
- index.json · `71338c7c73837caa9b24092d43d93707ffa3b287302ae9d76162e5386c2ff834`
- ame2020-reactions.json · `902d19a60e7b42772044c06c2277615d9f7f9cbb90454baa85ebff2535b48ffc`
- chart-typed-data.js · `bb9aef72fbef7ef49817aee63e6b0882c869b63c4cc1f600195d85803e0208bc`
- measured-masses-ui.js · `e698b612fa6c5343d1a56b81d4e9f8c915f383022314868ccc1955cefd685046`
- nuclide_chart_labels.yaml · `f193f37649fb262df9d6ea92fd41b4a51eacbcef35ad01420e8e7e7b5aecfe28`
- nuclide-chart.html · `49904708401e5c3b12416314c5aee21bb7cb6943eb0c0637aa35b140911e3ba2`
- chart_typed_data.test.cjs · `e0553c10c99e76d72ee75fa8f65468d12dd9d6d872de902d7810156eb9988a3b`
- measured_mass_ui.test.cjs · `35f4330dffdee8dcbb863fee2b1916ddfc2bb34f7a80c402748c30e6dcd9ff5e`
- chart_controls.test.cjs · `7ace99cded8be5a33c83f3c19692878dab005b271e22e819e8ed35635b9a4dc8`
- test_chart_script_dependencies.py · `226d42e1744cc6587f3133e5781030c3dc2203b9b9c0a9db537e63475ef0820b`

# 修改 复现与证据边界

公式、模板、单位或来源发生变化时，应先更新机器可读清单并运行原有科学回归，再重新构建本手册。不能为了通过测试而放宽独立参考容差。数据来源或误差模型不同的结果可以不同，应保留差异及原因。完整源文件 SHA256 记录在 inventory-delivery.json；本次生成文件的 SHA256 和命令返回值记录在 build-validation.json。

本次只构建私人 Markdown 与 Word 文档。公式为可编辑的 Word OMML，不是图片。依据所有者的明确规则，没有创建或保存手册页面截图。OOXML 结构、数学标记及可选矢量 PDF 的文字和页面边界核查，不等同于 Word 中逐页目视排版验收。科学数据核查、浏览器交互、下载、在线部署、Qt、Windows 与硬件验收各自独立。

## 复用的双语说明

- AME audit
- Mass workbench
- Nuclear reference
