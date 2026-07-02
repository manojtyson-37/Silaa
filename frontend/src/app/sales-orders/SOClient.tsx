"use client";

import { useState } from "react";
import { SalesOrder, OrderMargin } from "@/lib/api";
import { StatusPill, Table, Td, Th } from "@/components/ui";
import OrderActions from "./OrderActions";
import EditSOForm from "./EditSOForm";

type Props = {
  orders: SalesOrder[];
  margins: OrderMargin[];
};

export default function SOClient({ orders, margins }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Table>
      <thead>
        <tr>
          <Th>Order</Th>
          <Th>Customer</Th>
          <Th>Status</Th>
          <Th>Margin</Th>
          <Th>Action</Th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order, i) => (
          <tr key={`${order.id}-${refreshKey}`}>
            <Td className="font-mono text-xs">#{order.id}</Td>
            <Td className="flex items-center gap-2">
              {order.customer_name}
              {order.status === "draft" && (
                <EditSOForm order={order} onSaved={() => setRefreshKey(k => k + 1)} />
              )}
            </Td>
            <Td>
              <StatusPill value={order.status} />
            </Td>
            <Td className="font-medium">₹{margins[i].total_margin}</Td>
            <Td>{order.status === "draft" && <OrderActions orderId={order.id} />}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
