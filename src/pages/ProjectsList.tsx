import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus } from 'lucide-react';

export const ProjectsList = () => {
    const { profile, user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                let allProjects = snap.docs.map(d => ({id: d.id, ...d.data()}));

                if (profile?.role === 'Requestor') {
                    allProjects = allProjects.filter((p: any) => p.requestorId === user?.uid);
                } else if (profile?.role === 'Guest') {
                    allProjects = allProjects.filter((p: any) => !p.disclosureRequired);
                }
                
                setProjects(allProjects);
            } catch (error) {
                handleFirestoreError(error, OperationType.LIST, 'projects');
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, [profile, user]);

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Projects...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6 border-b border-[#262626] pb-4">
                <h1 className="panel-title !mb-0">Active Review Lifecycle</h1>
                {['Admin', 'Facilitator', 'Requestor'].includes(profile?.role || '') && (
                    <Link to="/projects/new" className="bg-white text-black px-4 py-3 font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:opacity-80 rounded-sm">
                        <Plus className="w-4 h-4" /> New Project
                    </Link>
                )}
            </div>

            <div className="bg-[#0A0A0A]">
                <div className="data-row bg-[#141414] border-[#262626] rounded-t-sm cursor-default px-4 border-b-0 grid-cols-[2fr_1fr_1fr_1fr]">
                    <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Project Name</div>
                    <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Status</div>
                    <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Timeline</div>
                    <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Disclosure</div>
                </div>
                {projects.length === 0 ? (
                    <div className="p-8 text-center text-[#999999] text-sm border-t border-[#262626]">No projects found.</div>
                ) : (
                    projects.map(p => (
                        <Link to={`/projects/${p.id}`} key={p.id} className="data-row grid-cols-[2fr_1fr_1fr_1fr] border-[#262626] px-4 hover:bg-[#141414]">
                            <div className="font-semibold text-[16px] pr-4 truncate group-hover:text-white text-white/90">{p.title}</div>
                            <div className="flex items-center">
                                <span className={`font-mono text-[10px] uppercase border px-2 py-1 rounded inline-block ${
                                    p.status === 'Approved' ? 'border-[#00E676] text-[#00E676]' : 
                                    p.status === 'Fit & Finish' ? 'border-[#FF3D00] text-[#FF3D00]' : 'border-[#262626] text-[#999999]'
                                }`}>
                                    {p.status}
                                </span>
                            </div>
                            <div className="text-[12px] text-[#999999] flex items-center truncate pr-2">{p.timeline || 'N/A'}</div>
                            <div className="text-[12px] text-[#999999] flex items-center">
                                {p.disclosureRequired ? <span className="text-[#FF3D00]">Strict</span> : 'Public'}
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
