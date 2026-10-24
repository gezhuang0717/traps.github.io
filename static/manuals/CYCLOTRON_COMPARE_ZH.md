---
title: 回旋频率比较操作手册
author: TrapLab documentation
date: 2026-10-24
documentclass: revtex4-2
classoption: [aps, onecolumn, 11pt]
---

既有 Lab 回旋计算器可在同一个磁场下比较一到十个明确指定的离子或同位素分子。每行保留自己的质量约定、不确定度和来源。本工具计算自由回旋频率，不拟合共振、不标定磁场，也不推断未知的原子组成。

## 网页中比较两种离子

1. 打开 Lab 的回旋计算器，首次比较保留 $B=7$ T。磁场不确定度留空表示未知；仅当明确将磁场视为固定量时才填写零。
2. 第一行输入 `133Cs` 并选择评价质量，添加第二行 `85Rb`。电荷留空时读取名称中的电荷或采用默认 $+1$，也可显式填写一致的非零整数。
3. 为获得可重复的离线比较，选择保存的 AME2020 与 NUBASE2020，然后点击计算全部行。各行应显示 Hz 频率、电荷、离子质量，以及已知不确定度或明确的未知状态。7 T 下 Cs 频率约为 0.81 MHz；此值仅作量级检查，实际记录应使用计算结果的完整精度。
4. 展开每行来源，核对评价版本、核态标识、来源路径类型和质量不确定度。优先在线模式可明确回退到保存的 2020 版；仅在线模式在请求失败时报告错误。
5. 保存全部行 JSON 并下载结果 CSV。改变一行后，旧结果应被标为需要重新计算。重新加载 JSON，核对重新计算的结果与来源。文件位于浏览器设置指定的下载位置。

最多可添加十行，至少保留一行。字段修改会使受影响的结果失效；新输入会取消旧的异步填充。改变输入后，不能在重新计算前复制旧结果。

## 粒子名称与手动质量

支持示例包括 `133Cs`、`Cs-133`、`cesium-133`、`133Xe[m1]`、`12C:16O*2` 与 `[133Cs+1H]+`。分子每个组分都必须指定同位素。单独的 `Cs`、`H2O`、未收录核态和电荷冲突会被拒绝。末尾数字可能同时表示数量或电荷时，应使用带括号的明确电荷或电荷字段。

手动输入时取消评价质量，填写质量与可选不确定度，并明确选择中性原子或组分质量之和，或已经校正的离子质量。单位为 u 或 keV/$c^2$。keV/$c^2$ 字段是完整质量，不是质量过剩。切换单位会同时转换质量与已知误差。编辑自动填充的质量会清除原评价误差并切换到手动输入，防止新数值沿用旧误差。

电荷数须为 −100 到 100 的非零整数，磁场与校正后离子质量必须为正。界面频率为绝对值，导出数据另保留有符号频率。

## 方程与单位

设 $M$、$m_e$ 为以 u 表示的质量数值，$u$ 为以 kg 表示的原子质量常数。根据输入约定，

$$m_{\mathrm{ion}}=M-qm_e\quad\text{中性质量输入},$$

$$m_{\mathrm{ion}}=M\quad\text{已校正离子质量输入}.$$

正离子扣除电子质量，负离子增加电子质量；模型省略电离能、电子亲和能和分子结合能。已经校正的离子质量不会重复扣除电子。

$$\nu_c=\frac{|q|eB}{2\pi m_{\mathrm{ion}}u},\qquad \nu_{\mathrm{signed}}=\frac{qeB}{2\pi m_{\mathrm{ion}}u}.$$

$B$ 使用 T，频率输出 Hz。实现保留的质量能量转换为

$$C_u=uc^2=931494.10242\ {\mathrm{keV}},$$

$$M=\frac{E_{\mathrm{mass}}}{C_u},\qquad M=A+\frac{ME}{C_u}.$$

前式转换以 keV/$c^2$ 输入的完整质量；后式说明评价原子质量过剩 $ME$ 的转换。二者是不同的输入，不能混用。

## 不确定度与关联

质量和磁场误差均已知时，单行边际误差为

$$\sigma_{\nu}=\nu_c\sqrt{\left(\frac{\sigma_B}{B}\right)^2+\left(\frac{\sigma_M}{m_{\mathrm{ion}}}\right)^2}.$$

常数视为固定。空白误差表示未知，数值零表示已知的固定输入。任一必需误差未知时，频率误差保持未知。分子中重复的同位素先合并原始变量系数，再传播：

