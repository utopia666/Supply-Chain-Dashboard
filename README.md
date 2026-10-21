# SupplyFlow Lab｜供应链运营与补货决策看板

**供应链课程设计 · 开源项目研习、轻量复现与功能改进**

[打开公开交互演示](https://supplyflow-lab-utopia.balmyox3.chatgpt.site) · [项目源代码](https://github.com/utopia666/SupplyFlow-Lab) · [验证记录](VALIDATION.md)

> 本项目 fork 自 [akeDataAnalyst/Supply-Chain-Dashboard](https://github.com/akeDataAnalyst/Supply-Chain-Dashboard)，原作者 **Aklilu Abera**，采用 MIT 许可。保留原始代码、Git 历史及 LICENSE。原作提供模拟数据、Prophet 预测、库存规则和 Streamlit 页面；本次课程设计增加采购分析与补货决策工作台。全部数据为模拟数据，不代表真实企业经营业绩。

## 展示什么

从查看指标延伸到提出下一步动作：观察采购金额和交付表现，定位库存覆盖不足的物料，调整需求、备货周期与批量假设，导出待讨论的补货清单。

在线版为纯静态中文页面，无需登录或安装 Python。包含 100 种产品、20 个网点、10 家供应商、2,000 个 SKU × 网点库存组合；采购展示 2024 年 31,400 笔订单。库存快照固定为 **2024-12-31**。

## 相对原作的改进

| 方向 | 原作基础 | 本次新增（docs/、scripts/） |
| --- | --- | --- |
| 采购分析 | 订单明细、数量和单价 | 采购金额、月度趋势、品类结构、供应商金额占比；网点/品类/季度联动筛选 |
| 库存计划 | 安全库存、再订货点和库存状态 | 库存覆盖天数、SKU × 网点经验交期、模拟在途扣减、风险优先级 |
| 补货决策 | 预计算补货量 | 可调需求比例、备货周期和订货批量；比较补货数量与预估金额；搜索、分页及 UTF-8 BOM CSV 导出 |
| 供应商绩效 | 准时率、平均交期 | 以快照日已完成交付订单为分母，增加金额集中度、排序和低样本提示 |
| 展示交付 | Python / Streamlit | 公开免登录静态演示、中文指标口径、来源指纹和独立业务算例检查 |

## 指标与业务口径

| 指标 | 定义与用途 |
| --- | --- |
| 采购金额 | Σ(ordered_quantity × unit_price)，按下单月份统计；源数据未指定币种，不含税费与物流 |
| 准时交付率 | 快照日已完成交付且 on_time_delivery=True 的订单数 / 已完成交付订单数；沿用模拟标记，不重新推断承诺日期 |
| 实际平均交期 | 已完成订单的 delivery_date − order_date，按订单等权平均，不对供应商百分比简单平均 |
| 经验交期 | 截至快照日所有历史已完成订单按 SKU × 网点分组的平均交期；无样本时回退原作交期 |
| 在途量 | 已下单、交付日期晚于快照日的模拟订单数量之和；企业应用需接入采购未清订单和预计到货日期 |
| 库存覆盖 | 在手库存 / 情景日均需求；无需求时不适用 |
| 风险优先级 | 已缺货 → 在手覆盖低于经验交期 → 库存低于再订货点 → 覆盖充足；同级按覆盖天数升序 |
| 预估补货金额 | 建议数量 × 产品主数据 unit_cost；为资金测算值，不是供应商最新报价 |

补货采用**周期复查、补足目标库存**的简化策略：

```text
情景日均需求 = 原作历史日均需求 × 需求比例
情景安全库存 = ceil(原作安全库存 × 需求比例)
再订货点 = 情景日均需求 × 经验交期 + 情景安全库存
目标库存 = 情景日均需求 × (经验交期 + 备货周期) + 情景安全库存
库存位置 = 在手库存 + 模拟在途量
建议量 = max(0, ceil(目标库存 − 库存位置))，再按订货批量倍数向上取整
```

风险依据在手库存，建议量扣除全部模拟在途；可能出现“存在风险但建议量为零”，应先核对在途到货时点。无日均需求时建议量为零。默认需求比例 100%、备货周期 30 天、批量倍数 1 件。备货周期为 0 表示仅补足交期需求及安全库存。

采购季度筛选仅影响采购与供应商指标，库存固定为快照。网点/品类筛选影响两者；清单搜索/风险筛选仅影响清单和导出，不改变上方整个网点/品类的情景汇总。

## 运行与复建

### 最轻量：浏览改进版

克隆仓库后，从仓库根目录运行：

```powershell
python -m http.server 8765 --directory docs
```

访问 http://localhost:8765 。静态页面读取已提交的 docs/data.json，无需第三方包。不要双击 HTML 打开，浏览器会限制本地 JSON 读取。

### 从上游 CSV 重建演示数据

```powershell
python -m pip install pandas
python scripts/build_demo_data.py
```

读取 data/ 中的产品、网点、供应商、采购、库存，以及 dashboard_data/inventory_insights.csv。保留源文件 SHA-256、源提交和快照日期；仅导出业务字段，不导出联系人、电话、邮箱和地址。

也可用 `python scripts/build_demo_data.py --source-dir <包含六个CSV的目录>` 指定平铺目录。演示数据来自上游提交 `d8d71d04591c4ddf9199c0ade3ea7e80517b0d36`；更换数据时应同步更新来源说明。

### 验证新增决策逻辑

安装 Node.js 后运行：

```powershell
node scripts/verify_metrics.mjs
```

覆盖独立手算补货案例、批量取整、在途扣减、无需求、非法参数、按订单加权的交付指标、CSV 公式安全、源订单数勾稽及三个需求情景。

### 运行原作 Streamlit

原作入口和依赖保留：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
streamlit run dashboard_app.py
```

原作 `python demand_forecaster.py` 与 `python inventory_optimizer.py` 可重算预测和库存指标，训练完整数据可能较慢。本次没有重训 Prophet。原预测实现用训练集留出验证后没有全量历史重拟合，未来日期可能从训练集末端起算，使用前应校准。新增静态补货情景使用历史日均需求，不依赖该预测日期窗口。

## 局限与后续扩展

- 模拟订单、需求与库存可能未完全勾稽；快照不是实时库存。
- 安全库存按需求比例线性缩放，为可解释的情景假设，不是重新估计服务水平。
- 无预留、欠单、到货日排程、真实 MOQ、仓容、保质期、预算与产能约束；不能直接用于企业下单。
- 无供应商质量、退货、付款条款、价格差异与降本评价；不跨品类比较单位价格。
- 未接入 ERP/WMS/SRM，也未验证真实企业成本节省或效率改善。
- 可继续扩展采购未清订单、逐日库存投影、分段需求预测和预算约束下的采购优先级。

## 来源与许可

原作：[akeDataAnalyst/Supply-Chain-Dashboard](https://github.com/akeDataAnalyst/Supply-Chain-Dashboard)，Aklilu Abera，Copyright (c) 2025。原始 MIT 声明完整保存在 [LICENSE](LICENSE)。本次新增前端、数据构建和验证代码亦以 MIT 分发。项目名称及中文工作台为本次改作的展示名称，不表示原作者背书。


