import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus } from 'lucide-react';
import { QuickSearch } from '../components/QuickSearch';

export const ProjectsList = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<any[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, any>>({});
    const [membersMap, setMembersMap] = useState<Record<string, any[]>>({});
    const [myMemberProjectIds, setMyMemberProjectIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile || !user) return;
        const fetchProjects = async () => {
            try {
                // Fetch my memberships
                const mq = query(collection(db, 'project_members'), where('userId', '==', user.uid));
                const mSnap = await getDocs(mq);
                const myIds = mSnap.docs.map(d => d.data().projectId);
                setMyMemberProjectIds(myIds);

                const uSnap = await getDocs(collection(db, 'users'));
                const uMap: Record<string, any> = {};
                uSnap.docs.forEach(d => uMap[d.id] = d.data());
                setUsersMap(uMap);

                // Fetch all memberships to identify facilitators and reviewers
                const allMSnap = await getDocs(collection(db, 'project_members'));
                const mGroup: Record<string, any[]> = {};
                allMSnap.docs.forEach(d => {
                    const m = d.data();
                    if (!mGroup[m.projectId]) mGroup[m.projectId] = [];
                    mGroup[m.projectId].push(m);
                });
                setMembersMap(mGroup);

                const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                let allProjects = snap.docs.map(d => ({id: d.id, ...d.data()} as any));

                const canSeeProject = (p: any) => {
                    if (profile?.role === 'Admin') return true;
                    if (!p.disclosureRequired) return true;
                    if (p.requestorId === user?.uid) return true;
                    return myIds.includes(p.id);
                };

                allProjects = allProjects.filter(canSeeProject);
                
                setProjects(allProjects);
            } catch (error: any) {
                console.error("Fetch projects error:", error);
                handleFirestoreError(error, OperationType.LIST, 'projects');
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, [profile, user]);

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Projects...</div>;

    const newProjects = projects.filter(p => ['Intake', 'Pending'].includes(p.status));
    const inProgressProjects = projects.filter(p => !['Intake', 'Pending', 'Approved', 'Approved-Changes Required', 'Completed'].includes(p.status));
    const approvedProjects = projects.filter(p => ['Approved', 'Approved-Changes Required', 'Completed'].includes(p.status));

    const renderTable = (list: any[], emptyMessage: string, isInProgress = false) => (
        <div className="table--comfortable bg-[#0A0A0A] mb-12">
            <div className={`data-row bg-[#141414] border-[#262626] rounded-t-sm cursor-default border-b-0 ${isInProgress ? 'grid-cols-[2fr_120px_1.5fr_1.5fr_1.2fr]' : 'grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_1fr_1fr]'}`}>
                <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Project Name</div>
                <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Status</div>
                {isInProgress ? (
                   <>
                       <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Facilitator</div>
                       <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Reviewers</div>
                       <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Requestor</div>
                   </>
                ) : (
                   <>
                       <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Timeline</div>
                       <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Request Date</div>
                   </>
                )}
            </div>
            {list.length === 0 ? (
                <div className="p-8 text-center text-[#999999] text-sm border-t border-[#262626]">{emptyMessage}</div>
            ) : (
                list.map(p => {
                    const requestor = usersMap[p.requestorId];
                    const projectMembers = membersMap[p.id] || [];
                    const facilitators = projectMembers.filter(m => m.role === 'Facilitator');
                    const reviewers = projectMembers.filter(m => m.role === 'Reviewer');

                    return (
                        <div 
                            key={p.id} 
                            onClick={() => navigate(`/projects/${p.id}`)}
                            className={`data-row cursor-pointer border-[#262626] hover:bg-[#141414] ${isInProgress ? 'grid-cols-[2fr_120px_1.5fr_1.5fr_1.2fr]' : 'grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_1fr_1fr]'}`}
                        >
                            <div className="font-semibold text-[16px] pr-4 truncate group-hover:text-white text-white/90">{p.title}</div>
                            <div className="flex items-center">
                                <span className={`font-mono text-[10px] uppercase border px-2 py-1 rounded inline-block ${
                                    ['Approved', 'Approved-Changes Required', 'Completed'].includes(p.status) ? 'border-[#00E676] text-[#00E676]' : 
                                    p.status === 'Fit & Finish' ? 'border-[#FF3D00] text-[#FF3D00]' : 
                                    ['Intake', 'Pending'].includes(p.status) ? 'border-orange-500 text-orange-500' :
                                    'border-[#262626] text-[#999999]'
                                }`}>
                                    {p.status}
                                </span>
                            </div>
                            
                            {isInProgress ? (
                                <>
                                    <div className="text-[12px] text-[#999999] flex items-center truncate pr-2" onClick={(e) => e.stopPropagation()}>
                                        {facilitators.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {facilitators.map(f => (
                                                    <Link key={f.userId} to={`/users/${f.userId}`} className="text-[#FF3D00] hover:text-white transition-colors truncate max-w-[120px]">
                                                        {usersMap[f.userId]?.name || 'Unknown'}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : <span className="text-[#333333]">Unassigned</span>}
                                    </div>

                                    <div className="text-[12px] text-[#999999] flex items-center truncate pr-2" onClick={(e) => e.stopPropagation()}>
                                        {reviewers.length > 0 ? (
                                            <div className="flex flex-wrap gap-x-2 gap-y-1">
                                                {reviewers.map(r => (
                                                    <Link key={r.userId} to={`/users/${r.userId}`} className="text-white/70 hover:text-white transition-colors truncate max-w-[100px]">
                                                        {usersMap[r.userId]?.name || 'Unknown'}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : <span className="text-[#333333]">Unassigned</span>}
                                    </div>

                                    <div className="text-[12px] text-[#999999] flex items-center truncate" onClick={(e) => e.stopPropagation()}>
                                        {requestor ? (
                                            <Link 
                                                to={`/users/${p.requestorId}`} 
                                                className="text-[#999999] hover:text-white transition-colors truncate"
                                            >
                                                {requestor.name}
                                            </Link>
                                        ) : 'Unknown'}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-sm text-[#999999] truncate">{p.timeline || 'N/A'}</div>
                                    <div className="text-sm text-[#999999]">{new Date(p.createdAt).toLocaleDateString()}</div>
                                </>
                            )}
                        </div>
                    )
                })
            )}
        </div>
    );

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <div className="flex justify-start">
                <QuickSearch />
            </div>

            <header className="flex justify-between items-end border-b border-[#262626] pb-6">
                <div>
                   <h1 className="mb-2">Projects Directory</h1>
                   <p className="text-[#999999] text-sm">Active project review lifecycle and status tracking.</p>
                </div>
                {['Admin', 'Facilitator', 'Requestor'].includes(profile?.role || '') && (
                    <Link to="/projects/new" className="bg-white text-black px-4 py-3 font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:opacity-80 rounded-sm">
                        <Plus className="w-4 h-4" /> New Project
                    </Link>
                )}
            </header>

            <div>
                <h3 className="panel-title mb-4">New Projects</h3>
                {renderTable(newProjects, "No new project requests.", false)}

                <h3 className="panel-title mb-4">In-Progress Reviews</h3>
                {renderTable(inProgressProjects, "No in-progress projects found.", true)}

                <h3 className="panel-title mb-4">Approved Projects</h3>
                {renderTable(approvedProjects, "No completed or approved projects.", false)}
            </div>
        </div>
    )
}
