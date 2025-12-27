import React from 'react';
import { LucideIcon, LayoutDashboard, Users, Image as ImageIcon, ArrowLeft, Settings } from 'lucide-react';

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    active: boolean;
    onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${active
            ? 'text-blue-500 bg-blue-500/10 border-r-2 border-blue-500'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
    >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
    </button>
);

interface AdminLayoutProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onExit: () => void;
    children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ activeTab, onTabChange, onExit, children }) => {
    return (
        <div className="flex h-screen bg-[#0f1115] text-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-white/10 flex flex-col bg-[#161922]">
                <div className="p-6 border-b border-white/10">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Admin Panel v2.0
                    </h1>
                </div>

                <div className="flex-1 py-4">
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="概览 (Overview)"
                        active={activeTab === 'dashboard'}
                        onClick={() => onTabChange('dashboard')}
                    />
                    <SidebarItem
                        icon={Users}
                        label="用户管理 (Users)"
                        active={activeTab === 'users'}
                        onClick={() => onTabChange('users')}
                    />
                    <SidebarItem
                        icon={ImageIcon}
                        label="内容管理 (Content)"
                        active={activeTab === 'content'}
                        onClick={() => onTabChange('content')}
                    />
                    <SidebarItem
                        icon={Settings}
                        label="系统设置 (Settings)"
                        active={activeTab === 'settings'}
                        onClick={() => onTabChange('settings')}
                    />
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={onExit}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>返回创作工坊</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};
