import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { Users, FileVideo, Image as ImageIcon, UserPlus } from 'lucide-react';

interface Stats {
    totalUsers: number;
    totalTasks: number;
    totalVideos: number;
    totalImages: number;
    newUsersToday: number;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-[#161922] p-6 rounded-xl border border-white/5 relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-4 opacity-10 ${color}`}>
            <Icon className="w-16 h-16" />
        </div>
        <div className="relative z-10">
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <h3 className="text-3xl font-bold mt-2 text-white">{value}</h3>
        </div>
    </div>
);

export const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAdminStats();
            setStats(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load stats');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-white">加载统计数据中...</div>;
    if (error) return <div className="text-red-400">错误: {error}</div>;
    if (!stats) return null;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">仪表盘概览</h2>
                <p className="text-gray-400">系统实时统计与指标</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="总用户数"
                    value={stats.totalUsers}
                    icon={Users}
                    color="text-blue-500"
                />
                <StatCard
                    title="总视频生成"
                    value={stats.totalVideos}
                    icon={FileVideo}
                    color="text-purple-500"
                />
                <StatCard
                    title="总图片生成"
                    value={stats.totalImages}
                    icon={ImageIcon}
                    color="text-pink-500"
                />
                <StatCard
                    title="今日新增用户"
                    value={stats.newUsersToday}
                    icon={UserPlus}
                    color="text-green-500"
                />
            </div>

            {/* Placeholder for charts or recent activity */}
            {/* Trends Chart */}
            <div className="bg-[#161922] rounded-xl border border-white/5 p-6">
                <h3 className="text-lg font-bold text-white mb-6">7天生成趋势</h3>
                <div className="h-64 flex items-end justify-between gap-2 px-2 pb-4">
                    {[65, 40, 78, 52, 90, 45, 85].map((h, i) => (
                        <div key={i} className="w-full bg-white/5 rounded-t hover:bg-white/10 transition-colors relative group h-full flex items-end">
                            <div
                                style={{ height: `${h}%` }}
                                className={`w-full ${i % 2 === 0 ? 'bg-purple-500' : 'bg-blue-500'} opacity-70 group-hover:opacity-100 transition-all rounded-t relative`}
                            >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs py-1 px-2 rounded border border-white/20 whitespace-nowrap">
                                    {h} 次生成
                                </div>
                            </div>
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500">
                                {new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(undefined, { weekday: 'short' })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
