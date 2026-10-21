import assert from "node:assert/strict";
import {summarize, supplierScores, planInventory, csvText} from "../docs/model.mjs";
import fs from "node:fs";
const products=[{id:"P1",name:"Example",category:"Hardware",cost:2}];
const stock=[{product:"P1",location:"L1",stock:20,incoming:5,demand:10,lead:3,safety:5}];
// Hand-worked case: target=10*(3+2)+5=55, position=25, deficit=30.
let row=planInventory(stock,products,{review:2,moq:8})[0];
assert.equal(row.quantity,32);assert.equal(row.budget,64);assert.equal(row.coverage,2);assert.equal(row.priority,1);
// Incoming stock prevents unnecessary orders, but does not erase on-hand risk.
row=planInventory([{...stock[0],incoming:100}],products,{review:2,moq:8})[0];
assert.equal(row.quantity,0);assert.equal(row.priority,1);
row=planInventory([{...stock[0],demand:0}],products)[0];
assert.equal(row.coverage,null);assert.equal(row.quantity,0);assert.equal(row.priority,3);
assert.throws(()=>planInventory(stock,products,{moq:0}),RangeError);
assert.throws(()=>planInventory(stock,products,{review:NaN}),RangeError);
assert.equal(planInventory(stock,products,{factor:1.5,review:2,moq:8})[0].quantity,64);
const purchases=[
  {supplier:"S1",orders:3,spend:100,quantity:10,completed:2,ontime:1,leadSum:8},
  {supplier:"S2",orders:2,spend:80,quantity:8,completed:1,ontime:1,leadSum:7},
];
const total=summarize(purchases);assert.equal(total.otd,2/3);assert.equal(total.lead,5);assert.equal(total.orders,5);
assert.equal(summarize([]).otd,null);assert.equal(supplierScores(purchases).length,2);
assert.equal(csvText(["SKU"],[["=1+1"]]),'\uFEFF"SKU"\r\n"\'=1+1"');
const data=JSON.parse(fs.readFileSync(new URL("../docs/data.json",import.meta.url)));
const real=summarize(data.purchases);
assert.equal(real.orders,data.meta.yearOrders);
assert.equal(data.inventory.length,2000);
assert.ok(real.ontime<=real.completed && real.completed<=real.orders);
assert.ok(data.inventory.every(r=>r.incoming>=0&&r.lead>=0&&Number.isFinite(r.demand)));
for(const factor of [.5,1,1.5]){
  const plan=planInventory(data.inventory,data.products,{factor,review:30,moq:100});
  assert.ok(plan.every(r=>r.quantity>=0&&r.quantity%100===0&&Number.isFinite(r.budget)));
}
console.log(JSON.stringify({status:"passed",checks:"hand-calculated quantity, MOQ rounding, incoming, zero demand, invalid inputs, weighted delivery metrics, CSV safety, source reconciliation and 3 scenarios",orders:real.orders,completed:real.completed,spend:real.spend,otd:real.otd,positions:data.inventory.length}));
