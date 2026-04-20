import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ExternalLink, RefreshCw, Send, Check, ArrowLeft, Users, X, Edit2 } from 'lucide-react';

export const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile, user } = useAuth();
    const [project, setProject] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    const [activeTab, setActiveTab] = useState<'reviews'|'members'|'history'>('reviews');
    
    // Edit states
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Team member states
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Participant');

    // History state
    const [history, setHistory] = useState<any[]>([]);

    // Derived state
    const isFacilitator = profile?.role === 'Facilitator' || profile?.role === 'Admin';
    const canUpdateStatus = isFacilitator || (profile?.role === 'Requestor' && project?.requestorId === profile?.id);
    const canEditMembers = isFacilitator || profile?.role === 'Reviewer' || project?.requestorId === profile?.id;
    const canEditInfo = isFacilitator || (profile?.role === 'Requestor' && project?.requestorId === profile?.id);

    // ... (rest of imports/state at top)

    const addHistory = async (action: string, details: string) => {
        if (!id || !user) return;
        try {
            const newEntry = {
                projectId: id,
                action,
                details,
                userId: user.uid,
                userName: profile?.name || user.email || 'Unknown',
                timestamp: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'project_history'), newEntry);
            if (profile?.role === 'Admin') {
                setHistory(prev => [{id: docRef.id, ...newEntry}, ...prev].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            }
        } catch (e) {
            console.error("History logging failed", e);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        try {
            // Find user id by email for the membership record
            const uq = query(collection(db, 'users'), where('email', '==', inviteEmail.toLowerCase()));
            const uSnap = await getDocs(uq);
            const userId = uSnap.docs[0]?.id || 'unknown';

            const memberId = `${userId}_${id}`;
            const newMember = { 
                projectId: id, 
                userId, 
                email: inviteEmail.toLowerCase(), 
                role: inviteRole,
                source: 'manual',
                is_explicit: true 
            };
            await setDoc(doc(db, 'project_members', memberId), newMember);
            setMembers([...members, { id: memberId, ...newMember }]);
            setInviteEmail('');
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `project_members`);
        }
    };

    const handleRemoveMember = async (mId: string) => {
        try {
            await deleteDoc(doc(db, 'project_members', mId)); 
            setMembers(members.filter(m => m.id !== mId));
        } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `project_members/${mId}`);
        }
    };

    const handleSyncAllUsers = async () => {
        if (!id) return;
        setDebugInfo('Syncing all users...');
        try {
            const uSnap = await getDocs(collection(db, 'users'));
            const allUsers = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const newMembers = [];
            for (const u of allUsers) {
                const memberId = `${u.id}_${id}`;
                const mData = {
                    projectId: id,
                    userId: u.id,
                    email: (u as any).email || '',
                    role: (u as any).role || 'Watcher',
                    source: 'bulk-sync',
                    is_explicit: true
                };
                await setDoc(doc(db, 'project_members', memberId), mData);
                newMembers.push({ id: memberId, ...mData, name: (u as any).name });
            }
            setMembers(newMembers);
            setDebugInfo(`Successfully synced ${allUsers.length} users!`);
            setTimeout(() => setDebugInfo(''), 3000);
        } catch (err) {
            console.error(err);
            setDebugInfo('Sync failed.');
        }
    };

    const handleCopy = (rId: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/survey/${rId}`);
        setCopiedId(rId);
        setTimeout(() => setCopiedId(null), 2000);
    }

    useEffect(() => {
        if (!id || !profile) return;
        const fetchProject = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'projects', id));
                if (docSnap.exists()) {
                    const projectData = { id: docSnap.id, ...docSnap.data() } as any;
                    
                    // Fetch explicit members from canonical table
                    const mq = query(collection(db, 'project_members'), where('projectId', '==', id));
                    const mSnap = await getDocs(mq);
                    const rawProjectMembers = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    // Enhancement: Fetch user names for these IDs
                    const uq = query(collection(db, 'users'));
                    const uSnap = await getDocs(uq);
                    const userMap: Record<string, string> = {};
                    uSnap.docs.forEach(d => {
                        userMap[d.id] = d.data().name;
                    });

                    const projectMembers = rawProjectMembers.map((m: any) => ({
                        ...m,
                        name: userMap[m.userId] || 'Unknown User'
                    }));
                    
                    setMembers(projectMembers);

                    // SECURITY: Check if user has access to strict disclosure project
                    const isMember = projectMembers.some((m: any) => m.email?.toLowerCase() === profile.email.toLowerCase());
                    const canSee = profile.role === 'Admin' || !projectData.disclosureRequired || isMember || projectData.requestorId === user?.uid;
                    
                    if (!canSee) {
                        alert("Access Denied: This project requires strict disclosure and you are not a team member.");
                        navigate('/');
                        return;
                    }

                    if (profile.role === 'Admin') {
                        const hq = query(collection(db, 'project_history'), where('projectId', '==', id));
                        const hSnap = await getDocs(hq);
                        const hData: any[] = hSnap.docs.map(d => ({id: d.id, ...d.data()}));
                        
                        hData.push({
                            id: 'genesis-creation',
                            action: 'Project Requested',
                            userName: userMap[projectData.requestorId] || 'Unknown User',
                            details: `Project "${projectData.title}" was submitted to Intake.`,
                            timestamp: projectData.createdAt || new Date().toISOString()
                        });

                        hData.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                        setHistory(hData);
                    }

                    setProject(projectData);
                    setEditTitle(projectData.title);
                    setEditDescription(projectData.description);
                }

                const rq = query(collection(db, 'reviews'), where('projectId', '==', id));
                const rqSnap = await getDocs(rq);
                const rawReviews = rqSnap.docs.map(d => ({id: d.id, ...d.data()}));
                
                const stageOrder: Record<string, number> = {
                    "Discovery": 1,
                    "Design": 2,
                    "Follow-up": 3,
                    "Fit & Finish": 4
                };
                
                rawReviews.sort((a: any, b: any) => (stageOrder[a.stageType] || 99) - (stageOrder[b.stageType] || 99));
                setReviews(rawReviews);
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `projects/${id}`);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id, profile, navigate]);

    const handleUpdateStatus = async (newStatus: string) => {
        try {
            await updateDoc(doc(db, 'projects', id!), { status: newStatus });
            setProject({...project, status: newStatus});
            
            // If advancing to a specific stage, create that stage if missing
            const applicableStages = ["Discovery", "Design", "Follow-up", "Fit & Finish"];
            if (applicableStages.includes(newStatus)) {
               const stageExists = reviews.some(r => r.stageType === newStatus);
               if (!stageExists) {
                   const newReview = await addDoc(collection(db, 'reviews'), {
                       projectId: id,
                       stageType: newStatus,
                       status: 'Pending'
                   });
                   setReviews([...reviews, { id: newReview.id, projectId: id, stageType: newStatus, status: 'Pending' }]);
               }
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
        }
    }

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Project...</div>;
    if (!project) return <div className="p-8 font-mono text-white">Project not found or access denied.</div>;

    const WORKFLOW_STATES = ["Intake", "Discovery", "Design", "Follow-up", "Fit & Finish", "Approved", "Approved-Changes Required"];

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <button onClick={() => navigate(-1)} className="text-[#999999] hover:text-white uppercase tracking-widest font-bold text-[11px] mb-4 flex items-center gap-2 transition-colors">
                 <ArrowLeft className="w-4 h-4" /> Back to Calendar
            </button>
            <header className="bg-[#141414] p-8 border border-[#262626] rounded-sm">
                <div className="flex justify-between items-start mb-6 gap-8">
                    <div className="flex-1">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF3D00] mb-3 block">Project Request</span>
                        {isEditingInfo ? (
                            <div className="space-y-4 max-w-2xl">
                                <input 
                                    className="bg-[#0A0A0A] border border-[#262626] text-3xl font-bold px-4 py-2 rounded w-full outline-none focus:border-[#FF3D00] text-white"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Project Title"
                                />
                                <textarea 
                                    className="bg-[#0A0A0A] border border-[#262626] text-[15px] px-4 py-2 rounded w-full outline-none focus:border-[#FF3D00] text-[#999999] h-32"
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    placeholder="Project Description"
                                />
                                <div className="flex gap-2">
                                    <button 
                                        onClick={async () => {
                                            try {
                                                await updateDoc(doc(db, 'projects', id!), { title: editTitle, description: editDescription });
                                                setProject({ ...project, title: editTitle, description: editDescription });
                                                if (editTitle !== project.title) await addHistory('Title Changed', `From "${project.title}" to "${editTitle}"`);
                                                if (editDescription !== project.description) await addHistory('Description Changed', 'Project description was updated');
                                                setIsEditingInfo(false);
                                            } catch (err) {
                                                handleFirestoreError(err, OperationType.UPDATE, `projects/${id}`);
                                            }
                                        }}
                                        className="bg-[#00E676] text-black px-4 py-2 text-xs font-bold rounded-sm hover:opacity-80 transition-opacity"
                                    >
                                        Save Changes
                                    </button>
                                    <button onClick={() => setIsEditingInfo(false)} className="bg-[#262626] text-white px-4 py-2 text-xs font-bold rounded-sm hover:bg-[#333] transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <h1 className="text-4xl font-sans font-bold text-white tracking-tight">{project.title}</h1>
                                    {canEditInfo && <button onClick={() => setIsEditingInfo(true)} className="text-[#999999] hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>}
                                </div>
                                <p className="text-[#999999] max-w-3xl leading-relaxed text-[15px] whitespace-pre-wrap">{project.description}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-3 shrink-0">
                        {isFacilitator && (
                            <div className="bg-[#0A0A0A] p-4 border border-[#262626] rounded-sm min-w-[200px]">
                                <label className="font-mono text-[10px] block uppercase mb-2 text-[#999999]">Current Workflow State</label>
                                <select 
                                    value={project.status} 
                                    onChange={async(e) => {
                                        const newStatus = e.target.value;
                                        await handleUpdateStatus(newStatus);
                                        await addHistory('Project Status Changed', `Status changed to ${newStatus}`);
                                    }}
                                    className="bg-transparent font-bold text-white uppercase text-[12px] tracking-wide w-full outline-none cursor-pointer hover:text-[#FF3D00] transition-colors"
                                >
                                    {WORKFLOW_STATES.map(s => <option key={s} value={s} className="bg-[#141414] text-white">{s}</option>)}
                                </select>
                            </div>
                        )}
                        {!isFacilitator && (
                            <div className="bg-[#0A0A0A] p-4 border border-[#262626] rounded-sm min-w-[200px]">
                                <span className="font-mono text-[10px] block uppercase mb-2 text-[#999999]">Current Workflow State</span>
                                <span className="font-bold text-white uppercase text-[12px] tracking-wide">{project.status}</span>
                            </div>
                        )}
                        
                        {isFacilitator && (
                            <div className="bg-[#0A0A0A] p-4 border border-[#262626] rounded-sm min-w-[200px] flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase text-[#999999]">Strict Disclosure</span>
                                <button 
                                    onClick={async () => {
                                        try {
                                            const newVal = !project.disclosureRequired;
                                            await updateDoc(doc(db, 'projects', id!), { disclosureRequired: newVal });
                                            setProject({ ...project, disclosureRequired: newVal });
                                            await addHistory('Disclosure Context Changed', newVal ? 'Changed to Confidential' : 'Changed to Public');
                                        } catch (err) {
                                            handleFirestoreError(err, OperationType.UPDATE, `projects/${id}`);
                                        }
                                    }}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${project.disclosureRequired ? 'bg-[#FF3D00]' : 'bg-[#262626]'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${project.disclosureRequired ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-[#262626]">
                    <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#999999] block mb-2">Timeline</span>
                        <span className="text-white text-sm font-medium">{project.timeline || 'N/A'}</span>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#999999] block mb-2">Request Date</span>
                        <span className="text-white text-sm font-medium">{new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#999999] block mb-2">Prior Work</span>
                        {project.priorWorkLink ? (
                            <a href={project.priorWorkLink} target="_blank" rel="noreferrer" className="text-[#FF3D00] hover:text-white transition-colors text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                View Link <ExternalLink className="w-3 h-3" />
                            </a>
                        ) : <span className="text-[#666666] text-sm">None Attached</span>}
                    </div>
                    <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#999999] block mb-2">Disclosure Context</span>
                        <span className={`text-[12px] font-bold uppercase tracking-wider ${project.disclosureRequired ? 'text-[#FF3D00]' : 'text-white'}`}>
                            {project.disclosureRequired ? 'Confidential' : 'Public'}
                        </span>
                    </div>
                </div>
            </header>

            <div className="flex border-b border-[#262626]">
                <button 
                    onClick={() => setActiveTab('reviews')}
                    className={`px-6 py-4 font-bold text-[11px] uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'reviews' ? 'border-[#FF3D00] text-white' : 'border-transparent text-[#999999] hover:text-white'}`}
                >
                    Review Stages
                </button>
                <button 
                    onClick={() => setActiveTab('members')}
                    className={`px-6 py-4 font-bold text-[11px] uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'members' ? 'border-[#FF3D00] text-white' : 'border-transparent text-[#999999] hover:text-white'}`}
                >
                    <Users className="w-4 h-4" /> Team Members
                </button>
                {profile?.role === 'Admin' && (
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-4 font-bold text-[11px] uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'history' ? 'border-[#FF3D00] text-white' : 'border-transparent text-[#999999] hover:text-white'}`}
                    >
                        History
                    </button>
                )}
            </div>

            {activeTab === 'reviews' && (
                <div>
                    <div className="flex justify-between items-end mb-6 pb-2 border-b border-[#262626]">
                        <h2 className="text-2xl font-bold tracking-tight text-white flex flex-col">
                            <span className="font-mono text-[11px] text-[#FF3D00] uppercase tracking-widest mb-1">Execution</span>
                            Review Stages
                        </h2>
                        {isFacilitator && project.status === 'Follow-up' && (
                            <button onClick={() => handleUpdateStatus('Follow-up')} className="text-[#999999] hover:text-white uppercase tracking-widest text-[11px] font-bold flex items-center gap-2 transition-colors bg-[#141414] border border-[#262626] px-4 py-2 rounded-sm hover:-translate-y-[1px]">
                                <RefreshCw className="w-3 h-3" /> Insert Iterative Review
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {reviews.map(review => {
                            const isScheduled = !!review.scheduledTime;
                            const dateFormatted = isScheduled ? new Date(review.scheduledTime).toLocaleString() : 'TBD (Not mapped to block)';

                            const reviewStatusOptions = review.stageType === 'Fit & Finish' 
                                ? ["Pending", "Scheduled", "Completed", "Approved", "Approved with Revisions", "Not Approved"]
                                : ["Pending", "Scheduled", "Completed"];

                            return (
                                <div key={review.id} className="bg-[#141414] border border-[#262626] p-6 group rounded-sm hover:border-[#FF3D00]/50 transition-colors">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-xl text-white">{review.stageType} Review</h3>
                                        <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#262626] text-[#999999] px-4 py-2 rounded-sm font-bold text-[10px] uppercase tracking-widest">
                                            Status: 
                                            {isFacilitator ? (
                                                <select 
                                                    value={review.status}
                                                    onChange={async (e) => {
                                                        const newStatus = e.target.value;
                                                        try {
                                                            await updateDoc(doc(db, 'reviews', review.id), { status: newStatus });
                                                            setReviews(reviews.map(r => r.id === review.id ? { ...r, status: newStatus } : r));
                                                            await addHistory('Review Status Changed', `${review.stageType} review status changed to ${newStatus}`);
                                                        } catch (err) {
                                                            handleFirestoreError(err, OperationType.UPDATE, `reviews/${review.id}`);
                                                        }
                                                    }}
                                                    className={`bg-transparent outline-none cursor-pointer hover:text-white transition-colors ${review.status === 'Completed' || review.status.startsWith('Approved') ? 'text-[#00E676]' : review.status === 'Not Approved' ? 'text-[#FF3D00]' : 'text-white'}`}
                                                >
                                                    {reviewStatusOptions.map(opt => <option key={opt} value={opt} className="bg-[#141414] text-white">{opt}</option>)}
                                                </select>
                                            ) : (
                                                <span className={review.status === 'Completed' || review.status.startsWith('Approved') ? 'text-[#00E676]' : review.status === 'Not Approved' ? 'text-[#FF3D00]' : 'text-white'}>{review.status}</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-mono text-[12px] p-4 bg-[#0A0A0A] border border-[#262626] rounded-sm text-[#999999]">
                                        <div><span className="text-white">Lead:</span> {review.facilitatorId || 'Unassigned'}</div>
                                        <div><span className="text-white">Reviewers:</span> {review.reviewerIds?.length || 0} attached</div>
                                        <div className="truncate"><span className="text-white">Slot:</span> {dateFormatted}</div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-4">
                                        <Link to={`/projects/${project.id}/reviews/${review.id}`} className="bg-[#FF3D00] text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm hover:opacity-80 transition-opacity">
                                            Open Stage Board
                                        </Link>
                                        {(isFacilitator || profile?.role === 'Requestor') && (
                                             <button onClick={() => handleCopy(review.id)} className="flex relative items-center gap-2 border border-[#262626] text-[#999999] bg-[#0A0A0A] hover:text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#1A1A1A] transition-colors">
                                                {copiedId === review.id ? <><Check className="w-4 h-4 text-[#00E676]" /> Copied to Clipboard!</> : <><Send className="w-4 h-4" /> Share External Survey Link</>}
                                             </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {reviews.length === 0 && (
                            <div className="p-12 text-center text-[#999999] font-mono text-sm bg-[#141414] border border-[#262626] rounded-sm">
                                <span className="opacity-50 tracking-wider">No structured review stages have been mapped to this workflow yet.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'members' && (
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-6 flex justify-between items-center">
                        Team Members
                        {profile?.role === 'Admin' && (
                            <div className="flex items-center gap-3">
                                {debugInfo && <span className="text-[10px] font-mono text-[#00E676]">{debugInfo}</span>}
                                <button 
                                    onClick={handleSyncAllUsers}
                                    className="bg-[#141414] border border-[#262626] text-[#999999] hover:text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-colors"
                                >
                                    Force Sync All Users
                                </button>
                            </div>
                        )}
                    </h2>
                    {canEditMembers && (
                        <div className="bg-[#141414] border border-[#262626] p-6 rounded-sm mb-6">
                            <h3 className="font-bold mb-4 text-[#999999] text-sm uppercase tracking-wider">Invite Team Member</h3>
                            <form onSubmit={handleAddMember} className="flex gap-4 items-end flex-wrap">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-[11px] text-[#999999] uppercase tracking-wider font-bold mb-2">Email</label>
                                    <input 
                                        type="email"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        placeholder="member@example.com"
                                        className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-2 rounded-sm text-[13px] outline-none text-white"
                                        required
                                    />
                                </div>
                                <div className="w-[200px]">
                                    <label className="block text-[11px] text-[#999999] uppercase tracking-wider font-bold mb-2">Role</label>
                                    <select 
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                        className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-[9px] rounded-sm text-[13px] outline-none text-white"
                                    >
                                        <option value="Participant">Participant</option>
                                        <option value="Guest">Guest</option>
                                        <option value="Watcher">Watcher</option>
                                        {isFacilitator && <option value="Reviewer">Reviewer</option>}
                                        {isFacilitator && <option value="Facilitator">Facilitator</option>}
                                    </select>
                                </div>
                                <button type="submit" className="cta-button !w-auto !py-[9px] !px-6 rounded-sm flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="table--comfortable bg-[#141414] border border-[#262626] rounded-sm">
                        <div className="data-row cursor-default grid-cols-[1fr_2fr_1.5fr_auto] bg-[#0A0A0A] border-[#262626] border-b rounded-t-sm">
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Name</div>
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Email</div>
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Project Role</div>
                            <div className="w-8"></div>
                        </div>
                        {members && members.length > 0 ? members.map((m: any) => (
                            <div key={m.id} className="data-row grid grid-cols-[1fr_2fr_1.5fr_auto] hover:bg-[#1A1A1A] transition-colors border-[#262626] border-b last:border-b-0 items-center">
                                <div className="truncate">
                                    <Link 
                                        to={`/users/${m.userId}`} 
                                        className="text-white text-[14px] font-bold hover:text-[#FF3D00] transition-colors"
                                    >
                                        {m.name}
                                    </Link>
                                </div>
                                <div className="text-[#999999] text-[13px] truncate">{m.email}</div>
                                <div className="text-sm text-[#FF3D00] font-mono font-bold">{m.role}</div>
                                <div>
                                    {canEditMembers && (
                                        <button onClick={() => handleRemoveMember(m.id)} className="text-[#FF3D00] hover:text-[#FFFFFF] transition-colors p-2">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-[#999999] text-sm font-mono">No team members added explicitly.</div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'history' && profile?.role === 'Admin' && (
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Project History</h2>
                    <div className="table--comfortable bg-[#141414] border border-[#262626] rounded-sm">
                        <div className="data-row cursor-default grid-cols-[1.5fr_1fr_2fr_1.5fr] bg-[#0A0A0A] border-[#262626] border-b rounded-t-sm">
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Action</div>
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">User</div>
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Details</div>
                            <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Date & Time</div>
                        </div>
                        {history && history.length > 0 ? history.map((h: any) => (
                            <div key={h.id} className="data-row grid grid-cols-[1.5fr_1fr_2fr_1.5fr] hover:bg-[#1A1A1A] transition-colors border-[#262626] border-b last:border-b-0 items-center">
                                <div className="text-[#FF3D00] font-mono text-[11px] font-bold tracking-wider uppercase truncate">{h.action}</div>
                                <div className="text-white text-sm font-semibold truncate">{h.userName}</div>
                                <div className="text-[#999999] text-sm truncate" title={h.details}>{h.details}</div>
                                <div className="text-[#666666] text-sm truncate">{new Date(h.timestamp).toLocaleString()}</div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-[#999999] text-sm font-mono">No history recorded for this project yet.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
