import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { Edit2, Save, X, Search, Ban, CheckCircle, Lock } from 'lucide-react';

interface User {
    id: string;
    email: string;
    username: string;
    role: 'user' | 'admin';
    status: 'active' | 'banned';
    createdAt: string;
    quota: {
        dailyVideoLimit: number;
        dailyImageLimit: number;
        dailyChatLimit: number;
        videoCount: number;
        imageCount: number;
        chatCount: number;
    };
}

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<User>>({});
    const [search, setSearch] = useState('');

    // Password Reset State
    const [resetModalUser, setResetModalUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await apiService.getUsers();
            setUsers(data.users);
        } catch (err) {
            console.error('Failed to load users', err);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (user: User) => {
        setEditingId(user.id);
        setEditForm({
            role: user.role,
            quota: { ...user.quota }
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveUser = async (userId: string) => {
        if (!editForm) return;
        try {
            await apiService.updateUserAdmin(userId, editForm);
            setEditingId(null);
            loadUsers();
        } catch (err) {
            alert('更新用户失败');
        }
    };

    const toggleBan = async (user: User) => {
        if (!confirm(`确定要${user.status === 'banned' ? '解封' : '封禁'}用户 ${user.username} 吗?`)) return;
        try {
            await apiService.updateUserAdmin(user.id, { status: user.status === 'banned' ? 'active' : 'banned' });
            loadUsers();
        } catch (err) {
            alert('更新用户状态失败');
        }
    };

    const handleResetPassword = async () => {
        if (!resetModalUser || !newPassword) return;
        if (newPassword.length < 6) {
            alert('密码长度至少为6位');
            return;
        }
        try {
            await apiService.resetUserPassword(resetModalUser.id, newPassword);
            alert('密码重置成功');
            setResetModalUser(null);
            setNewPassword('');
        } catch (err) {
            alert('密码重置失败');
        }
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">用户管理</h2>
                    <p className="text-gray-400">管理用户访问权限和配额</p>
                </div>
                <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="搜索用户..."
                        className="bg-[#161922] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white outline-none focus:border-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-[#161922] rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-white/5 uppercase font-medium">
                        <tr>
                            <th className="px-6 py-4">用户</th>
                            <th className="px-6 py-4">状态</th>
                            <th className="px-6 py-4">角色</th>
                            <th className="px-6 py-4">视频配额</th>
                            <th className="px-6 py-4">图片配额</th>
                            <th className="px-6 py-4">对话配额</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="text-white font-medium">{user.username}</div>
                                    <div className="text-xs text-gray-500">{user.email}</div>
                                    <div className="text-xs text-gray-600 mt-1">ID: {user.id}</div>
                                </td>

                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs border ${user.status === 'banned'
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                        : 'bg-green-500/10 border-green-500/20 text-green-400'
                                        }`}>
                                        {user.status === 'banned' ? '封禁中' : '正常'}
                                    </span>
                                </td>

                                <td className="px-6 py-4">
                                    {editingId === user.id ? (
                                        <select
                                            className="bg-black border border-white/20 rounded p-1 text-white"
                                            value={editForm.role}
                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    ) : (
                                        <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {user.role}
                                        </span>
                                    )}
                                </td>

                                {/* Video Quota */}
                                <td className="px-6 py-4">
                                    {editingId === user.id ? (
                                        <input
                                            type="number"
                                            className="w-16 bg-black border border-white/20 rounded p-1 text-white"
                                            value={editForm.quota?.dailyVideoLimit}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                quota: { ...editForm.quota!, dailyVideoLimit: parseInt(e.target.value) }
                                            })}
                                        />
                                    ) : (
                                        <span>{user.quota.videoCount} / {user.quota.dailyVideoLimit}</span>
                                    )}
                                </td>

                                {/* Image Quota */}
                                <td className="px-6 py-4">
                                    {editingId === user.id ? (
                                        <input
                                            type="number"
                                            className="w-16 bg-black border border-white/20 rounded p-1 text-white"
                                            value={editForm.quota?.dailyImageLimit}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                quota: { ...editForm.quota!, dailyImageLimit: parseInt(e.target.value) }
                                            })}
                                        />
                                    ) : (
                                        <span>{user.quota.imageCount} / {user.quota.dailyImageLimit}</span>
                                    )}
                                </td>

                                {/* Chat Quota */}
                                <td className="px-6 py-4">
                                    {editingId === user.id ? (
                                        <input
                                            type="number"
                                            className="w-16 bg-black border border-white/20 rounded p-1 text-white"
                                            value={editForm.quota?.dailyChatLimit}
                                            onChange={(e) => setEditForm({
                                                ...editForm,
                                                quota: { ...editForm.quota!, dailyChatLimit: parseInt(e.target.value) }
                                            })}
                                        />
                                    ) : (
                                        <span>{user.quota.chatCount || 0} / {user.quota.dailyChatLimit || "-"}</span>
                                    )}
                                </td>

                                <td className="px-6 py-4 text-right">
                                    {editingId === user.id ? (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => saveUser(user.id)} className="p-1 hover:text-green-400" title="保存"><Save className="w-4 h-4" /></button>
                                            <button onClick={cancelEdit} className="p-1 hover:text-red-400" title="取消"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setResetModalUser(user)} className="p-1 hover:text-yellow-400" title="重置密码">
                                                <Lock className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => toggleBan(user)} className={`p-1 ${user.status === 'banned' ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}`} title={user.status === 'banned' ? '解封' : '封禁'}>
                                                {user.status === 'banned' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                            </button>
                                            <button onClick={() => startEdit(user)} className="p-1 hover:text-blue-400" title="编辑">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Reset Password Modal */}
            {resetModalUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[#1e2129] p-6 rounded-xl border border-white/10 w-full max-w-sm">
                        <h3 className="text-xl font-bold text-white mb-4">重置密码</h3>
                        <p className="text-gray-400 text-sm mb-4">为用户 <span className="text-white font-bold">{resetModalUser.username}</span> 设置新密码</p>

                        <input
                            type="text" // Visible for admin convenience
                            placeholder="输入新密码"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-lg p-2 text-white mb-4 focus:border-blue-500 outline-none"
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setResetModalUser(null); setNewPassword(''); }}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleResetPassword}
                                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                            >
                                确认重置
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