$$M_{\mathrm{sum}}=\sum_i n_iM_i,\qquad \sigma_{M_{\mathrm{sum}}}^2=\sum_i n_i^2\sigma_{M_i}^2.$$

这采用原始变量对角协方差，不是完整 AME 协方差。所有行共享磁场，其协方差贡献为

$$\operatorname{Cov}_B(\nu_j,\nu_k)=\frac{\nu_j\nu_k}{B^2}\sigma_B^2.$$

共享同位素还会产生行间关联。本工具提供单行边际结果，不执行联合频率比拟合，也不支持将所有行自动当作相互独立。

## 来源与网页本地差异

保存的基态质量来自 AME2020，精确核态标识与激发信息来自 NUBASE2020。网页采用

$$M^*=M_{g,\mathrm{AME2020}}+\frac{E_{x,\mathrm{NUBASE2020}}}{C_u}.$$

网页在线选项查询 IAEA LiveChart 基态质量过剩，同时保留明确的 2020 版来源约定与保存副本回退。评价日期和请求获取日期不同。本地 `ame2020` 策略对基态使用 AME，对选定激发态使用 NUBASE 直接列出的质量，不用上式重新组合。本地 `nubase2020` 明确选择该保存评价。这可能改变同核异能态结果，因此导出时必须保留核态与来源策略。

网页常数保留 CODATA2018 与 AME2020 配置，$m_e=5.48579909065\times10^{-4}$ u、$u=1.66053906660\times10^{-27}$ kg。本地兼容配置保留同一质量能量转换，但采用 $m_e=5.485799090441\times10^{-4}$ u、$u=1.66053906892\times10^{-27}$ kg。两者小的数值差异不一定表示错误。

## 运行已安装配套应用

在单独安装的配套应用目录打开终端，执行保存来源的命令行比较：

```sh
./Run_private.command -m traplab_qt.cyclotron_compare 133Cs 85Rb --B 7 --sigma-B 0 --policy ame2020
```

添加 `--output cyclotron-example` 可创建新输出目录，内含 `cyclotron_rows.json` 与 `cyclotron_results.csv`。若目录已存在则拒绝写入，以保留旧结果。使用 `--settings cyclotron-example/cyclotron_rows.json` 可读取输入并重新计算。本地服务离线运行，不实现浏览器的在线来源策略。图形入口为 `Individual_tools/14_Cyclotron_comparison.command`，独立页为 `cyclotron_compare`。模块和启动器名称用于已安装应用，不是私有源码下载链接。

也可运行 `./Run_private.command traplab.py gui --standalone --page cyclotron_compare` 打开图形页面。它提供英中文切换、一到十行、逐行频率图、可展开来源，以及 Auto、TrapLab、Cloudberry、MRS legacy 名称规则。本地示例为 `133Cs`、`133Xe[m1]`、`12C:16O2`；本地页面不宣传完整元素名称别名。保存会新建 `outputs/cyclotron_compare/run-N/` 输出包，打开行 JSON 则先完整校验，再替换输入并重新计算。专用输出包包含 CSV 与 JSON；图像保存使用既有 Plot style 和 Export plots，不能将它称为自动包含所有图像格式的输出包。

## 故障处理与证据

名称不明确时逐项指定同位素；选择实际收录的核态，修正电荷冲突，再计算。来源请求失败时可明确选择保存副本或重试，已有输入会保留。手动质量须有限且为正，并选对约定。不要为得到误差棒而把空白误差改成零。

网页已有 43 项解析、计算和界面专项测试。本地十一项核心与实际 BasePage 测试通过，覆盖正负电荷、核态错误、重复同位素误差、单位、未知与零误差、设置重开和无效输入保留。离屏构建不等于本地 Cocoa 导出、实际浏览器下载、硬件或精密质量测量验收。结果以所选质量来源和省略的结合修正为条件。

## 主要文献

- M. Wang 等，AME2020 原子质量评价 II，Chinese Physics C 45，030003（2021）；[官方未舍入质量表](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)。表中标志区分系统学估计和缺失量。
- F. G. Kondev 等，NUBASE2020 核性质评价，Chinese Physics C 45，030001（2021），[DOI 10.1088/1674-1137/abddae](https://doi.org/10.1088/1674-1137/abddae)；[官方核态表](https://www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt)。
- IAEA Nuclear Data Services，[LiveChart 数据下载 API 指南](https://www-nds.iaea.org/relnsd/vcharthtml/api_v0_guide.html)，核对日期 2026 年 10 月 24 日。API 字段说明不改变所选 AME 与 NUBASE 评价版本。
