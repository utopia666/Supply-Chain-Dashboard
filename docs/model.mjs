// SupplyFlow Lab additions. MIT; upstream data/code attribution in README.
export function summarize(rows) {
  const totals = rows.reduce((a, r) => {
    for (const k of ["spend", "orders", "quantity", "completed", "ontime", "leadSum"]) a[k] += r[k];
    return a;
  }, {spend:0, orders:0, quantity:0, completed:0, ontime:0, leadSum:0});
  return {...totals, otd: totals.completed ? totals.ontime/totals.completed : null,
    lead: totals.completed ? totals.leadSum/totals.completed : null};
}

export function supplierScores(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.supplier)) groups.set(row.supplier, []);
    groups.get(row.supplier).push(row);
  }
  return [...groups].map(([id, values])=>({id, ...summarize(values)}));
}

export function planInventory(rows, products, {factor=1, review=30, moq=1}={}) {
  if (![factor,review,moq].every(Number.isFinite) || factor<=0 || review<0 || moq<1 || !Number.isInteger(moq))
    throw new RangeError("Invalid scenario parameters");
  const map = new Map(products.map(p=>[p.id,p]));
  return rows.map(r=>{
    const product = map.get(r.product);
    const daily = r.demand*factor;
    const coverage = daily>0 ? r.stock/daily : null;
    const safety = Math.ceil(r.safety*factor); // Explicit linear scenario assumption.
    const trigger = daily*r.lead+safety;
    const target = daily*(r.lead+review)+safety;
    const position = r.stock+r.incoming; // No reservations/backorders in source.
    // Periodic order-up-to policy; no order when coverage already exceeds target.
    const gap = daily>0 ? Math.max(0, Math.ceil(target-position)) : 0;
    const quantity = gap ? Math.ceil(gap/moq)*moq : 0;
    const priority = daily<=0 ? 3 : r.stock<=0 ? 0 : coverage<r.lead ? 1 : r.stock<=trigger ? 2 : 3;
    return {...r, name:product.name, category:product.category, cost:product.cost,
      daily, coverage, safety, trigger, target, quantity, budget:quantity*product.cost,
      priority, risk:["已缺货","交期内缺货风险","接近补货点","覆盖充足"][priority]};
  }).sort((a,b)=>a.priority-b.priority || (a.coverage??Infinity)-(b.coverage??Infinity) || b.budget-a.budget || a.product.localeCompare(b.product));
}

export function csvText(headers, rows) {
  // Quote every field; prevent spreadsheet formula execution in text cells.
  const cell=v=>'"'+String(typeof v==="string" && /^[=+\-@\t\r]/.test(v) ? "'"+v : v??"").replaceAll('"','""')+'"';
  return "\uFEFF"+[headers,...rows].map(r=>r.map(cell).join(",")).join("\r\n");
}
