import {summarize, supplierScores, planInventory, csvText} from "./model.mjs";
const $ = id=>document.getElementById(id);
const nf = new Intl.NumberFormat("zh-CN",{maximumFractionDigits:0});
const num = n=>nf.format(n);
const dec = n=>n==null?"—":n.toFixed(1);
const pct = n=>n==null?"—":(n*100).toFixed(1)+"%";
const money = n=>(n<0?"−":"")+(Math.abs(n)>=1e8?(Math.abs(n)/1e8).toFixed(2)+" 亿":Math.abs(n)>=1e4?(Math.abs(n)/1e4).toFixed(1)+" 万":num(Math.abs(n)));
const esc = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let data, view="overview", page=0, exportRows=[];
let allPlan=[], purchaseRows=[], scopedInventory=[];
const labels={overview:["运营总览","供应链运营总览","采购 · 库存 · 交付"],planning:["补货决策","补货决策","情景测算 · 风险排序"],suppliers:["供应商分析","供应商分析","采购结构 · 交付表现"],about:["项目说明","SupplyFlow Lab","供应链课程设计 · 开源复现与改进"]};

function changeView(next){
  view=Object.hasOwn(labels,next)?next:"overview";
  document.querySelectorAll(".view").forEach(el=>el.hidden=el.id!==view);
  document.querySelectorAll(".nav").forEach(el=>{
    el.classList.toggle("active",el.dataset.view===view);
    if(el.dataset.view===view)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");
  });
  [$("crumb").textContent,$("title").textContent,$("subtitle").textContent]=labels[view];
  document.querySelector(".filters").hidden=view==="about";
  $("period-label").hidden=view==="planning";
  if(data)render();
  window.scrollTo({top:0,behavior:"instant"});
}
function navigate(next){
  if(location.hash!==`#${next}`)location.hash=next;
  else changeView(next);
}
window.addEventListener("hashchange",()=>changeView(location.hash.slice(1)));
function cards(id, items) {
  $(id).innerHTML=items.map(([label,value,unit,note])=>`<article class="kpi"><div class="kpi-label">${esc(label)}<span>↗</span></div><div class="kpi-value">${esc(value)}<em>${esc(unit)}</em></div><small>${esc(note)}</small></article>`).join("");
}
function table(id, headers, rows) {
  $(id).innerHTML=rows.length?`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`:'<div class="empty">当前范围暂无数据，请调整筛选条件。</div>';
}
function stockRow(r, full=false){
  return `<tr><td><strong>${esc(r.product)}</strong><small>${esc(r.name)}</small></td><td>${esc(r.location)}</td><td class="numeric">${num(r.stock)}</td>${full?`<td class="numeric">${num(r.incoming)}</td>`:""}<td class="numeric">${dec(r.coverage)} 天</td><td class="numeric">${dec(r.lead)} 天</td><td><span class="badge risk-${r.priority}">${r.risk}</span></td>${full?`<td class="numeric">${num(r.quantity)}</td><td class="numeric">${num(r.budget)}</td>`:""}</tr>`;
}
function filter(){
  const location=$("location").value,category=$("category").value,period=$("period").value;
  const products=new Map(data.products.map(p=>[p.id,p]));
  scopedInventory=data.inventory.filter(r=>(!location||r.location===location)&&(!category||products.get(r.product).category===category));
  purchaseRows=data.purchases.filter(r=>(!location||r.location===location)&&(!category||r.category===category)&&(!period||Math.ceil(Number(r.month.slice(5))/3)===Number(period)));
  $("scope").textContent=`${num(scopedInventory.length)} 个 SKU × 网点`;
}
function chart(){
  const groups=new Map();
  for(const r of purchaseRows)groups.set(r.month,(groups.get(r.month)||0)+r.spend);
  const quarter=Number($("period").value),start=quarter?(quarter-1)*3+1:1,end=quarter?quarter*3:12;
  const points=Array.from({length:end-start+1},(_,i)=>{const month=start+i;return{month,value:groups.get(`${data.meta.year}-${String(month).padStart(2,"0")}`)||0}});
  const max=Math.max(1,...points.map(p=>p.value))*1.15,W=600,H=240,pad=48,base=190;
  const xy=points.map((p,i)=>[pad+i*(W-pad-15)/Math.max(1,points.length-1),base-p.value/max*148]);
  const line=xy.map(([x,y])=>`${x},${y}`).join(" ");
  $("trend").innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="按月采购金额趋势图"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b7d1bd" stop-opacity=".55"/><stop offset="100%" stop-color="#f7faf5" stop-opacity=".2"/></linearGradient></defs>${[0,.5,1].map(t=>`<line x1="${pad}" x2="${W-15}" y1="${base-t*148}" y2="${base-t*148}" stroke="#e9eee7" stroke-dasharray="3 4"/><text x="${pad-8}" y="${base-t*148+4}" text-anchor="end" class="chart-label">${money(max*t)}</text>`).join("")}<polygon points="${pad},${base} ${line} ${xy.at(-1)[0]},${base}" fill="url(#area)"/><polyline points="${line}" fill="none" stroke="#39755f" stroke-width="2.5"/>${xy.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="#39755f" stroke-width="2"><title>${points[i].month}月：${num(points[i].value)}</title></circle><text x="${x}" y="${base+27}" text-anchor="middle" class="chart-label">${points[i].month}月</text>`).join("")}</svg>`;
  const cats=new Map();for(const r of purchaseRows)cats.set(r.category,(cats.get(r.category)||0)+r.spend);
  const total=[...cats.values()].reduce((a,b)=>a+b,0);
  $("categories").innerHTML=total?`<div class="category-list">${[...cats].sort((a,b)=>b[1]-a[1]).map(([name,value])=>`<div class="bar-item"><div class="bar-line"><span>${esc(name)}</span><span>${money(value)} · ${pct(value/total)}</span></div><div class="track"><div class="fill" style="width:${value/total*100}%"></div></div></div>`).join("")}</div>`:'<p class="empty">当前范围暂无采购记录。</p>';
}
function overview(){
  const t=summarize(purchaseRows),plan=planInventory(scopedInventory,data.products),risk=plan.filter(r=>r.priority<=1).length;
  cards("kpis",[
    ["采购订单金额",money(t.spend),"","原始货币单位"],
    ["采购订单数",num(t.orders),"单",`${num(t.completed)} 单已完成交付`],
    ["准时交付率",pct(t.otd),"","已完成交付订单"],
    ["交期内缺货风险",num(risk),"项","SKU × 网点"],
  ]);
  chart();
  $("action-title").textContent=`${num(risk)} 项库存存在交期内缺货风险`;
  $("action-text").textContent=`30 天情景 · ${num(plan.filter(r=>r.quantity>0).length)} 项建议补货，预估金额 ${money(plan.reduce((s,r)=>s+r.budget,0))}。`;
  table("urgent-table",["物料 / SKU","网点","在手库存","库存覆盖","经验交期","风险状态"],plan.slice(0,6).map(r=>stockRow(r)));
}
function planning(){
  const factor=Number($("factor").value)/100, review=$("review").valueAsNumber,moq=$("moq").valueAsNumber;
  $("factor-value").textContent=pct(factor);
  if(!Number.isFinite(review)||review<0||review>90||!Number.isFinite(moq)||moq<1||moq>10000||!Number.isInteger(moq)){
    $("validation").textContent="备货周期须为 0–90 天，订货批量须为 1–10000 的整数。";
    $("export").disabled=true;exportRows=[];$("plan-kpis").innerHTML="";table("plan-table",[],[]);
    $("plan-count").textContent="请修正情景参数";$("page-status").textContent="";$("previous").disabled=true;$("next").disabled=true;return;
  }
  $("validation").textContent="";$("export").disabled=false;
  allPlan=planInventory(scopedInventory,data.products,{factor,review,moq});
  const base=planInventory(scopedInventory,data.products),budget=allPlan.reduce((s,r)=>s+r.budget,0),baseBudget=base.reduce((s,r)=>s+r.budget,0);
  cards("plan-kpis",[
    ["预估补货金额",money(budget),"",`较默认情景 ${budget>=baseBudget?"+":""}${money(budget-baseBudget)}`],
    ["建议补货数量",num(allPlan.reduce((s,r)=>s+r.quantity,0)),"件","已扣除模拟在途量"],
    ["建议补货组合",num(allPlan.filter(r=>r.quantity>0).length),"项","SKU × 网点"],
    ["交期内缺货风险",num(allPlan.filter(r=>r.priority<=1).length),"项","按在手库存测算"],
  ]);
  const search=$("search").value.trim().toLowerCase(),risk=$("risk").value;
  exportRows=allPlan.filter(r=>(!search||`${r.product} ${r.name}`.toLowerCase().includes(search))&&(!risk||(risk==="1"?r.priority<=1:r.priority===Number(risk))));
  const pages=Math.max(1,Math.ceil(exportRows.length/20));page=Math.min(page,pages-1);
  $("plan-count").textContent=`${num(exportRows.length)} 项 · 导出当前筛选`;
  table("plan-table",["物料 / SKU","网点","在手库存","模拟在途","覆盖天数","经验交期","风险状态","建议补货","预估金额"],exportRows.slice(page*20,page*20+20).map(r=>stockRow(r,true)));
  $("page-status").textContent=`第 ${page+1} / ${pages} 页 · 每页 20 项`;
  $("previous").disabled=page===0;$("next").disabled=page>=pages-1;$("export").disabled=!exportRows.length;
}
function suppliers(){
  const rows=supplierScores(purchaseRows),total=summarize(purchaseRows),maxSpend=Math.max(0,...rows.map(r=>r.spend));
  cards("supplier-kpis",[
    ["参与供应商",num(rows.length),"家","当前采购筛选范围"],
    ["准时交付率",pct(total.otd),"",`${num(total.completed)} 单已完成订单`],
    ["实际平均交期",dec(total.lead),"天","按已完成订单等权平均"],
    ["最大供应商金额占比",total.spend?pct(maxSpend/total.spend):"—","","采购集中度观察值"],
  ]);
  const sort=$("supplier-sort").value;
  rows.sort((a,b)=>sort==="otd"?(a.otd??Infinity)-(b.otd??Infinity):sort==="lead"?(b.lead??-Infinity)-(a.lead??-Infinity):b.spend-a.spend);
  const names=new Map(data.suppliers.map(s=>[s.id,s.name]));
  table("supplier-table",["供应商","订单数","采购金额","金额占比","已完成交付","准时交付率","实际交期","复盘提示"],rows.map(r=>`<tr><td><strong>${esc(names.get(r.id))}</strong><small>${r.id}</small></td><td class="numeric">${num(r.orders)}</td><td class="numeric">${num(r.spend)}</td><td class="numeric">${pct(r.spend/total.spend)}</td><td class="numeric">${num(r.completed)}</td><td class="numeric">${pct(r.otd)}</td><td class="numeric">${dec(r.lead)} 天</td><td><span class="badge ${r.completed<10?"risk-2":r.otd<.9?"risk-1":""}">${r.completed<10?"样本较少":r.otd<.9?"关注交付偏差":"持续跟踪"}</span></td></tr>`));
}
function render(){filter();if(view==="overview")overview();if(view==="planning")planning();if(view==="suppliers")suppliers()}
function download(){
  if(!exportRows.length)return;
  const headers=["SKU","产品","网点","品类","在手库存","模拟在途量","覆盖天数","经验交期","风险","建议补货量","预估金额","需求比例","备货天数","订货批量倍数","数据快照"];
  const rows=exportRows.map(r=>[r.product,r.name,r.location,r.category,r.stock,r.incoming,r.coverage==null?"":r.coverage.toFixed(2),r.lead,r.risk,r.quantity,r.budget.toFixed(2),Number($("factor").value)/100,$("review").value,$("moq").value,data.meta.asOf]);
  const url=URL.createObjectURL(new Blob([csvText(headers,rows)],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=`SupplyFlow-补货清单-${data.meta.asOf}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
["location","category","period"].forEach(id=>$(id).addEventListener("change",()=>{page=0;render()}));
["factor","review","moq","search","risk"].forEach(id=>$(id).addEventListener("input",()=>{page=0;planning()}));
$("supplier-sort").addEventListener("change",suppliers);
$("previous").addEventListener("click",()=>{page--;planning()});
$("next").addEventListener("click",()=>{page++;planning()});
$("export").addEventListener("click",download);
$("reset").addEventListener("click",()=>{["location","category","period"].forEach(id=>$(id).value="");page=0;render()});
$("scenario-reset").addEventListener("click",()=>{$("factor").value=100;$("review").value=30;$("moq").value=1;page=0;planning()});
try{
  const response=await fetch("./data.json");if(!response.ok)throw Error(`HTTP ${response.status}`);
  data=await response.json();
  $("asof").textContent=data.meta.asOf;$("year").textContent=data.meta.year;
  $("location").insertAdjacentHTML("beforeend",data.locations.map(l=>`<option value="${esc(l.id)}">${esc(l.id)} · ${esc(l.city)}</option>`).join(""));
  $("category").insertAdjacentHTML("beforeend",[...new Set(data.products.map(p=>p.category))].sort().map(c=>`<option>${esc(c)}</option>`).join(""));
  $("period").options[0].textContent=`${data.meta.year} 全年`;
  $("data-note").textContent=`${data.products.length} 种产品 · ${data.locations.length} 个网点 · ${data.suppliers.length} 家供应商`;
  $("application").hidden=false;$("loading").hidden=true;changeView(location.hash.slice(1));
}catch(error){$("loading").textContent="数据未能加载。请刷新重试；本地运行请使用 README 中的静态服务器方式。";console.error(error)}
