import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Users, Database } from 'lucide-react';

import { Calendar } from 'lucide-react';

export const UserManagement = () => {
    const { profile, user } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Reviewer');
    const [seedMessage, setSeedMessage] = useState('');

    const roles = ["Admin", "Facilitator", "Reviewer", "Requestor", "Participant", "Watcher", "Guest"];

    const fetchUsers = async () => {
        try {
            const q = query(collection(db, 'users'));
            const snap = await getDocs(q);
            setUsers(snap.docs.map(d => ({id: d.id, ...d.data()})));
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

    const handleSeedReviews = async () => {
        setSeedMessage('Seeding schedule...');
        try {
            const { deleteDoc } = await import('firebase/firestore');
            const revSnap = await getDocs(query(collection(db, 'reviews')));
            for (const doc of revSnap.docs) {
                await deleteDoc(doc.ref);
            }

            const projSnap = await getDocs(query(collection(db, 'projects')));
            const projects: any[] = projSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const findProj = (title: string) => projects.find((p: any) => p.title === title)?.id;

            const reviewsToSeed = [
                // Week 1
                { title: 'Atlas Design System Revamp', stage: 'Discovery', date: '2026-04-20T09:00:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Discovery', date: '2026-04-21T11:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Discovery', date: '2026-04-22T14:00:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Discovery', date: '2026-04-23T15:30:00Z' },
                // Week 2
                { title: 'Atlas Design System Revamp', stage: 'Design', date: '2026-04-27T10:30:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Design', date: '2026-04-28T13:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Design', date: '2026-04-29T15:00:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Design', date: '2026-04-30T09:30:00Z' },
                // Week 3
                { title: 'Atlas Design System Revamp', stage: 'Follow-up', date: '2026-05-04T13:30:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Follow-up', date: '2026-05-05T09:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Follow-up', date: '2026-05-06T11:30:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Follow-up', date: '2026-05-07T16:00:00Z' },
                // Week 4
                { title: 'Atlas Design System Revamp', stage: 'Fit & Finish', date: '2026-05-11T14:00:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Fit & Finish', date: '2026-05-12T10:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Fit & Finish', date: '2026-05-13T13:00:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Fit & Finish', date: '2026-05-14T15:00:00Z' }
            ];

            for (const r of reviewsToSeed) {
                const pid = findProj(r.title);
                if (pid) {
                    await addDoc(collection(db, 'reviews'), {
                        projectId: pid,
                        stageType: r.stage,
                        status: 'Scheduled',
                        scheduledTime: r.date,
                        facilitatorId: user?.uid,
                        reviewerIds: []
                    });
                }
            }
            setSeedMessage('Schedule seeded successfully!');
            setTimeout(() => setSeedMessage(''), 3000);
        } catch (err) {
            console.error("Failed to seed reviews", err);
            setSeedMessage('Failed to seed schedule.');
        }
    };

    const handleSeedData = async () => {
        setSeedMessage('Seeding database...');
        try {
            const demoUsers = [
                { name: 'Sarah Facilitator', email: 'sarah@uxdr.local', role: 'Facilitator' },
                { name: 'John Reviewer', email: 'john@uxdr.local', role: 'Reviewer' },
                { name: 'Alice Requestor', email: 'alice@uxdr.local', role: 'Requestor' },
                { name: 'Bob Watcher', email: 'bob@uxdr.local', role: 'Watcher' }
            ];
            for (const u of demoUsers) {
                await addDoc(collection(db, 'users'), u);
            }

            const p1 = {
                title: 'Atlas Design System Revamp',
                description: 'Complete overhaul of the Atlas design system to unify UI components, accessibility standards, and interaction patterns across web and mobile platforms. Focus includes token standardization, updated component library, and migration strategy for legacy products.',
                status: 'Discovery',
                timeline: 'Q3 2026',
                requestorId: user?.uid,
                disclosureRequired: false,
                priorWorkLink: 'https://uxdr.example.com/projects/atlas-design-system-revamp',
                createdAt: new Date().toISOString()
            };
            
            const p2 = {
                title: 'Checkout Flow Optimization',
                description: 'Redesign the end-to-end ecommerce checkout experience to reduce drop-off and improve conversion rates. Includes cart review, payment selection, error recovery states, and mobile-first interaction improvements.',
                status: 'Design',
                timeline: 'Next 2 weeks',
                requestorId: user?.uid,
                disclosureRequired: false, 
                priorWorkLink: 'https://uxdr.example.com/projects/checkout-flow-optimization',
                createdAt: new Date().toISOString()
            };

            const p3 = {
                title: 'Confidential AI Assistant UX',
                description: 'Design a secure AI assistant interface for enterprise users handling sensitive internal data. Includes conversation memory controls, audit logging, permissioned responses, and compliance-focused interaction design.',
                status: 'Discovery',
                timeline: 'Q3 2026',
                requestorId: user?.uid,
                disclosureRequired: true, 
                priorWorkLink: 'https://uxdr.example.com/projects/confidential-ai-assistant-ux',
                createdAt: new Date().toISOString()
            };

            const p4 = {
                title: 'Mobile Navigation Redesign',
                description: 'Redesign mobile navigation patterns across iOS and Android applications to improve discoverability and reduce cognitive load. Includes bottom navigation restructuring, gesture exploration, and accessibility improvements.',
                status: 'Follow-up',
                timeline: 'Next 2 weeks',
                requestorId: user?.uid,
                disclosureRequired: false, 
                priorWorkLink: 'https://uxdr.example.com/projects/mobile-navigation-redesign',
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'projects'), p1);
            await addDoc(collection(db, 'projects'), p2);
            await addDoc(collection(db, 'projects'), p3);
            await addDoc(collection(db, 'projects'), p4);
            
            setSeedMessage('Database seeded successfully!');
            setTimeout(() => setSeedMessage(''), 3000);
            
            await fetchUsers();
        } catch (err) {
            console.error("Failed to seed", err);
            setSeedMessage('Failed to seed database.');
        }
    };

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Users...</div>;

    const isAdmin = profile?.role === 'Admin';

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <header className="flex justify-between items-end border-b border-[#262626] pb-6">
                <div>
                    <h1 className="text-3xl font-sans font-bold flex items-center gap-2 mb-2">
                        <Users className="w-8 h-8 text-[#FF3D00]" /> 
                        User Management
                    </h1>
                    <p className="text-[#999999] text-sm">Manage user roles and invite new members.</p>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-4">
                        {seedMessage && <span className="font-mono text-[11px] text-[#00E676]">{seedMessage}</span>}
                        <button onClick={handleSeedReviews} className="border border-[#262626] text-[#999999] bg-[#141414] px-4 py-3 font-bold uppercase text-[11px] tracking-wider flex items-center gap-2 hover:text-white transition-colors rounded-sm">
                            <Calendar className="w-4 h-4" /> Seed Calendar
                        </button>
                        <button onClick={handleSeedData} className="border border-[#262626] text-[#999999] bg-[#141414] px-4 py-3 font-bold uppercase text-[11px] tracking-wider flex items-center gap-2 hover:text-white transition-colors rounded-sm">
                            <Database className="w-4 h-4" /> Seed DB
                        </button>
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
                <h3 className="panel-title mb-4">Active Directory</h3>
                <div className="bg-[#0A0A0A]">
                    <div className="data-row bg-[#141414] border-[#262626] cursor-default grid-cols-[2fr_2fr_1fr] px-4 py-3 border-b-0 rounded-t-sm">
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Name</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Email</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Role</div>
                    </div>
                    {users.map(u => (
                        <div key={u.id} className="data-row grid-cols-[2fr_2fr_1fr] border-[#262626] cursor-default px-4 hover:bg-[#141414]">
                            <div className="font-semibold text-[16px] flex items-center text-white">{u.name}</div>
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
