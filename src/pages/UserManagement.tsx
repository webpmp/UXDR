import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QuickSearch } from '../components/QuickSearch';

export const UserManagement = () => {
    const { profile, user } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Reviewer');
    const [counts, setCounts] = useState({ users: 0, projects: 0, members: 0 });

    const roles = ["Admin", "Facilitator", "Reviewer", "Requestor", "Participant", "Watcher", "Guest"];

    const fetchCounts = async () => {
        try {
            const u = await getDocs(collection(db, 'users'));
            const p = await getDocs(collection(db, 'projects'));
            const m = await getDocs(collection(db, 'project_members'));
            setCounts({ users: u.size, projects: p.size, members: m.size });
        } catch (e) {
            console.error(e);
        }
    };

    const fetchUsers = async () => {
        try {
            const q = query(collection(db, 'users'));
            const snap = await getDocs(q);
            setUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
            fetchCounts();
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'users');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchUsers();
    }, []);

    const updateRole = async (userId: string, newRole: string) => {
        try {
            await updateDoc(doc(db, 'users', userId), { role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteName || !inviteEmail) return;
        try {
            const newUser = {
                name: inviteName,
                email: inviteEmail,
                role: inviteRole,
            };
            const docRef = await addDoc(collection(db, 'users'), newUser);
            setUsers([...users, { id: docRef.id, ...newUser }]);
            setInviteName('');
            setInviteEmail('');
        } catch(error) {
            handleFirestoreError(error, OperationType.CREATE, 'users');
        }
    }


    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Users...</div>;

    const isAdmin = profile?.role === 'Admin';

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <div className="flex justify-start">
                <QuickSearch />
            </div>

            <header className="flex justify-between items-end border-b border-[#262626] pb-6">
                <div>
                   <h1 className="mb-2">User Management</h1>
                   <p className="text-[#999999] text-sm">Manage user roles and directory access.</p>
                </div>
                {isAdmin && (
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-4">
                             <div className="text-right">
                                 <div className="text-[10px] text-[#999999] uppercase font-bold">Total Users</div>
                                 <div className="text-sm font-mono text-white">{counts.users}</div>
                             </div>
                        </div>
                    </div>
                )}
            </header>

            {isAdmin && (
                <div className="bg-[#141414] border border-[#262626] p-6 rounded-sm">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-[#FF3D00]" /> Invite New User
                    </h3>
                    <form onSubmit={handleInvite} className="flex gap-4 items-end flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[11px] text-[#999999] uppercase tracking-wider font-bold mb-2">Name</label>
                            <input 
                                value={inviteName}
                                onChange={e => setInviteName(e.target.value)}
                                placeholder="Jane Doe"
                                className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-2 rounded-sm text-[13px] outline-none text-white"
                                required
                            />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[11px] text-[#999999] uppercase tracking-wider font-bold mb-2">Email</label>
                            <input 
                                type="email"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="jane@example.com"
                                className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-2 rounded-sm text-[13px] outline-none text-white"
                                required
                            />
                        </div>
                        <div className="w-[150px]">
                            <label className="block text-[11px] text-[#999999] uppercase tracking-wider font-bold mb-2">Initial Role</label>
                            <select 
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value)}
                                className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-[9px] rounded-sm text-[13px] outline-none text-white"
                            >
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="cta-button !w-auto !py-[9px] !px-6 rounded-sm">
                            Invite
                        </button>
                    </form>
                </div>
            )}

            <div>
                <h1 className="panel-title mb-4">Active Directory</h1>
                <div className="table--comfortable bg-[#0A0A0A]">
                    <div className="data-row bg-[#141414] border-[#262626] cursor-default grid-cols-[minmax(220px,2fr)_minmax(200px,2fr)_minmax(120px,1fr)] py-3 border-b-0 rounded-t-sm">
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Name</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Email</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Role</div>
                    </div>
                    {users.map(u => (
                        <div key={u.id} className="data-row grid-cols-[minmax(220px,2fr)_minmax(200px,2fr)_minmax(120px,1fr)] border-[#262626] cursor-default hover:bg-[#141414]">
                            <Link to={`/users/${u.id}`} className="font-semibold text-[16px] flex items-center text-white hover:text-[#FF3D00] hover:underline">{u.name}</Link>
                            <div className="text-[12px] flex items-center text-[#999999]">{u.email}</div>
                            <div>
                                {isAdmin ? (
                                    <select 
                                        value={u.role}
                                        onChange={(e) => updateRole(u.id, e.target.value)}
                                        className="bg-[#141414] text-white border border-[#262626] rounded px-2 py-1 text-[13px] outline-none focus:border-[#FF3D00]"
                                    >
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                ) : (
                                    <span className="font-mono text-[10px] uppercase text-[#999999] border border-[#262626] px-2 py-1 rounded">{u.role}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
