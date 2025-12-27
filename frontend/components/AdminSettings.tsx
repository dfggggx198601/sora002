import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { SaveIcon, AlertCircleIcon, BellIcon } from './Icons';
import { AppAnnouncement, SystemSettings } from '../types';

export const AdminSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<SystemSettings>({
        announcement: { message: '', enabled: false, type: 'info' },
        maintenanceMode: false,
        updatedAt: ''
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await apiService.getSystemSettings();
            setSettings(data);
        } catch (error) {
            console.error('Failed to load settings:', error);
            alert('Settings load failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await apiService.updateAdminSettings(settings);
            setMessage('设置已保存');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Failed to update settings:', error);
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">加载设置中...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-100">系统设置</h2>
                    <p className="text-zinc-400">管理全局配置与系统公告</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                    <SaveIcon className="w-4 h-4" />
                    {saving ? '正在保存...' : '保存更改'}
                </button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3 rounded-lg flex items-center gap-2 mb-4">
                <span className="text-xs font-mono">v2.0.1 Dashboard Active</span>
            </div>

            {message && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg flex items-center gap-2">
                    <BellIcon className="w-4 h-4" />
                    {message}
                </div>
            )}

            {/* Global Announcement */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <BellIcon className="w-5 h-5 text-purple-400" />
                    全局公告栏 (Announcement)
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-zinc-300">启用公告</label>
                        <input
                            type="checkbox"
                            checked={settings.announcement.enabled}
                            onChange={(e) => setSettings({
                                ...settings,
                                announcement: { ...settings.announcement, enabled: e.target.checked }
                            })}
                            className="rounded bg-zinc-800 border-zinc-700 text-purple-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">公告内容</label>
                        <input
                            type="text"
                            value={settings.announcement.message}
                            onChange={(e) => setSettings({
                                ...settings,
                                announcement: { ...settings.announcement, message: e.target.value }
                            })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="输入公告内容（例如：系统维护中...）"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">公告类型/颜色</label>
                        <select
                            value={settings.announcement.type}
                            onChange={(e) => setSettings({
                                ...settings,
                                announcement: { ...settings.announcement, type: e.target.value as any }
                            })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                        >
                            <option value="info">通知 (蓝色)</option>
                            <option value="warning">警告 (黄色)</option>
                            <option value="error">错误 (红色)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Initial Quota Settings */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <span className="text-xl">🎁</span>
                    新用户初始配额 (Initial Quota)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">视频配额/天</label>
                        <input
                            type="number"
                            value={settings.initialQuota?.dailyVideoLimit || 10}
                            onChange={(e) => setSettings({
                                ...settings,
                                initialQuota: { ...settings.initialQuota!, dailyVideoLimit: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">图片配额/天</label>
                        <input
                            type="number"
                            value={settings.initialQuota?.dailyImageLimit || 50}
                            onChange={(e) => setSettings({
                                ...settings,
                                initialQuota: { ...settings.initialQuota!, dailyImageLimit: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">对话配额/天</label>
                        <input
                            type="number"
                            value={settings.initialQuota?.dailyChatLimit || 50}
                            onChange={(e) => setSettings({
                                ...settings,
                                initialQuota: { ...settings.initialQuota!, dailyChatLimit: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Payment Packages */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    充值套餐配置 (Payment Packages)
                </h3>

                <div className="space-y-3">
                    {(!settings.paymentPackages || settings.paymentPackages.length === 0) && (
                        <p className="text-zinc-500 text-sm">暂无套餐，请添加。</p>
                    )}

                    {settings.paymentPackages?.map((pkg, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-3 p-3 bg-zinc-950 rounded border border-zinc-800">
                            <input
                                type="text"
                                placeholder="套餐名称"
                                value={pkg.name}
                                onChange={(e) => {
                                    const newPkgs = [...(settings.paymentPackages || [])];
                                    newPkgs[index].name = e.target.value;
                                    setSettings({ ...settings, paymentPackages: newPkgs });
                                }}
                                className="w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm outline-none"
                            />
                            <div className="flex items-center gap-1">
                                <span className="text-zinc-500 text-xs">¥</span>
                                <input
                                    type="number"
                                    placeholder="价格"
                                    value={pkg.price}
                                    onChange={(e) => {
                                        const newPkgs = [...(settings.paymentPackages || [])];
                                        newPkgs[index].price = parseFloat(e.target.value) || 0;
                                        setSettings({ ...settings, paymentPackages: newPkgs });
                                    }}
                                    className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <span>+视频:</span>
                                <input
                                    type="number"
                                    value={pkg.videoIncrease}
                                    onChange={(e) => {
                                        const newPkgs = [...(settings.paymentPackages || [])];
                                        newPkgs[index].videoIncrease = parseInt(e.target.value) || 0;
                                        setSettings({ ...settings, paymentPackages: newPkgs });
                                    }}
                                    className="w-12 bg-zinc-800 border-zinc-700 rounded px-1"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <span>+图片:</span>
                                <input
                                    type="number"
                                    value={pkg.imageIncrease}
                                    onChange={(e) => {
                                        const newPkgs = [...(settings.paymentPackages || [])];
                                        newPkgs[index].imageIncrease = parseInt(e.target.value) || 0;
                                        setSettings({ ...settings, paymentPackages: newPkgs });
                                    }}
                                    className="w-12 bg-zinc-800 border-zinc-700 rounded px-1"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <span>+对话:</span>
                                <input
                                    type="number"
                                    value={pkg.chatIncrease}
                                    onChange={(e) => {
                                        const newPkgs = [...(settings.paymentPackages || [])];
                                        newPkgs[index].chatIncrease = parseInt(e.target.value) || 0;
                                        setSettings({ ...settings, paymentPackages: newPkgs });
                                    }}
                                    className="w-12 bg-zinc-800 border-zinc-700 rounded px-1"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    const newPkgs = [...(settings.paymentPackages || [])];
                                    newPkgs.splice(index, 1);
                                    setSettings({ ...settings, paymentPackages: newPkgs });
                                }}
                                className="text-red-500 hover:text-red-400 ml-auto"
                            >
                                <span className="text-lg">×</span>
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => {
                            const newPkg = {
                                id: Date.now().toString(),
                                name: '新套餐',
                                price: 1,
                                videoIncrease: 3,
                                imageIncrease: 3,
                                chatIncrease: 3
                            };
                            setSettings({
                                ...settings,
                                paymentPackages: [...(settings.paymentPackages || []), newPkg]
                            });
                        }}
                        className="w-full py-2 border border-dashed border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800 hover:text-white transition-colors text-sm"
                    >
                        + 添加套餐
                    </button>
                </div>
            </div>

            {/* Payment Gateway Configuration */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <span className="text-xl">💳</span>
                    支付网关配置 (Payment Gateway)
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-zinc-300">启用支付系统</label>
                        <input
                            type="checkbox"
                            checked={settings.paymentConfig?.enabled || false}
                            onChange={(e) => setSettings({
                                ...settings,
                                paymentConfig: { ...settings.paymentConfig!, enabled: e.target.checked }
                            })}
                            className="rounded bg-zinc-800 border-zinc-700 text-purple-600"
                        />
                    </div>

                    {settings.paymentConfig?.enabled && (
                        <div className="space-y-4 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">支付模式</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="paymentProvider"
                                            value="manual"
                                            checked={settings.paymentConfig?.provider === 'manual'}
                                            onChange={() => setSettings({
                                                ...settings,
                                                paymentConfig: { ...settings.paymentConfig!, provider: 'manual' }
                                            })}
                                        />
                                        <span className="text-zinc-300">人工审核 (收款码)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="paymentProvider"
                                            value="epay"
                                            checked={settings.paymentConfig?.provider === 'epay'}
                                            onChange={() => setSettings({
                                                ...settings,
                                                paymentConfig: { ...settings.paymentConfig!, provider: 'epay' }
                                            })}
                                        />
                                        <span className="text-zinc-300">易支付/码支付 (自动回调)</span>
                                    </label>
                                </div>
                            </div>

                            {settings.paymentConfig?.provider === 'manual' ? (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">收款码图片链接</label>
                                    <input
                                        type="text"
                                        value={settings.paymentConfig?.manualQrCodeUrl || ''}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            paymentConfig: { ...settings.paymentConfig!, manualQrCodeUrl: e.target.value }
                                        })}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                                        placeholder="请输入您的支付宝/微信收款码图片URL"
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">用户扫码后需点击"我已支付"，您在后台确认后发货。</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">API 地址</label>
                                        <input
                                            type="text"
                                            value={settings.paymentConfig?.epayApiUrl || ''}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                paymentConfig: { ...settings.paymentConfig!, epayApiUrl: e.target.value }
                                            })}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                                            placeholder="例如: https://pay.example.com/"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">商户 ID (PID)</label>
                                        <input
                                            type="text"
                                            value={settings.paymentConfig?.epayPid || ''}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                paymentConfig: { ...settings.paymentConfig!, epayPid: e.target.value }
                                            })}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-1">商户密钥 (Key)</label>
                                        <input
                                            type="password"
                                            value={settings.paymentConfig?.epayKey || ''}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                paymentConfig: { ...settings.paymentConfig!, epayKey: e.target.value }
                                            })}
                                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Maintenance Mode */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <AlertCircleIcon className="w-5 h-5 text-red-400" />
                    系统维护模式 (Maintenance Mode)
                </h3>

                <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div>
                        <div className="text-white font-medium">维护模式开关</div>
                        <div className="text-sm text-zinc-400">开启后，用户将无法创建新任务。现有任务不受影响。</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={settings.maintenanceMode ? "text-red-400 font-bold" : "text-zinc-500"}>
                            {settings.maintenanceMode ? "已开启" : "已关闭"}
                        </span>
                        <input
                            type="checkbox"
                            checked={settings.maintenanceMode}
                            onChange={(e) => setSettings({
                                ...settings,
                                maintenanceMode: e.target.checked
                            })}
                            className="toggle-checkbox"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
