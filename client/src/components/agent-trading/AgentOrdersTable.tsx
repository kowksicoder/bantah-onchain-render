import type { AgentOrder } from "@shared/agentTrading";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  orders: AgentOrder[];
  loading?: boolean;
};

export function AgentOrdersTable({ orders, loading }: Props) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <CardContent className="space-y-3 p-3.5 sm:space-y-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">Orders</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Local Bantah order records for Polymarket routing attempts.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No orders yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Market</th>
                  <th className="pb-2 pr-4 font-medium">Side</th>
                  <th className="pb-2 pr-4 font-medium">Price</th>
                  <th className="pb-2 pr-4 font-medium">Stake</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="border-t border-slate-100 dark:border-slate-900">
                    <td className="py-3 pr-4 text-slate-900 dark:text-white">
                      {order.marketQuestion || order.externalMarketId}
                    </td>
                    <td className="py-3 pr-4 uppercase text-slate-600 dark:text-slate-300">{order.side}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      {order.intendedPrice.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                      ${order.intendedStakeUsd.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
