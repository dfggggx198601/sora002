import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from './Icons';

interface Order {
    id: string;
    userId: string;
    userEmail: string;
    amount: number;
    status: 'pending' | 'paid' | 'cancelled';
    paymentMethod: string;
    createdAt: any;
    packageSnapshot: {
        name: string;
    };
}

export const AdminOrders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAdminOrders();
            setOrders(data);
        } catch (error) {
            console.error('Failed to load orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (orderId: string, action: 'approve' | 'reject') => {
        if (!confirm(action === 'approve' ? '确认用户已付款并自动发货？' : '确认拒绝此订单？')) return;

        try {
            setProcessingId(orderId);
            await apiService.verifyOrder(orderId, action);
            // Refresh list
            loadOrders();
        } catch (error) {
            console.error('Action failed:', error);
            alert('操作失败');
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        // Handle Firestore Timestamp or ISO string
        const d = new Date(date._seconds ? date._seconds * 1000 : date);
        return d.toLocaleString('zh-CN');
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">加载订单中...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100">订单管理</h2>
                    <p className="text-zinc-400">审核人工充值请求与交易记录</p>
                </div>
                <button
                    onClick={loadOrders}
                    className="text-zinc-400 hover:text-white text-sm"
                >
                    刷新列表
                </button>
            </div>

            {orders.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
                    暂无待处理订单
                </div>
            ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-zinc-400">
                        <thead className="bg-zinc-950 text-zinc-300 uppercase font-medium">
                            <tr>
                                <th className="px-6 py-4">时间</th>
                                <th className="px-6 py-4">用户</th>
                                <th className="px-6 py-4">套餐</th>
                                <th className="px-6 py-4">金额</th>
                                <th className="px-6 py-4">支付方式</th>
                                <th className="px-6 py-4">状态</th>
                                <th className="px-6 py-4 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-zinc-800/50">
                                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                                    <td className="px-6 py-4">{order.userEmail}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-xs border border-purple-500/20">
                                            {order.packageSnapshot?.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">¥{order.amount}</td>
                                    <td className="px-6 py-4">
                                        {order.paymentMethod === 'manual' ? '人工转账' : '在线支付'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-1.5 text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full w-fit text-xs border border-yellow-500/20">
                                            <ClockIcon className="w-3 h-3" />
                                            待审核
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleVerify(order.id, 'approve')}
                                                disabled={!!processingId}
                                                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                                                title="确认到账并自动发货"
                                            >
                                                <CheckCircleIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleVerify(order.id, 'reject')}
                                                disabled={!!processingId}
                                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                                                title="拒绝此订单"
                                            >
                                                <XCircleIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
