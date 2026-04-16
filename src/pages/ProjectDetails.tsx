import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ExternalLink, RefreshCw, Send, Check, ArrowLeft } from 'lucide-react';

export const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [project, setProject] = useState<any>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    // Derived state
    const isFacilitator = profile?.role === 'Facilitator' || profile?.role === 'Admin';
    const canUpdateStatus = isFacilitator || (profile?.role === 'Requestor' && project?.requestorId === profile?.id);

    const handleCopy = (rId: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/survey/${rId}`);
        setCopiedId(rId);
        setTimeout(() => setCopiedId(null), 2000);
    }

    useEffect(() => {
        if (!id) return;
        const fetchProject = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'projects', id));
                if (docSnap.exists()) {
                    setProject({ id: docSnap.id, ...docSnap.data() });
                }

                const rq = query(collection(db, 'reviews'), where('projectId', '==', id));
                const rqSnap = await getDocs(rq);
                setReviews(rqSnap.docs.map(d => ({id: d.id, ...d.data()})));
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `projects/${id}`);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id]);

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
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF3D00] mb-3 block">Project Request</span>
                        <h1 className="text-4xl font-sans font-bold text-white mb-4 tracking-tight">{project.title}</h1>
                        <p className="text-[#999999] max-w-3xl leading-relaxed text-[15px]">{project.description}</p>
                    </div>
                    {isFacilitator && (
                        <div className="bg-[#0A0A0A] p-4 border border-[#262626] rounded-sm min-w-[200px]">
                             <label className="font-mono text-[10px] block uppercase mb-2 text-[#999999]">Current Workflow State</label>
                             <select 
                                value={project.status} 
                                onChange={e => handleUpdateStatus(e.target.value)}
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
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-[#262626]">
                    <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#999999] block mb-2">Timeline</span>
                        <span className="text-white text-sm font-medium">{project.timeline || 'N/A'}</span>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#999999] block mb-2">Init Date</span>
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
                            {project.disclosureRequired ? 'Strict/Confidential' : 'Public System'}
                        </span>
                    </div>
                </div>
            </header>

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

                        return (
                            <div key={review.id} className="bg-[#141414] border border-[#262626] p-6 group rounded-sm hover:border-[#FF3D00]/50 transition-colors">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-xl text-white">{review.stageType} Phase</h3>
                                    <span className="bg-[#0A0A0A] border border-[#262626] text-[#999999] px-4 py-2 font-bold text-[10px] uppercase tracking-widest rounded-sm">
                                        Status: <span className={review.status === 'Completed' ? 'text-[#00E676]' : 'text-white'}>{review.status}</span>
                                    </span>
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
        </div>
    )
}
