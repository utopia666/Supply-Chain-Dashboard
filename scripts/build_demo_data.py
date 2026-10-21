"""Build the public coursework demo from the upstream simulated CSV files.

Only business fields are exported; supplier contact details are not used.
Usage: python scripts/build_demo_data.py [--source-dir path/to/flat/csvs]
"""
import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "d8d71d04591c4ddf9199c0ade3ea7e80517b0d36"


def build(source_dir=None):
    sources = {}

    def read(name, dashboard=False):
        path = (Path(source_dir) / name if source_dir else
                ROOT / ("dashboard_data" if dashboard else "data") / name)
        sources[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        return pd.read_csv(path)

    products = read("dim_products.csv")
    locations = read("dim_locations.csv")
    suppliers = read("dim_suppliers.csv")
    stock = read("inventory.csv")
    insights = read("inventory_insights.csv", True)
    purchases = read("fact_purchases.csv")
    as_of = stock.inventory_date.max()
    year = as_of[:4]
    purchases = purchases[purchases.order_date <= as_of].copy()
    for col in ("ordered_quantity", "unit_price"):
        if purchases[col].isna().any() or (purchases[col] < 0).any():
            raise ValueError(f"Invalid purchase field: {col}")
    purchases["completed"] = purchases.delivery_date.le(as_of)
    purchases["on_time"] = (
        purchases.on_time_delivery.astype(str).str.lower().eq("true")
        & purchases.completed
    ).astype(int)
    purchases["lead_days"] = (
        pd.to_datetime(purchases.delivery_date) - pd.to_datetime(purchases.order_date)
    ).dt.days
    if (purchases.lead_days < 0).any():
        raise ValueError("Delivery before order")
    purchases["completed_lead"] = purchases.lead_days.where(purchases.completed, 0)
    # Per-product/location empirical lead time; fall back to upstream estimate.
    lead = purchases[purchases.completed].groupby(["product_id", "location_id"]).lead_days.mean()
    incoming = purchases[~purchases.completed].groupby(["product_id", "location_id"]).ordered_quantity.sum()
    latest = stock.sort_values("inventory_date").drop_duplicates(["product_id", "location_id"], keep="last")
    inv = latest.merge(insights, on=["product_id", "location_id"], validate="one_to_one")
    inv = inv.merge(products, on="product_id", validate="many_to_one")
    inventory = []
    for r in inv.to_dict("records"):
        key = (r["product_id"], r["location_id"])
        inventory.append({
            "product": r["product_id"], "location": r["location_id"],
            "stock": int(r["quantity_on_hand"]),
            "demand": round(r["avg_daily_demand"], 4),
            "lead": round(float(lead.get(key, r["avg_lead_time_days"])), 2),
            "safety": int(r["safety_stock"]),
            "incoming": int(incoming.get(key, 0)),
        })
    yearly = purchases[purchases.order_date.str.startswith(year)].copy()
    yearly = yearly.merge(products[["product_id", "category"]], on="product_id", validate="many_to_one")
    yearly["month"] = yearly.order_date.str[:7]
    yearly["spend"] = yearly.ordered_quantity * yearly.unit_price
    agg = yearly.groupby(["month", "location_id", "supplier_id", "category"], as_index=False).agg(
        spend=("spend", "sum"), orders=("purchase_id", "nunique"),
        quantity=("ordered_quantity", "sum"), completed=("completed", "sum"),
        ontime=("on_time", "sum"), leadSum=("completed_lead", "sum"))
    agg = agg.rename(columns={"location_id": "location", "supplier_id": "supplier"})
    agg["spend"] = agg.spend.round(2)
    payload = {
        "meta": {
            "title": "SupplyFlow Lab", "asOf": as_of, "year": year,
            "source": "https://github.com/akeDataAnalyst/Supply-Chain-Dashboard",
            "sourceCommit": SOURCE_COMMIT, "simulated": True, "currency": "未指定币种",
            "totalSourceOrders": len(purchases), "yearOrders": len(yearly),
            "sourceSha256": sources,
        },
        "products": products[["product_id", "product_name", "category", "unit_cost"]].rename(
            columns={"product_id": "id", "product_name": "name", "unit_cost": "cost"}).to_dict("records"),
        "locations": locations[["location_id", "city", "region"]].rename(
            columns={"location_id": "id"}).to_dict("records"),
        "suppliers": suppliers[["supplier_id", "supplier_name"]].rename(
            columns={"supplier_id": "id", "supplier_name": "name"}).to_dict("records"),
        "purchases": agg.to_dict("records"),
        "inventory": inventory,
    }
    target = ROOT / "docs" / "data.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(json.dumps({"output": str(target), "bytes": target.stat().st_size,
                      "source_orders": len(purchases), "year_orders": len(yearly),
                      "inventory_positions": len(inventory), "as_of": as_of}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir")
    build(parser.parse_args().source_dir)
