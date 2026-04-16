import React, { useState } from 'react';
import { Search as SearchIcon, User, Briefcase } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, getDocs, or, and, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const GlobalSearch = () => {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<{users: any[], projects: any[]}>({ users: [], projects: [] });
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;
        setLoading(true);

        const lowerTerm = searchTerm.toLowerCase();

        try {
            // Search Users manually (Firestore doesn't support generic full text search natively easily, so we fetch and filter)
            let matchingUsers: any[] = [];
            // Role restriction: Guests cannot see users list
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
            let matchingProjects = ps.docs
                .map(d => ({id: d.id, ...d.data()} as any))
                .filter(p => 
                    (p.title && p.title.toLowerCase().includes(lowerTerm)) ||
                    (p.status && p.status.toLowerCase().includes(lowerTerm))
                );

            if (profile?.role === 'Guest') {
                matchingProjects = matchingProjects.filter(p => !p.disclosureRequired);
            } else if (profile?.role === 'Requestor') {
                // Requestors see public OR their own
                matchingProjects = matchingProjects.filter(p => !p.disclosureRequired || p.requestorId === profile.id);
            }

            setResults({ users: matchingUsers, projects: matchingProjects });

        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'search');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h1 className="panel-title mb-6">Global Search</h1>
            
            <form onSubmit={handleSearch} className="relative mb-12">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
                <input 
                   type="text" 
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   placeholder="Search users by name, email, or role... Search projects by title..."
                   className="w-full bg-[#141414] border border-[#262626] py-4 pl-12 pr-4 text-[14px] text-white outline-none rounded focus:border-[#FF3D00]"
                />
            </form>

            {loading && <div className="text-sm text-[#999999]">Searching...</div>}

            {!loading && (results.users.length > 0 || results.projects.length > 0) && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 
                 {/* Users Results */}
                 {profile?.role !== 'Guest' && (
                     <div>
                        <h2 className="panel-title mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" /> People
                        </h2>
                        {results.users.length === 0 ? <p className="text-sm text-[#999999]">No people found.</p> : (
                            <div className="space-y-4">
                                {results.users.map(u => (
                                    <div key={u.id} className="bg-[#141414] border border-[#262626] rounded-sm p-4 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-[16px]">{u.name}</p>
                                            <p className="text-[12px] text-[#999999] mt-1">{u.email}</p>
                                        </div>
                                        <span className="bg-[#FF3D00] text-white px-2 py-1 text-[11px] font-bold uppercase rounded-sm">{u.role}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                     </div>
                 )}

                 {/* Projects Results */}
                 <div>
                    <h2 className="panel-title mb-4 flex items-center gap-2">
                        <Briefcase className="w-5 h-5" /> Projects
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
