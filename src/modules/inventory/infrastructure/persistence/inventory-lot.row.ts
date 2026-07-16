export type InventoryLotRow = {
  id: number;
  shop_id: number;
  product_id: number;
  source_type: string;
  source_id: number | null;
  purchase_receipt_item_id: number | null;
  supplier_id: number | null;
  unit_cost: number;
  quantity_received: number;
  quantity_remaining: number;
  batch_number: string | null;
  expiry_date: number | null;
  received_at: number;
  status: string;
  created_at: number;
  version: number;
};

export type SaleItemLotAllocationRow = {
  id: number;
  shop_id: number;
  sale_item_id: number;
  inventory_lot_id: number;
  quantity: number;
  unit_cost: number;
  created_at: number;
};
