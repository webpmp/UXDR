import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, addDoc, setDoc, deleteDoc, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Users, Database, Calendar, Settings as SettingsIcon, ShieldAlert, Trash2, Clock, MapPin, X } from 'lucide-react';
import { QuickSearch } from '../components/QuickSearch';

export const Settings = () => {
    const { profile, user } = useAuth();
    const [seedMessage, setSeedMessage] = useState('');
    const [counts, setCounts] = useState({ users: 0, projects: 0, members: 0 });
    const [loading, setLoading] = useState(true);

    // Calendar Settings State
    const [calendarSettings, setCalendarSettings] = useState({
        showWeekends: false,
        workingHoursStart: '08:00',
        workingHoursEnd: '18:00'
    });
    const [holidays, setHolidays] = useState<any[]>([]);
    const [newHoliday, setNewHoliday] = useState({ name: '', date: '', description: '' });

    const fetchCalendarSettings = async () => {
        try {
            const docRef = doc(db, 'system_settings', 'calendar');
            const d = await getDocs(query(collection(db, 'system_settings')));
            const calDoc = d.docs.find(doc => doc.id === 'calendar');
            if (calDoc) {
                setCalendarSettings(calDoc.data() as any);
            }
        } catch (e) {
            console.error("Error fetching calendar settings", e);
        }
    };

    const fetchHolidays = async () => {
        try {
            const hSnap = await getDocs(collection(db, 'holidays'));
            setHolidays(hSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error("Error fetching holidays", e);
        }
    };

    const fetchCounts = async () => {
        try {
            const u = await getDocs(collection(db, 'users'));
            const p = await getDocs(collection(db, 'projects'));
            const m = await getDocs(collection(db, 'project_members'));
            setCounts({ users: u.size, projects: p.size, members: m.size });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCounts();
        fetchCalendarSettings();
        fetchHolidays();
    }, []);

    const saveCalendarSettings = async (updates: Partial<typeof calendarSettings>) => {
        try {
            const newSettings = { ...calendarSettings, ...updates };
            await setDoc(doc(db, 'system_settings', 'calendar'), newSettings, { merge: true });
            setCalendarSettings(newSettings);
            setSeedMessage('Calendar settings updated.');
            setTimeout(() => setSeedMessage(''), 3000);
        } catch (e) {
            console.error("Error saving calendar settings", e);
        }
    };

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHoliday.name || !newHoliday.date) return;
        try {
            await addDoc(collection(db, 'holidays'), newHoliday);
            setNewHoliday({ name: '', date: '', description: '' });
            fetchHolidays();
            setSeedMessage('Holiday added.');
            setTimeout(() => setSeedMessage(''), 3000);
        } catch (e) {
            console.error("Error adding holiday", e);
        }
    };

    const handleDeleteHoliday = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'holidays', id));
            fetchHolidays();
            setSeedMessage('Holiday removed.');
            setTimeout(() => setSeedMessage(''), 3000);
        } catch (e) {
            console.error("Error deleting holiday", e);
        }
    };

    const handleBulkAssign = async () => {
        setSeedMessage('Assigning all users to all projects...');
        try {
            const uSnap = await getDocs(query(collection(db, 'users')));
            const usersList = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const pSnap = await getDocs(query(collection(db, 'projects')));
            const projectsList = pSnap.docs.map(d => ({id: d.id, ...d.data()}));

            let assignedCount = 0;
            for (const proj of projectsList) {
                for (const u of usersList) {
                    const memberId = `${u.id}_${proj.id}`;
                    await setDoc(doc(db, 'project_members', memberId), {
                        projectId: proj.id,
                        userId: u.id,
                        email: (u as any).email || '',
                        role: (u as any).role || 'Watcher',
                        source: 'manual',
                        is_explicit: true
                    }, { merge: true });
                    assignedCount++;
                }
            }
            setSeedMessage(`${assignedCount} memberships synced!`);
            setTimeout(() => setSeedMessage(''), 3000);
            fetchCounts();
        } catch (err) {
            console.error("Failed to bulk assign", err);
            setSeedMessage('Failed to bulk assign.');
        }
    };

    const handleDeduplicateProjects = async () => {
        setSeedMessage('Merging duplicate projects...');
        try {
            const pSnap = await getDocs(collection(db, 'projects'));
            const allProjects = pSnap.docs.map(d => ({id: d.id, ...d.data() as any}));
            
            const projectGroups: Record<string, typeof allProjects> = {};
            allProjects.forEach(p => {
                if (p.title) {
                    const t = p.title.toLowerCase().trim();
                    if (!projectGroups[t]) projectGroups[t] = [];
                    projectGroups[t].push(p);
                }
            });

            let mergedCount = 0;
            let totalDeletions = 0;

            for (const title in projectGroups) {
                const group = projectGroups[title];
                if (group.length > 1) {
                    group.sort((a, b) => {
                        const aDet = a.id.startsWith('proj_') ? 1 : 0;
                        const bDet = b.id.startsWith('proj_') ? 1 : 0;
                        return bDet - aDet;
                    });
                    
                    const [winner, ...losers] = group;
                    const loserIds = losers.map(l => l.id);

                    for (const loserId of loserIds) {
                        const mSnap = await getDocs(query(collection(db, 'project_members'), where('projectId', '==', loserId)));
                        for (const mDoc of mSnap.docs) {
                            const mData = mDoc.data();
                            const newMemberId = `${mData.userId}_${winner.id}`;
                            await setDoc(doc(db, 'project_members', newMemberId), {
                                ...mData,
                                projectId: winner.id
                            }, { merge: true });
                            await deleteDoc(mDoc.ref);
                        }
                    }

                    for (const loserId of loserIds) {
                        const rSnap = await getDocs(query(collection(db, 'reviews'), where('projectId', '==', loserId)));
                        for (const rDoc of rSnap.docs) {
                            await updateDoc(rDoc.ref, { projectId: winner.id });
                        }
                    }

                    for (const loserId of loserIds) {
                        const fSnap = await getDocs(query(collection(db, 'feedback'), where('projectId', '==', loserId)));
                        for (const fDoc of fSnap.docs) {
                            await updateDoc(fDoc.ref, { projectId: winner.id });
                        }
                    }

                    for (const loserId of loserIds) {
                        await deleteDoc(doc(db, 'projects', loserId));
                        totalDeletions++;
                    }
                    mergedCount++;
                }
            }

            setSeedMessage(`${mergedCount} project groups merged. ${totalDeletions} records removed.`);
            setTimeout(() => setSeedMessage(''), 3000);
            fetchCounts();
        } catch (err) {
            console.error(err);
            setSeedMessage('Project merge failed.');
        }
    };

    const handleDeduplicateUsers = async () => {
        setSeedMessage('Merging duplicates and migrating references...');
        try {
            const uSnap = await getDocs(collection(db, 'users'));
            const allUsers = uSnap.docs.map(d => ({id: d.id, ...d.data() as any}));
            
            const emailGroups: Record<string, typeof allUsers> = {};
            allUsers.forEach(u => {
                if (u.email) {
                    const e = u.email.toLowerCase().trim();
                    if (!emailGroups[e]) emailGroups[e] = [];
                    emailGroups[e].push(u);
                }
            });

            let mergedCount = 0;
            let totalDeletions = 0;

            for (const email in emailGroups) {
                const group = emailGroups[email];
                if (group.length > 1) {
                    group.sort((a, b) => b.id.length - a.id.length);
                    const [winner, ...losers] = group;
                    const loserIds = losers.map(l => l.id);

                    const mSnap = await getDocs(query(collection(db, 'project_members'), where('userId', 'in', loserIds)));
                    for (const mDoc of mSnap.docs) {
                        const mData = mDoc.data();
                        const newMemberId = `${winner.id}_${mData.projectId}`;
                        await setDoc(doc(db, 'project_members', newMemberId), {
                            ...mData,
                            userId: winner.id,
                            email: winner.email
                        }, { merge: true });
                        await deleteDoc(mDoc.ref);
                    }

                    const pSnap = await getDocs(query(collection(db, 'projects'), where('requestorId', 'in', loserIds)));
                    for (const pDoc of pSnap.docs) {
                        await updateDoc(pDoc.ref, { requestorId: winner.id });
                    }

                    const rSnap = await getDocs(query(collection(db, 'reviews'), where('facilitatorId', 'in', loserIds)));
                    for (const rDoc of rSnap.docs) {
                        await updateDoc(rDoc.ref, { facilitatorId: winner.id });
                    }
                    
                    const fSnap = await getDocs(query(collection(db, 'feedback'), where('authorId', 'in', loserIds)));
                    for (const fDoc of fSnap.docs) {
                        await updateDoc(fDoc.ref, { authorId: winner.id });
                    }

                    for (const loser of losers) {
                        await deleteDoc(doc(db, 'users', loser.id));
                        totalDeletions++;
                    }
                    mergedCount++;
                }
            }

            setSeedMessage(`${mergedCount} groups merged. ${totalDeletions} records removed.`);
            setTimeout(() => setSeedMessage(''), 3000);
            fetchCounts();
        } catch (err) {
            console.error(err);
            setSeedMessage('Merge failed.');
        }
    };

    const handleSeedMemberships = async () => {
        setSeedMessage('Deterministic seeding mapping...');
        try {
            const uSnap = await getDocs(collection(db, 'users'));
            const uList = uSnap.docs.map(d => ({id: d.id, ...d.data() as any}));
            
            const pSnap = await getDocs(collection(db, 'projects'));
            const pList = pSnap.docs.map(d => ({id: d.id, title: d.data().title}));

            const seedSpecs = [
                { proj: 'Checkout Flow Optimization', userEmail: 'alice@uxdr.local', role: 'Requestor' },
                { proj: 'Atlas Design System Revamp', userEmail: 'sarah@uxdr.local', role: 'Facilitator' },
                { proj: 'Mobile Navigation Redesign', userEmail: 'john@uxdr.local', role: 'Reviewer' },
                { proj: 'Confidential AI Assistant UX', userEmail: 'bob@uxdr.local', role: 'Watcher' }
            ];

            const adminUser = uList.find(u => u.email === 'webpmp@gmail.com' || u.role === 'Admin');
            let relationshipsCreated = 0;

            for (const project of pList) {
                const spec = seedSpecs.find(s => s.proj === project.title);
                if (spec) {
                    const target = uList.find(u => u.email?.toLowerCase() === spec.userEmail.toLowerCase());
                    if (target) {
                        const mid = `${target.id}_${project.id}`;
                        await setDoc(doc(db, 'project_members', mid), {
                            projectId: project.id,
                            userId: target.id,
                            email: target.email,
                            role: spec.role,
                            source: 'seed-sync',
                            is_explicit: true
                        }, { merge: true });
                        relationshipsCreated++;
                    }
                }

                if (adminUser) {
                    const amid = `${adminUser.id}_${project.id}`;
                    await setDoc(doc(db, 'project_members', amid), {
                        projectId: project.id,
                        userId: adminUser.id,
                        email: adminUser.email,
                        role: 'Admin',
                        source: 'system-default',
                        is_explicit: true
                    }, { merge: true });
                    relationshipsCreated++;
                }
            }

            setSeedMessage(`Seed Successful: ${relationshipsCreated} relationships verified.`);
            setTimeout(() => setSeedMessage(''), 3000);
            fetchCounts();
        } catch (err) {
            console.error(err);
            setSeedMessage('Deterministic seed failed.');
        }
    };

    const handleSeedReviews = async () => {
        setSeedMessage('Seeding schedule...');
        try {
            const revSnap = await getDocs(query(collection(db, 'reviews')));
            for (const doc of revSnap.docs) {
                await deleteDoc(doc.ref);
            }

            const projSnap = await getDocs(query(collection(db, 'projects')));
            const projects: any[] = projSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const findProj = (title: string) => projects.find((p: any) => p.title === title)?.id;

            const reviewsToSeed = [
                { title: 'Atlas Design System Revamp', stage: 'Discovery', date: '2026-04-20T09:00:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Discovery', date: '2026-04-21T11:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Discovery', date: '2026-04-22T14:00:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Discovery', date: '2026-04-23T15:30:00Z' },
                { title: 'Atlas Design System Revamp', stage: 'Design', date: '2026-04-27T10:30:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Design', date: '2026-04-28T13:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Design', date: '2026-04-29T15:00:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Design', date: '2026-04-30T09:30:00Z' },
                { title: 'Atlas Design System Revamp', stage: 'Follow-up', date: '2026-05-04T13:30:00Z' },
                { title: 'Checkout Flow Optimization', stage: 'Follow-up', date: '2026-05-05T09:00:00Z' },
                { title: 'Confidential AI Assistant UX', stage: 'Follow-up', date: '2026-05-06T11:30:00Z' },
                { title: 'Mobile Navigation Redesign', stage: 'Follow-up', date: '2026-05-07T16:00:00Z' },
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
        setSeedMessage('Seeding database (idempotent)...');
        try {
            const demoUsers = [
                { name: 'Sarah Facilitator', email: 'sarah@uxdr.local', role: 'Facilitator' },
                { name: 'John Reviewer', email: 'john@uxdr.local', role: 'Reviewer' },
                { name: 'Alice Requestor', email: 'alice@uxdr.local', role: 'Requestor' },
                { name: 'Bob Watcher', email: 'bob@uxdr.local', role: 'Watcher' },
                { name: 'Chris A', email: 'chris@uxdr.local', role: 'Admin' }
            ];
            
            const userIds: Record<string, string> = {};
            const uSnap = await getDocs(collection(db, 'users'));
            const existingUsers = uSnap.docs.map(d => ({id: d.id, email: d.data().email}));

            for (const u of demoUsers) {
                const existing = existingUsers.find(ex => ex.email?.toLowerCase() === u.email.toLowerCase());
                if (existing) {
                    userIds[u.name] = existing.id;
                    await updateDoc(doc(db, 'users', existing.id), { name: u.name, role: u.role });
                } else {
                    const docId = `demo_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    await setDoc(doc(db, 'users', docId), u);
                    userIds[u.name] = docId;
                }
            }

            const getDeterministicProjId = (title: string) => `proj_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

            const projectsToSeed = [
                {
                    id: getDeterministicProjId('Atlas Design System Revamp'),
                    title: 'Atlas Design System Revamp',
                    description: 'Complete overhaul of the Atlas design system to unify UI components, accessibility standards, and interaction patterns across web and mobile platforms.',
                    status: 'Discovery',
                    timeline: 'Q3 2026',
                    requestorId: user?.uid,
                    disclosureRequired: false,
                    priorWorkLink: 'https://uxdr.example.com/projects/atlas-design-system-revamp',
                    createdAt: new Date().toISOString()
                },
                {
                    id: getDeterministicProjId('Checkout Flow Optimization'),
                    title: 'Checkout Flow Optimization',
                    description: 'Redesign the end-to-end ecommerce checkout experience to reduce drop-off and improve conversion rates.',
                    status: 'Design',
                    timeline: 'Next 2 weeks',
                    requestorId: userIds['Alice Requestor'] || user?.uid,
                    disclosureRequired: false, 
                    priorWorkLink: 'https://uxdr.example.com/projects/checkout-flow-optimization',
                    createdAt: new Date().toISOString()
                },
                {
                    id: getDeterministicProjId('Confidential AI Assistant UX'),
                    title: 'Confidential AI Assistant UX',
                    description: 'Design a secure AI assistant interface for enterprise users handling sensitive internal data.',
                    status: 'Discovery',
                    timeline: 'Q3 2026',
                    requestorId: user?.uid,
                    disclosureRequired: true, 
                    priorWorkLink: 'https://uxdr.example.com/projects/confidential-ai-assistant-ux',
                    createdAt: new Date().toISOString()
                },
                {
                    id: getDeterministicProjId('Mobile Navigation Redesign'),
                    title: 'Mobile Navigation Redesign',
                    description: 'Redesign mobile navigation patterns across iOS and Android applications to improve discoverability and reduce cognitive load.',
                    status: 'Follow-up',
                    timeline: 'Next 2 weeks',
                    requestorId: userIds['Alice Requestor'] || user?.uid,
                    disclosureRequired: false, 
                    priorWorkLink: 'https://uxdr.example.com/projects/mobile-navigation-redesign',
                    createdAt: new Date().toISOString()
                }
            ];
            
            for (const p of projectsToSeed) {
                const { id: projId, ...projectData } = p;
                await setDoc(doc(db, 'projects', projId), projectData, { merge: true });
                
                const adminMemberId = `${user?.uid}_${projId}`;
                if (user?.uid) {
                    await setDoc(doc(db, 'project_members', adminMemberId), {
                        projectId: projId,
                        userId: user.uid,
                        email: user.email || '',
                        role: 'Admin',
                        source: 'system-default',
                        is_explicit: true
                    }, { merge: true });
                }
            }

            setSeedMessage('Database seeded! Run SEED DATA to link members.');
            setTimeout(() => setSeedMessage(''), 3000);
            fetchCounts();
        } catch (err) {
            console.error("Failed to seed", err);
            setSeedMessage('Failed to seed database.');
        }
    };

    if (profile?.role !== 'Admin') {
        return <div className="p-8 font-mono text-red-500 flex items-center gap-2"><ShieldAlert /> Access Denied. Admin only.</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <div className="flex justify-start">
                <QuickSearch />
            </div>

            <header className="border-b border-[#262626] pb-6">
                <h1 className="mb-2">System Settings</h1>
                <p className="text-[#999999] text-sm">Global database maintenance and administrative tools.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#141414] border border-[#262626] p-6 rounded-sm">
                    <div className="text-[10px] text-[#999999] uppercase font-bold mb-1">Total Users</div>
                    <div className="text-3xl font-mono text-white">{counts.users}</div>
                </div>
                <div className="bg-[#141414] border border-[#262626] p-6 rounded-sm">
                    <div className="text-[10px] text-[#999999] uppercase font-bold mb-1">Total Projects</div>
                    <div className="text-3xl font-mono text-white">{counts.projects}</div>
                </div>
                <div className="bg-[#141414] border border-[#262626] p-6 rounded-sm">
                    <div className="text-[10px] text-[#999999] uppercase font-bold mb-1">Total Relationships</div>
                    <div className="text-3xl font-mono text-[#FF3D00]">{counts.members}</div>
                </div>
            </div>

            {/* Calendar Management Section */}
            <div className="bg-[#141414] border border-[#262626] p-8 rounded-sm space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Calendar className="w-6 h-6 text-[#FF3D00]" /> Calendar Management
                    </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* General Settings */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-mono uppercase tracking-widest text-[#999999] border-b border-[#262626] pb-2">Display & Hours</h4>
                        
                        <div className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-[#262626] rounded-sm">
                            <div>
                                <p className="text-sm font-bold text-white">Display Weekends</p>
                                <p className="text-[11px] text-[#999999]">Show Saturday and Sunday in the calendar grid.</p>
                            </div>
                            <button 
                                onClick={() => saveCalendarSettings({ showWeekends: !calendarSettings.showWeekends })}
                                className={`w-12 h-6 rounded-full transition-all relative ${calendarSettings.showWeekends ? 'bg-[#FF3D00]' : 'bg-[#262626]'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${calendarSettings.showWeekends ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-sm space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-[#FF3D00]" />
                                <p className="text-sm font-bold text-white">Standard Working Hours</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={calendarSettings.workingHoursStart}
                                        onChange={(e) => saveCalendarSettings({ workingHoursStart: e.target.value })}
                                        className="w-full bg-[#141414] border border-[#262626] text-white p-2 text-sm rounded outline-none focus:border-[#FF3D00]"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">End Time</label>
                                    <input 
                                        type="time" 
                                        value={calendarSettings.workingHoursEnd}
                                        onChange={(e) => saveCalendarSettings({ workingHoursEnd: e.target.value })}
                                        className="w-full bg-[#141414] border border-[#262626] text-white p-2 text-sm rounded outline-none focus:border-[#FF3D00]"
                                    />
                                </div>
                            </div>
                            <p className="text-[11px] text-[#999999]">These hours define the default visible range in the availability calendar.</p>
                        </div>
                    </div>

                    {/* Holidays & Events */}
                    <div className="space-y-6">
                        <h4 className="text-xs font-mono uppercase tracking-widest text-[#999999] border-b border-[#262626] pb-2">Corporate Holidays & Events</h4>
                        
                        <form onSubmit={handleAddHoliday} className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-sm space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">Event Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. Labor Day"
                                        value={newHoliday.name}
                                        onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
                                        className="w-full bg-[#141414] border border-[#262626] text-white p-2 text-sm rounded outline-none focus:border-[#FF3D00]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={newHoliday.date}
                                        onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                                        className="w-full bg-[#141414] border border-[#262626] text-white p-2 text-sm rounded outline-none focus:border-[#FF3D00]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">Description (Optional)</label>
                                <input 
                                    type="text" 
                                    placeholder="Calendar will be blocked for this day"
                                    value={newHoliday.description}
                                    onChange={e => setNewHoliday({...newHoliday, description: e.target.value})}
                                    className="w-full bg-[#141414] border border-[#262626] text-white p-2 text-sm rounded outline-none focus:border-[#FF3D00]"
                                />
                            </div>
                            <button type="submit" className="w-full bg-[#FF3D00] text-white py-2 rounded text-xs font-bold uppercase tracking-wider hover:bg-[#E63900] transition-colors">
                                Add Blocking Event
                            </button>
                        </form>

                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                            {holidays.length === 0 ? (
                                <p className="text-[11px] text-[#666666] italic">No corporate holidays defined.</p>
                            ) : (
                                holidays.sort((a,b) => a.date.localeCompare(b.date)).map(h => (
                                    <div key={h.id} className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-[#262626] rounded-sm group">
                                        <div>
                                            <p className="text-sm font-bold text-white">{h.name}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-[#999999]">
                                                <Calendar className="w-3 h-3" />
                                                <span>{h.date}</span>
                                                {h.description && <span>• {h.description}</span>}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteHoliday(h.id)}
                                            className="p-1 text-[#666666] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#141414] border border-[#262626] p-8 rounded-sm">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Database className="w-6 h-6 text-[#FF3D00]" /> Database Operations
                    </h3>
                    {seedMessage && <span className="font-mono text-[11px] text-[#00E676] bg-[#00E67633] px-3 py-1 rounded-full animate-pulse">{seedMessage}</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button onClick={handleSeedMemberships} className="flex flex-col items-start gap-2 p-4 bg-[#0A0A0A] border border-[#262626] hover:border-[#FF3D00] transition-all group rounded-sm text-left">
                        <div className="w-10 h-10 rounded bg-[#FF3D00] flex items-center justify-center text-white mb-2">
                           <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white uppercase text-[12px] tracking-wider">Seed Project Members</span>
                        <p className="text-[#999999] text-[11px]">Creates deterministic user-project links without duplicating users.</p>
                    </button>

                    <button onClick={handleSeedData} className="flex flex-col items-start gap-2 p-4 bg-[#0A0A0A] border border-[#262626] hover:border-[#FF3D00] transition-all group rounded-sm text-left">
                        <div className="w-10 h-10 rounded bg-[#262626] group-hover:bg-[#FF3D00] flex items-center justify-center text-[#999999] group-hover:text-white mb-2 transition-colors">
                           <Database className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white uppercase text-[12px] tracking-wider">Initialize Database</span>
                        <p className="text-[#999999] text-[11px]">Seeds core demo users and projects using idempotent IDs.</p>
                    </button>

                    <button onClick={handleSeedReviews} className="flex flex-col items-start gap-2 p-4 bg-[#0A0A0A] border border-[#262626] hover:border-[#FF3D00] transition-all group rounded-sm text-left">
                        <div className="w-10 h-10 rounded bg-[#262626] group-hover:bg-[#FF3D00] flex items-center justify-center text-[#999999] group-hover:text-white mb-2 transition-colors">
                           <Calendar className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white uppercase text-[12px] tracking-wider">Seed Calendar</span>
                        <p className="text-[#999999] text-[11px]">Populates the project reviews schedule across 4 weeks.</p>
                    </button>

                    <button onClick={handleDeduplicateUsers} className="flex flex-col items-start gap-2 p-4 bg-[#0A0A0A] border border-[#262626] hover:border-[#FF3D00] transition-all group rounded-sm text-left text-orange-200">
                        <div className="w-10 h-10 rounded bg-[#262626] group-hover:bg-orange-600 flex items-center justify-center text-[#999999] group-hover:text-white mb-2 transition-colors">
                           <Users className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white uppercase text-[12px] tracking-wider">Deduplicate Users</span>
                        <p className="text-[#999999] text-[11px]">Identifies duplicate emails and migrates all references to a winner ID.</p>
                    </button>

                    <button onClick={handleDeduplicateProjects} className="flex flex-col items-start gap-2 p-4 bg-[#0A0A0A] border border-[#262626] hover:border-[#FF3D00] transition-all group rounded-sm text-left">
                        <div className="w-10 h-10 rounded bg-[#262626] group-hover:bg-orange-600 flex items-center justify-center text-[#999999] group-hover:text-white mb-2 transition-colors">
                           <Trash2 className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-white uppercase text-[12px] tracking-wider">Deduplicate Projects</span>
                        <p className="text-[#999999] text-[11px]">Merges projects with identical titles and reassigns all sub-data.</p>
                    </button>

                    <button onClick={handleBulkAssign} className="flex flex-col items-start gap-2 p-4 bg-[#0A0A0A] border border-[#262626] hover:border-white transition-all group rounded-sm text-left">
                        <div className="w-10 h-10 rounded bg-[#262626] flex items-center justify-center text-[#999999] mb-2 transition-colors">
                           <Users className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-[#999999] uppercase text-[12px] tracking-wider">Bulk Assign All</span>
                        <p className="text-[#666666] text-[11px]">Connects EVERY user in the directory to EVERY project (Legacy sync).</p>
                    </button>
                </div>
            </div>
        </div>
    );
};
