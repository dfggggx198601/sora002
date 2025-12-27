import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { TrashIcon, VideoIcon, ImageIcon, SettingsIcon } from './Icons';

interface Task {
    id: string;
    type: 'VIDEO' | 'IMAGE' | 'CHAT';
    status: string;
    prompt: string;
    userId: string;
    videoUrl?: string;
    imageUrl?: string;
    createdAt: string;
    modelName?: string;
}

export const ContentAudit: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'ALL' | 'VIDEO' | 'IMAGE'>('ALL');

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAdminTasks();
            setTasks(data.tasks);
        } catch (error) {
            console.error('Failed to load tasks:', error);
            alert('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) return;

        try {
            await apiService.deleteAdminTask(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (error) {
            console.error('Failed to delete task:', error);
            alert('Failed to delete content');
        }
    };

    const filteredTasks = tasks.filter(task => {
        if (filterType === 'ALL') return true;
        return task.type === filterType;
    });

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">Loading content...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Content Audit</h2>
                    <p className="text-zinc-500 text-sm">Monitor and moderate user generated content.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-purple-500"
                    >
                        <option value="ALL">All Types</option>
                        <option value="VIDEO">Videos</option>
                        <option value="IMAGE">Images</option>
                    </select>
                    <button
                        onClick={loadTasks}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTasks.map(task => (
                    <div key={task.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-700 transition-all flex flex-col">
                        <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                            {task.type === 'VIDEO' && task.videoUrl ? (
                                <video src={task.videoUrl} className="w-full h-full object-contain" controls />
                            ) : task.type === 'IMAGE' && task.imageUrl ? (
                                <img src={task.imageUrl} alt={task.prompt} className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-zinc-700 flex flex-col items-center">
                                    {task.type === 'VIDEO' ? <VideoIcon className="w-8 h-8 opacity-20" /> : <ImageIcon className="w-8 h-8 opacity-20" />}
                                    <span className="text-xs mt-2">No Visual Preview</span>
                                </div>
                            )}

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDelete(task.id)}
                                    className="p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-lg shadow-lg backdrop-blur-sm transition-colors"
                                    title="Delete Content"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="absolute top-2 left-2">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold border backdrop-blur-md ${task.type === 'VIDEO'
                                        ? 'bg-purple-900/50 border-purple-500/30 text-purple-300'
                                        : 'bg-pink-900/50 border-pink-500/30 text-pink-300'
                                    }`}>
                                    {task.type}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col">
                            <p className="text-white text-sm font-medium line-clamp-2 mb-2 flex-1" title={task.prompt}>
                                {task.prompt || 'No prompt'}
                            </p>

                            <div className="space-y-1 pt-3 border-t border-zinc-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">User ID</span>
                                    <span className="text-zinc-400 font-mono truncate max-w-[100px]" title={task.userId}>
                                        {task.userId}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">Date</span>
                                    <span className="text-zinc-400">
                                        {new Date(task.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500">Status</span>
                                    <span className={`font-medium ${task.status === 'COMPLETED' ? 'text-green-500' :
                                            task.status === 'FAILED' ? 'text-red-500' : 'text-yellow-500'
                                        }`}>
                                        {task.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredTasks.length === 0 && (
                <div className="text-center py-20 text-zinc-600">
                    <p>No content found matching filter.</p>
                </div>
            )}
        </div>
    );
};
