# LAMMPS 平面、倾斜原子层与六面体计算器

一个无需安装、可直接在浏览器中运行的静态网页计算器。

## 项目文件

- `index.html`：GitHub Pages 入口与全部页面结构
- `assets/css/styles.css`：界面排版、配色和响应式样式
- `assets/js/app.js`：平面、倾斜原子层、位移和六面体的全部计算逻辑
- `README.md`：功能、使用方法与项目结构说明
- `.gitignore`：排除本地日志、轨迹、编辑器缓存和临时文件

本项目不依赖第三方 JavaScript 库、外部字体或外部图片；示意图由页面中的 SVG 根据输入参数实时绘制。因此，上述文件就是网页运行与维护所需的完整源码。

## 功能

- 根据平面上三个原子的笛卡尔坐标计算单位法向量、平面常数和平面方程
- 生成可直接使用的 LAMMPS `region plane`、原子筛选与导出命令
- 可选择法向正侧（`side in`）或反侧（`side out`），LAMMPS 与 Atomsk 命令同步更新
- 生成对应的 Atomsk 平面切割命令，并将计算说明与可复制命令分开显示
- 根据底面 A、B、C、D 与法向厚度自动生成 E、F、G、H，形成两个严格平行端面的凸六面体
- 自动检查底面四点的共面性、连续顺序和凸性，并通过六个 `region plane` 与 `intersect 6` 选择内部原子
- 生成 Atomsk 六面连续裁剪命令，逐面旋转并删除六面体外部原子
- 由三个原子坐标定义任意倾斜面，并按自选排数与上下层厚度生成有限厚度原子层
- 可用一条垂直于倾斜面的平面按 `m·X ≥ K` 或 `m·X < K` 裁剪所有原子层
- 动态绘制上下层、中心面、裁剪界面与保留方向，并自动列出各层在指定 `(X,Y)` 处的 Z 坐标边界
- 生成各层 `region plane` / `intersect`、上下层 `group union` 及其余原子 `group subtract` 命令
- 将倾斜面内两个互相垂直方向的位移投影到 X、Y、Z，生成对称的 `displace_atoms` 命令
- 平面、六面体和倾斜原子层各自带有独立的 OVITO 坐标批量粘贴入口
- 主要参数直接展示，LAMMPS 命名、精度和文件选项集中在可折叠的高级设置中
- 所有 LAMMPS 与 Atomsk 命令输出均可展开或收起，复制按钮只复制命令正文
- 平面、六面体和倾斜原子层均提供侧边步骤按钮；桌面端固定在左侧，窄屏自动切换为可横向滑动的顶部导航

## 使用方法

打开仓库中的 [`index.html`](./index.html)，或者直接访问 [GitHub Pages 在线版](https://zhfang28-code.github.io/lammps-plane-calculator/)。

六面体只需输入底面 A→B→C→D 与厚度。四点必须共面，并沿凸四边形边界连续排列；程序根据所选法向自动计算 E=A+t·n、F=B+t·n、G=C+t·n、H=D+t·n，再生成 LAMMPS 和 Atomsk 命令。

项目早期本地文件名为 `LAMMPS平面与四面体区域计算器.html`。为便于 GitHub Pages 识别网页入口，当前仓库使用 `index.html`；样式和计算逻辑已分别整理到 `assets/css` 与 `assets/js` 中。
