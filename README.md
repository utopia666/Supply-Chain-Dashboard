# Supply Chain Analytics Dashboard｜供应链分析仪表板

> 本仓库源自 [akeDataAnalyst/Supply-Chain-Dashboard](https://github.com/akeDataAnalyst/Supply-Chain-Dashboard)，原作者为 **Aklilu Abera**。项目代码和原始 `LICENSE` 保留上游 MIT 许可及署名。本次整理用于开源项目研习与轻量复现，不将上游代码或方法表述为原创。

[在线演示](https://supply-chain-dashboard-fppecphmqqsatcchdwfqxy.streamlit.app)

## 项目简介

项目使用 Python、Pandas、Prophet、Streamlit 和 Plotly，将模拟的需求、采购、库存及供应商数据组织成可交互的供应链分析仪表板。页面按需求预测、库存管理、供应商分析分为三个区域，可按产品、地点、日期和供应商筛选。

## 业务流程与指标

| 主题 | 页面展示与计算 | 可以辅助观察 |
| --- | --- | --- |
| 供应链计划 / 需求预测 | 按产品—地点组合使用 Prophet 输出名义 90 天预测；以最近 30 天数据作留出验证，展示 MAE、RMSE、MAPE 和预测区间 | 需求趋势、预测误差与后续备货参考。MAPE 计算时跳过实际需求为 0 的记录 |
| 采购订单 | 查看订单数、供应商、产品、地点、订单/交付日期、订购数量和单价，并可按供应商筛选 | 订单执行和采购明细；当前页面未汇总采购金额、价格差异或节约额 |
| 库存与补货 | 展示当前库存、日均需求、平均提前期、安全库存、再订货点、建议订货量及库存状态 | 缺货、低于安全库存、需补货、潜在积压等 SKU—地点组合 |
| 供应商绩效 | 展示采购订单数、准时交付率和实际平均交期 | 供应商交付表现及筛选后的订单明细 |

库存计算采用简化规则：安全库存约为 `Z × 日需求标准差 × √提前期`，再订货点约为 `日均需求 × 提前期 + 安全库存`；补货量优先取未来 30 天预测需求合计。当前实现按全部供应商的平均提前期计算，并对无预测量的情形使用简化回退值。

## 本地运行

完整仓库包含示例 CSV 和预计算结果。准备 Python 环境后，在仓库根目录运行：

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
streamlit run dashboard_app.py
```

如需重新计算预测，可运行 `python demand_forecaster.py`；该脚本会遍历产品—地点组合训练模型，数据量较大时耗时较长。重新生成预测后，可运行 `python inventory_optimizer.py` 更新库存指标，再启动仪表板。仅浏览仓库预计算结果时，直接启动仪表板即可。

## 本次轻量复现范围

使用与项目字段结构一致的隔离样例 CSV 运行上游 `dashboard_app.py`，通过 Streamlit AppTest 验证需求预测、库存管理、供应商分析三个页面及 17 项指标可正常渲染，未出现应用异常。此次验证没有载入完整上游 CSV，也没有重算 Prophet 模型，因此只证明样例数据下的页面与指标链路可运行，不代表完整数据集或生产效果。

## 局限

- 示例数据为模拟数据，适合学习指标关系和交互方式，不能代表真实企业业务表现。
- 当前采购页没有采购金额、预算执行、价格趋势、MOQ 或降本指标；供应商分析也没有完整的质量、成本、风险或加权评分模型。
- 提前期使用供应商整体平均值，未细分到供应商—物料—地点；库存规则未纳入采购批量、产能、资金、保质期及需求相关性等约束。
- 需求预测代码用训练集评估最近 30 天后，没有再用全量历史重训最终模型；预测日期可能仍从训练集末端开始，和最新实际日期不对齐，依赖预测的补货窗口也应先校准。
- 预测使用历史销量和 Prophet 季节性设定，未接入促销、价格、计划变更等外部变量；预测准确率依赖样例数据及其验证切分。
- 仪表板读取本地 CSV，没有连接 ERP、采购或仓储系统，也不自动刷新数据。

## 来源与许可

- 上游项目：[akeDataAnalyst/Supply-Chain-Dashboard](https://github.com/akeDataAnalyst/Supply-Chain-Dashboard)
- 原作者：Aklilu Abera
- 许可：MIT，详见本仓库 [`LICENSE`](LICENSE)。分发或改作时应保留原版权和许可声明。


