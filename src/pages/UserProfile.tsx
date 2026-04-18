import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, getDocs, updateDoc, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { ArrowLeft, User, Briefcase, Mail, Edit2, Check, X, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const UserProfile = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const [profileUser, setProfileUser] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [viewerMembershipIds, setViewerMembershipIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditingNames, setIsEditingNames] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isInternal = profile?.role === 'Admin' || profile?.role === 'Facilitator';

    useEffect(() => {
        if (!userId) return;
        
        const fetchUserProfile = async () => {
            try {
                const userSnap = await getDoc(doc(db, 'users', userId));
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setProfileUser({ id: userSnap.id, ...data });
                    
                    // Fallback to name if firstName/lastName don't exist
                    const parts = (data.name || '').split(' ');
                    setFirstName(data.firstName || parts[0] || '');
                    setLastName(data.lastName || parts.slice(1).join(' ') || '');
                }

                // Fetch canonical project_members for this user
                const mq = query(collection(db, 'project_members'), where('userId', '==', userId));
                const mSnap = await getDocs(mq);
                const membershipProjectIds = mSnap.docs.map(d => d.data().projectId);

                // Fetch memberships for the VIEWER
                let viewerMemberIds: string[] = [];
                if (user?.uid) {
                    const vmq = query(collection(db, 'project_members'), where('userId', '==', user.uid));
                    const vmSnap = await getDocs(vmq);
                    viewerMemberIds = vmSnap.docs.map(d => d.data().projectId);
                    setViewerMembershipIds(viewerMemberIds);
                }

                const pQuery = query(collection(db, 'projects'));
                const pSnap = await getDocs(pQuery);
                
                const allProjects = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
                const userProjects = allProjects.filter((p: any) => {
                    if (p.requestorId === userId) return true;
                    if (membershipProjectIds.includes(p.id)) return true;
                    if (profileUser?.role === 'Admin') return true; 
                    return false;
                });
                
                setProjects(userProjects);
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `users/${userId}`);
            } finally {
                setLoading(false);
            }
        };
        fetchUserProfile();
    }, [userId, profileUser?.email, profileUser?.role]);

    const handleSaveNames = async () => {
        if (!userId) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                firstName,
                lastName,
                name: `${firstName} ${lastName}`.trim()
            });
            setProfileUser({ ...profileUser, firstName, lastName, name: `${firstName} ${lastName}`.trim() });
            setIsEditingNames(false);
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                await updateDoc(doc(db, 'users', userId), { photoURL: base64String });
                setProfileUser({ ...profileUser, photoURL: base64String });
            } catch (error) {
                console.error("Failed to upload pic", error);
            }
        };
        reader.readAsDataURL(file);
    };

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Profile...</div>;
    if (!profileUser) return <div className="p-8 font-mono text-white">User not found.</div>;

    const canEdit = isInternal;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <button onClick={() => navigate(-1)} className="text-[#999999] hover:text-white uppercase tracking-widest font-bold text-[11px] mb-4 flex items-center gap-2 transition-colors">
                 <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <header className="bg-[#141414] p-8 border border-[#262626] rounded-sm flex items-start gap-8">
                <div className="relative group">
                    <div className="w-24 h-24 bg-[#262626] rounded-sm flex items-center justify-center flex-none border border-[#333] overflow-hidden">
                         {profileUser.photoURL ? (
                             <img src={profileUser.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         ) : (
                             <User className="w-10 h-10 text-[#999999]" />
                         )}
                    </div>
                    {canEdit && (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                            <Camera className="w-6 h-6" />
                        </button>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                <div className="flex-1">
                     <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF3D00] mb-2 block">Team Member Profile</span>
                     {isEditingNames ? (
                         <div className="flex items-center gap-3 mb-2">
                             <input 
                                value={firstName} 
                                onChange={e => setFirstName(e.target.value)}
                                className="bg-[#0A0A0A] border border-[#262626] text-xl font-bold px-3 py-1 rounded w-40 outline-none focus:border-[#FF3D00]"
                                placeholder="First Name"
                             />
                             <input 
                                value={lastName} 
                                onChange={e => setLastName(e.target.value)}
                                className="bg-[#0A0A0A] border border-[#262626] text-xl font-bold px-3 py-1 rounded w-40 outline-none focus:border-[#FF3D00]"
                                placeholder="Last Name"
                             />
                             <button onClick={handleSaveNames} className="p-2 text-[#00E676] hover:bg-[#262626] rounded-sm"><Check className="w-5 h-5" /></button>
                             <button onClick={() => setIsEditingNames(false)} className="p-2 text-[#FF3D00] hover:bg-[#262626] rounded-sm"><X className="w-5 h-5" /></button>
                         </div>
                     ) : (
                         <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-3xl font-sans font-bold text-white">{profileUser.name}</h1>
                            {canEdit && <button onClick={() => setIsEditingNames(true)} className="text-[#999999] hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>}
                         </div>
                     )}
                     <div className="flex flex-wrap gap-4 text-sm font-mono text-[#999999]">
                         <div className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> Global Role: {profileUser.role}</div>
                         <div className="flex items-center gap-1"><Mail className="w-4 h-4" /> {profileUser.email}</div>
                     </div>
                </div>
            </header>

            <div>
                <h2 className="text-xl font-bold tracking-tight text-white mb-4">Associated Projects</h2>
                <div className="table--comfortable bg-[#141414] border border-[#262626] rounded-sm">
                    <div className="data-row cursor-default grid-cols-[minmax(220px,2fr)_minmax(180px,1fr)_1fr_1fr] px-6 py-4 bg-[#0A0A0A] border-[#262626] border-b rounded-t-sm">
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Project Title</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Project Role</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Status</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Timeline</div>
                    </div>
                     {projects.length === 0 ? (
                        <div className="p-8 text-center text-[#999999] text-sm font-mono border-t border-[#262626]">No associated projects.</div>
                    ) : (
                        projects.map(project => {
                            const canSeeTitle = profile?.role === 'Admin' || 
                                              !project.disclosureRequired || 
                                              viewerMembershipIds.includes(project.id) || 
                                              project.requestorId === user?.uid;

                            let projectRole = "Participant";
                            if (project.requestorId === userId) projectRole = "Requestor";
                            if (project.members) {
                                const mem = project.members.find((m: any) => m.userId === userId || m.email?.toLowerCase() === profileUser?.email?.toLowerCase());
                                if (mem) projectRole = mem.role;
                            }
                            if (profileUser.role === 'Admin') projectRole = "Admin";

                            return (
                                <Link to={`/projects/${project.id}`} key={project.id} className="data-row flex hover:bg-[#1A1A1A] transition-colors grid-cols-[minmax(220px,2fr)_minmax(180px,1fr)_1fr_1fr] px-6 py-4 border-[#262626] border-b last:border-b-0">
                                    <div className={`font-bold text-[14px] truncate ${canSeeTitle ? 'text-white' : 'text-[#FF3D00] italic'}`}>
                                        {canSeeTitle ? project.title : 'Confidential Project'}
                                    </div>
                                    <div className="text-sm text-[#999999] font-mono">{projectRole}</div>
                                    <div className="text-sm font-bold text-white">{project.status}</div>
                                    <div className="text-sm text-[#999999] truncate">{project.timeline || '-'}</div>
                                </Link>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
