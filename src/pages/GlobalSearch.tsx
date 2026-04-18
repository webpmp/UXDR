import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, User, Briefcase } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const GlobalSearch = () => {
    const { profile, user } = useAuth();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState<{users: any[], projects: any[], allVisibleProjects: any[]}>({ users: [], projects: [], allVisibleProjects: [] });
    const [loading, setLoading] = useState(false);

    const performSearch = useCallback(async (term: string) => {
        if (!term.trim()) return;
        setLoading(true);
        const lowerTerm = term.toLowerCase();

        try {
            // Fetch all memberships for visibility and indexing
            const mq = query(collection(db, 'project_members'));
            const mSnap = await getDocs(mq);
            const allMemberships = mSnap.docs.map(d => d.data());

            // Search Users manually
            let matchingUsers: any[] = [];
            if (profile?.role !== 'Guest') {
               const uq = query(collection(db, 'users'));
               const us = await getDocs(uq);
               matchingUsers = us.docs
                   .map(d => ({id: d.id, ...d.data()} as any))
                   .filter(u => 
                       (u.name && u.name.toLowerCase().includes(lowerTerm)) || 
                       (u.email && u.email.toLowerCase().includes(lowerTerm)) ||
                       (u.role && u.role.toLowerCase().includes(lowerTerm))
                   );
            }

            // Search Projects
            const pq = query(collection(db, 'projects'));
            const ps = await getDocs(pq);
            const allProjects = ps.docs.map(d => ({id: d.id, ...d.data()} as any));

            const canSeeProject = (p: any) => {
                if (profile?.role === 'Admin') return true;
                if (!p.disclosureRequired) return true;
                if (p.requestorId === user?.uid) return true;
                return allMemberships.some((m: any) => m.projectId === p.id && m.userId === user?.uid);
            };

            const allVisibleProjects = allProjects.filter(canSeeProject);

            const matchingProjects = allVisibleProjects.filter(p => 
                (p.title && p.title.toLowerCase().includes(lowerTerm)) ||
                (p.status && p.status.toLowerCase().includes(lowerTerm))
            );

            setResults({ users: matchingUsers, projects: matchingProjects, allVisibleProjects, allMemberships } as any);
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'search');
        } finally {
            setLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        const queryTerm = searchParams.get('q');
        if (queryTerm) {
            setSearchTerm(queryTerm);
            performSearch(queryTerm);
        }
    }, [searchParams, performSearch]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchTerm);
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <div className="flex justify-start">
                <form onSubmit={handleSearch} className="relative w-full max-w-3xl">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#999999]" />
                    <input 
                       type="text" 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       placeholder="Search users by name, email, or role... Search projects by title..."
                       className="w-full bg-[#141414] border border-[#262626] py-5 pl-14 pr-4 text-[16px] text-white outline-none rounded focus:border-[#FF3D00] shadow-2xl transition-all"
                    />
                </form>
            </div>

            <header className="border-b border-[#262626] pb-6">
                <h1 className="mb-2">Search Results</h1>
                <p className="text-[#999999] text-sm">Search Results for "{searchParams.get('q')}".</p>
            </header>

            {loading && <div className="text-sm font-mono text-[#999999] animate-pulse">Running system search...</div>}

            {!loading && (results.users.length > 0 || results.projects.length > 0) && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* People Results */}
                  {profile?.role !== 'Guest' && (
                      <div className="order-2">
                         <h2 className="panel-title mb-6 flex items-center gap-2">
                             <User className="w-5 h-5 text-[#FF3D00]" /> People
                         </h2>
                         {results.users.length === 0 ? <p className="text-sm text-[#999999]">No people found.</p> : (
                             <div className="space-y-4">
                                 {results.users.map(u => {
                                     const userProjects = results.allVisibleProjects.filter(p => 
                                         (results as any).allMemberships?.some((m: any) => m.projectId === p.id && (m.userId === u.id || m.email?.toLowerCase() === u.email?.toLowerCase()))
                                     );

                                     return (
                                         <div key={u.id} className="bg-[#141414] border border-[#262626] rounded-sm p-4">
                                             <div className="flex justify-between items-start mb-3">
                                                 <div>
                                                     <Link to={`/users/${u.id}`} className="font-semibold text-[16px] hover:text-[#FF3D00] transition-colors">{u.name}</Link>
                                                     <p className="text-[12px] text-[#999999] mt-1">{u.email}</p>
                                                 </div>
                                                 <span className="bg-[#FF3D00] text-white px-2 py-1 text-[11px] font-bold uppercase rounded-sm">{u.role}</span>
                                             </div>
                                             
                                             {userProjects.length > 0 && (
                                                 <div className="mt-4 pt-3 border-t border-[#262626]/50">
                                                     <p className="text-[10px] text-[#999999] uppercase tracking-widest font-bold mb-2">Projects</p>
                                                     <div className="flex flex-wrap gap-2">
                                                         {userProjects.map(p => (
                                                             <Link 
                                                                 key={p.id} 
                                                                 to={`/projects/${p.id}`} 
                                                                 className="text-[11px] text-[#999999] hover:text-[#FF3D00] transition-colors underline decoration-[#262626]"
                                                             >
                                                                 {p.title}
                                                             </Link>
                                                         ))}
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                      </div>
                  )}

                  {/* Projects Results */}
                  <div className="order-1">
                    <h2 className="panel-title mb-6 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-[#FF3D00]" /> Projects
                    </h2>
                    {results.projects.length === 0 ? <p className="text-sm text-[#999999]">No projects found.</p> : (
                        <div className="space-y-4">
                            {results.projects.map(p => (
                                <Link to={`/projects/${p.id}`} key={p.id} className="block bg-[#141414] border border-[#262626] rounded-sm p-4 hover:border-[#FF3D00] transition-colors group">
                                    <p className="font-semibold text-[16px] group-hover:text-white text-white/90">{p.title}</p>
                                    <p className="font-mono text-[10px] text-[#999999] uppercase border border-[#262626] px-2 py-1 rounded inline-block mt-2">{p.status}</p>
                                </Link>
                            ))}
                        </div>
                    )}
                 </div>
               </div>
            )}
        </div>
    )
}
