---
title: Mathieu 稳定性操作手册
author: TrapLab documentation
date: 2026-10-24
documentclass: revtex4-2
classoption: [aps, onecolumn, 11pt]
---

本手册说明网页与已安装配套应用中的独立 Mathieu 稳定带工具。它计算理想场中解的有界性；稳定点不等于实测传输率、冷却效率或电极通行率。原有 Keep the ions 轨迹游戏仍为独立演示。

## 第一次计算

1. 打开 Games 中的 Keep the ions，选择 Mathieu bands；Lab 也提供同一独立工具。选择线性 RFQ、直接参数、三个稳定带，横轴上限 2，纵轴 −1 到 1。
2. 输入 $a=0$、$q=0.4$。两个横向平面均应显示第一带稳定。改变参数后分别读取各平面的状态，不要只凭填色判断。
3. 切换到电压模式。设置离子质量 100 u、电荷数 1、$U=0$ V、$V=122$ V、$r_0=10$ mm、$f=1.3$ MHz。应得到 $a=0$、$q\simeq0.07057237$。出厂电压输入的 DC 为 $U=3$ V，对应 $a\simeq0.00347077$；不能假定默认点在两个平面都稳定。
4. 分别修改三段 RFQ 的参数。冷却段默认值为 3 V、122 V、10 mm、1.3 MHz；质量过滤段与聚束段各为 3 V、244 V、3.75 mm、3 MHz。读取各自的运行线与离子点。这些叠加只适用于线性 RFQ。
5. 打开图形样式，调整文字、参考点直径、线宽、位图宽度与文件名前缀。它们只改变显示。保存设置 JSON，改变输入，再读取该文件，核对输入、坐标轴与样式已恢复。

Species 与 Fill ion mass 按钮显式调用既有核素目录填入离子质量；仅输入粒子名称不会自动填充。质量和电荷仍可手动编辑。采用评价质量时，应保留返回的来源记录。

## 方程与电压约定

独立变量和标准方程为

$$\tau=\frac{\Omega t}{2},\qquad \Omega=2\pi f,$$

$$\frac{d^2w}{d\tau^2}+\left[a-2q\cos(2\tau)\right]w=0.$$

本线性杆电极工具采用

$$a=\frac{8zeU}{m r_0^2\Omega^2},\qquad q=\frac{4zeV}{m r_0^2\Omega^2}.$$

$z$ 为正整数电荷数，$e$ 为元电荷，$m$ 为以 kg 表示的实际离子质量。界面输入 u、mm、MHz，并转换到 SI。$U$ 是有符号 DC 电压，$V$ 是单根电极对地 RF 峰值；两组电极间的差分 RF 峰值为 $2V$。有效值或峰峰值必须先转换，不能直接代入。

另一横向平面的参数为

$$a_y=-a_x,\qquad q_y=-q_x.$$

理想横向约束要求两个平面均稳定。半径或频率减小会使参数按平方比例增大。电荷数范围为 1 到 100 的整数；质量、半径和频率必须有限且为正，RF 峰值不得为负。

## 多稳定带与独立三维视图

对于非零实数 $q$，一维稳定带编号为 $n=0,\ldots,N-1$，并满足

$$a_n(|q|)<a<b_{n+1}(|q|).$$

界面支持一到六个稳定带以及 $|q|\leq12$，边界单独标识。高于已计算稳定带或超出参数范围时显示覆盖范围之外，而不是已证明不稳定。在 $q=0$ 时，正 $a$ 采用解析稳定判断；$(0,0)$ 为边界。

三维 Paul 视图仅接受直接轴向参数，并使用

$$a_r=-\frac{a_z}{2},\qquad q_r=-\frac{q_z}{2}.$$

因此在轴向坐标中，径向边界写为

$$-2a_n(|q_z|/2),\qquad -2b_{n+1}(|q_z|/2).$$

该视图不反推电极电压几何；线性三段运行线与离子点会隐藏。不能将上述线性杆电极公式直接用于任意三维电极结构。

## 数值诊断与保存

浏览器使用按宇称构造的对称 Hill 矩阵与 Sturm 二分法计算特征值；本地应用使用已安装的 SciPy 特征函数。独立 RK4 计算在一个系数周期内构造单周期矩阵 $M$，显示

$$\det M\simeq1,\qquad |\operatorname{tr}M|<2,$$

$$\Delta_{\mathrm{tr}}=|\operatorname{tr}M_{1024}-\operatorname{tr}M_{512}|.$$

严格迹不等式对应稳定区内部。边界附近应结合特征值分类与收敛诊断；数值检查未收敛时为未解决状态。填色使用 241 个横向采样点，高阶窄带可能漏显；选定点直接使用特征值判断，不依赖填色采样。

SVG 保存矢量曲线和文字；PNG 使用所选位图宽度；CSV 保存稳定带采样表；设置 JSON 保存几何、输入、三段参数、坐标轴和样式，可重新打开。浏览器输出位于其下载设置指定的位置。既有共享图像 PDF 功能若出现，保存的是位图 PDF，与矢量 SVG 和本手册 TeX 的编译不同。

## 已安装配套应用

在单独安装的配套应用目录打开 `Individual_tools/13_Mathieu_stability.command`，或执行

```sh
./Run_private.command traplab.py gui --standalone --page mathieu_stability
```

集成入口位于 Paul trap and RFQ 分组，页面名为 Mathieu stability multiple bands。默认选择 133Cs 离子；新页面显示一条选定运行线，并提供直接参数、电压输入、本页坐标轴字体与点直径、正常页面状态保存，以及既有 Plot style 和 Export plots。原有 `rfq_sections` 保留本地三段工作流，不能将新页面描述为新增三条独立本地运行线。模块名是本地入口标签，不是网页下载链接。

网页保留 CODATA2018 的 $u=1.66053906660\times10^{-27}$ kg；本地配置使用 CODATA2022 的 $u=1.66053906892\times10^{-27}$ kg。因此小的参数差异是预期现象。模型不传播输入不确定度，也不包括碰撞、边缘场、空间电荷、电极损失或硬件验收。

## 故障处理与证据

空白或越界输入应改为范围内的有限值。覆盖范围之外的点可通过减小参数范围或在允许范围内增加稳定带数重新检查，不能强行标为稳定。粒子填充失败时保留精确同位素与核态，或明确手动输入离子质量。请读取本工具保存的设置，而不是旧版图表文件。

离线检查在六个选定 $q$、阶数不超过 12 的 150 个特征值上与 SciPy 1.10.1 比较，最大绝对差 $2.85\times10^{-14}$。九项网页专项测试和五项本地离屏测试通过。它们不代表实际浏览器下载、本地 Cocoa 导出或实验性能已通过验收。

## 主要文献

- NIST DLMF 1.2.8：[28.2 定义与基本性质](https://dlmf.nist.gov/28.2)、[28.17 稳定性](https://dlmf.nist.gov/28.17)，核对日期 2026 年 10 月 24 日。
- SciPy 官方 [mathieu_a](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.mathieu_a.html)、[mathieu_b](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.mathieu_b.html)。本地验证版本为 1.10.1，在线文档可能对应更新版本。
- 质量填充的评价来源：[AME2020](https://www-nds.iaea.org/amdc/ame2020/mass_1.mas20.txt)、[NUBASE2020](https://www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt)。数值约定复用既有配套应用的 `paul_mathieu` 与 `rfq_sections` 实现。
