import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, DownloadCloud, Image as ImageIcon, CheckSquare, Users, MessageSquare, X, Upload } from 'lucide-react';

export const ReviewBoard = () => {
    const { id, reviewId } = useParams();
    const { user, profile } = useAuth();
    const [review, setReview] = useState<any>(null);
    const [project, setProject] = useState<any>(null);
    const [feedback, setFeedback] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState<'notes'|'survey'>('notes');
    const [attendeeEmail, setAttendeeEmail] = useState('');
    const [attendeeRole, setAttendeeRole] = useState('Participant');
    
    // Survey state
    const [surveyQuestions, setSurveyQuestions] = useState<{q: string, type: string}[]>([]);
    const [newQuestion, setNewQuestion] = useState('');

    useEffect(() => {
        if (!id || !reviewId) return;
        const fetchData = async () => {
            try {
                const projSnap = await getDoc(doc(db, 'projects', id));
                if (projSnap.exists()) setProject({ id: projSnap.id, ...projSnap.data() });

                const revSnap = await getDoc(doc(db, 'reviews', reviewId));
                if (revSnap.exists()) {
                    const rData = revSnap.data();
                    setReview({ id: revSnap.id, ...rData });
                    if (rData.surveyQuestions) {
                        setSurveyQuestions(rData.surveyQuestions);
                    }
                }

                const fq = query(collection(db, 'feedback'), where('reviewId', '==', reviewId));
                const feedSnap = await getDocs(fq);
                const currentFeedback = feedSnap.docs.map(d => ({id: d.id, ...d.data()}));
                setFeedback(currentFeedback);
                
                // Auto-generate 8 rows if empty and we have permissions
                const isFacilOrAdmin = ["Facilitator", "Admin"].includes(profile?.role || '');
                if (currentFeedback.length === 0 && isFacilOrAdmin && revSnap.exists()) {
                    const newFb = [];
                    for(let i=0; i<8; i++) {
                        const fb = {
                            reviewId, projectId: id, authorId: user?.uid, status: 'Open', screenName: '', screenshotUrl: '', notes: '', createdAt: new Date().toISOString()
                        };
                        const dRef = await addDoc(collection(db, 'feedback'), fb);
                        newFb.push({ id: dRef.id, ...fb });
                    }
                    setFeedback(newFb);
                }

            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `reviews/${reviewId}`);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, reviewId, profile, user]);

    const handleAddRow = async () => {
        try {
            const newFeedback = {
                reviewId, projectId: id, authorId: user?.uid, status: 'Open', screenName: '', screenshotUrl: '', notes: '', createdAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, 'feedback'), newFeedback);
            setFeedback([...feedback, { id: docRef.id, ...newFeedback }]);
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'feedback');
        }
    }

    const handleUpdateFeedback = async (fId: string, field: string, value: string) => {
        try {
            await updateDoc(doc(db, 'feedback', fId), { [field]: value });
            setFeedback(feedback.map(f => f.id === fId ? { ...f, [field]: value } : f));
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `feedback/${fId}`);
        }
    }

    const handleImageUpload = (fId: string, field: string, file: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const res = e.target?.result as string;
            handleUpdateFeedback(fId, field, res);
        };
        reader.readAsDataURL(file);
    };

    const handleImportPrevious = async () => {
        if (!project || !review) return;
        try {
            // Define stage logic order
            const stageOrder = ["Discovery", "Design", "Follow-up", "Fit & Finish"];
            const currentStageIndex = stageOrder.indexOf(review.stageType);
            if (currentStageIndex <= 0) return; // Cannot import for Discovery or unmapped
            
            // Find the most recent review of the previous stage
            const previousStageLimit = stageOrder[currentStageIndex - 1];
            
            const pq = query(collection(db, 'reviews'), where('projectId', '==', id));
            const pSnap = await getDocs(pq);
            const allReviews = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const prevReview = allReviews.find((r: any) => r.stageType === previousStageLimit);
            if (!prevReview) {
                alert('No previous phase found to import from.');
                return;
            }

            const fq = query(collection(db, 'feedback'), where('reviewId', '==', prevReview.id));
            const feedSnap = await getDocs(fq);
            const prevFeedback = feedSnap.docs.map(d => d.data());

            for (const pf of prevFeedback) {
                if (pf.notes && pf.notes.trim() !== '') {
                    const newFeedback = {
                        reviewId, projectId: id, authorId: user?.uid, status: pf.status || 'Open', 
                        screenName: pf.screenName || '', screenshotUrl: pf.screenshotUrl || '', 
                        updatedScreenshotUrl: '', notes: pf.notes || '', createdAt: new Date().toISOString(),
                        isImported: true
                    };
                    const docRef = await addDoc(collection(db, 'feedback'), newFeedback);
                    setFeedback(prev => [...prev, { id: docRef.id, ...newFeedback }]);
                }
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'feedback');
        }
    }

    const handleAddAttendee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!attendeeEmail) return;
        try {
            const currentAttendees = review.attendees || [];
            const updated = [...currentAttendees, { email: attendeeEmail, role: attendeeRole }];
            await updateDoc(doc(db, 'reviews', reviewId!), { attendees: updated });
            setReview({...review, attendees: updated});
            setAttendeeEmail('');
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
        }
    }

    const handleRemoveAttendee = async (idx: number) => {
        try {
            const updated = review.attendees.filter((_:any, i:number) => i !== idx);
            await updateDoc(doc(db, 'reviews', reviewId!), { attendees: updated });
            setReview({...review, attendees: updated});
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
        }
    }

    const handleAddSurveyQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const updated = [...surveyQuestions, { q: newQuestion, type: 'text' }];
            await updateDoc(doc(db, 'reviews', reviewId!), { surveyQuestions: updated });
            setSurveyQuestions(updated);
            setNewQuestion('');
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
        }
    }

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Review Board...</div>;
    if (!review) return <div className="p-8 font-mono text-[#999999]">Review stage not found.</div>;

    const canEdit = ["Facilitator", "Admin", "Reviewer", "Requestor"].includes(profile?.role || '');
    const isFacilOrAdmin = ["Facilitator", "Admin"].includes(profile?.role || '');
    const canImport = review.stageType !== 'Discovery';
    
    // Check if any feedback is imported to toggle the extra columns
    const hasImportedFeedback = feedback.some(f => f.isImported);

    return (
        <div className="p-8 min-h-screen bg-[#0A0A0A]">
            <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 text-[#999999] text-sm uppercase font-bold tracking-wider mb-8 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Project
            </Link>

            <header className="mb-4 flex justify-between items-end border-b border-[#262626] pb-6">
                <div>
                    <h1 className="text-3xl font-sans font-bold mb-2">{project?.title} - {review.stageType} Review</h1>
                    <span className="font-mono text-[10px] text-[#999999] uppercase tracking-widest border border-[#262626] px-2 py-1 rounded">Status: {review.status}</span>
                </div>
                {canEdit && activeTab === 'notes' && (
                    <div className="flex gap-4">
                        {canImport && (
                            <button onClick={handleImportPrevious} className="border border-[#262626] text-[#999999] bg-[#141414] px-4 py-3 font-bold uppercase text-[11px] tracking-wider flex items-center gap-2 hover:text-white transition-colors rounded-sm">
                                <DownloadCloud className="w-4 h-4" /> Import Previous Notes
                            </button>
                        )}
                        <button onClick={handleAddRow} className="cta-button flex-none w-auto flex items-center gap-2 rounded-sm py-3 px-4">
                            <Plus className="w-4 h-4" /> Add Feedback Row
                        </button>
                    </div>
                )}
            </header>

            <div className="flex border-b border-[#262626] mb-8">
                <button 
                    onClick={() => setActiveTab('notes')}
                    className={`px-6 py-4 font-bold text-[11px] uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'notes' ? 'border-[#FF3D00] text-white' : 'border-transparent text-[#999999] hover:text-white'}`}
                >
                    <CheckSquare className="w-4 h-4" /> Feedback Notes
                </button>
                <button 
                    onClick={() => setActiveTab('survey')}
                    className={`px-6 py-4 font-bold text-[11px] uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'survey' ? 'border-[#FF3D00] text-white' : 'border-transparent text-[#999999] hover:text-white'}`}
                >
                    <MessageSquare className="w-4 h-4" /> Survey Collaboration
                </button>
            </div>

            {activeTab === 'notes' && (
                <div className="space-y-8">
                    {/* Attendees Block */}
                    <div className="bg-[#141414] border border-[#262626] rounded-sm p-6">
                        <h3 className="font-bold mb-4 text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                            <Users className="w-4 h-4 text-[#FF3D00]" /> Meeting Attendees
                        </h3>
                        {isFacilOrAdmin && (
                            <form onSubmit={handleAddAttendee} className="flex gap-4 items-end mb-4">
                                <div className="flex-1 max-w-[250px]">
                                    <input value={attendeeEmail} onChange={e => setAttendeeEmail(e.target.value)} placeholder="Email address" className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-2 rounded-sm text-[13px] outline-none text-white" />
                                </div>
                                <div className="w-[150px]">
                                    <select value={attendeeRole} onChange={e => setAttendeeRole(e.target.value)} className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-4 py-[9px] rounded-sm text-[13px] outline-none text-white">
                                        <option>Participant</option><option>Requestor</option><option>Reviewer</option><option>Facilitator</option>
                                    </select>
                                </div>
                                <button type="submit" className="bg-[#262626] hover:bg-[#333] text-white px-4 py-2 font-bold text-[11px] uppercase tracking-widest rounded-sm"><Plus className="w-4 h-4" /></button>
                            </form>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {review.attendees?.length > 0 ? (
                                review.attendees.map((att: any, idx: number) => (
                                    <div key={idx} className="bg-[#0A0A0A] border border-[#262626] pl-3 pr-1 py-1 rounded-sm flex items-center gap-2 text-sm">
                                        <span className="text-white">{att.email}</span>
                                        <span className="text-[#999999] text-[10px] uppercase tracking-widest font-mono border-l border-[#262626] pl-2">{att.role}</span>
                                        {isFacilOrAdmin && (
                                            <button onClick={() => handleRemoveAttendee(idx)} className="text-[#FF3D00] hover:text-white p-1"><X className="w-3 h-3" /></button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <span className="text-[#999999] text-sm font-mono">No attendees registered for this review.</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#141414] border border-[#262626] rounded-sm overflow-x-auto">
                        <div className="min-w-[1000px]">
                            <div className={`data-row cursor-default bg-[#0A0A0A] border-[#262626] border-b-0 rounded-t-sm px-4 ${hasImportedFeedback ? 'grid-cols-[150px_100px_100px_400px_120px_150px]' : 'grid-cols-[200px_100px_400px_1fr]'}`}>
                                <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Screen Name</div>
                                <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold text-center">Screenshot</div>
                                {hasImportedFeedback && <div className="text-[11px] text-[#FF3D00] uppercase tracking-wider font-bold text-center">Updated Screenshot</div>}
                                <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold px-4">Feedback Notes</div>
                                <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Status</div>
                                {hasImportedFeedback && <div className="text-[11px] text-[#FF3D00] uppercase tracking-wider font-bold">Final Review</div>}
                            </div>
                            
                            {feedback.length === 0 ? (
                                <div className="p-12 text-center text-[#999999] text-[13px] border-t border-[#262626]">No feedback entries yet.</div>
                            ) : (
                                feedback.map(f => (
                                    <div key={f.id} className={`data-row items-start border-b border-[#262626] last:border-b-0 cursor-default px-4 hover:bg-[#1a1a1a] ${hasImportedFeedback ? 'grid-cols-[150px_100px_100px_400px_120px_150px]' : 'grid-cols-[200px_100px_400px_1fr]'}`}>
                                        <div>
                                            {canEdit ? (
                                                <input value={f.screenName || ''} onChange={e => handleUpdateFeedback(f.id, 'screenName', e.target.value)} placeholder="Home Page" className="w-full bg-transparent border-b border-transparent focus:border-[#FF3D00] outline-none text-[14px] font-medium text-white placeholder-[#999999]/50" />
                                            ) : <span className="text-[14px] font-medium text-white block truncate">{f.screenName || '-'}</span>}
                                        </div>

                                        <div className="flex flex-col items-center gap-2">
                                            {f.screenshotUrl ? (
                                                <a href={f.screenshotUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 group">
                                                    <ImageIcon className="w-5 h-5 text-[#999999] group-hover:text-[#FF3D00]" />
                                                    <span className="text-[9px] text-[#999999] uppercase">View</span>
                                                </a>
                                            ) : (
                                                <span className="text-[9px] text-[#999999] uppercase">-</span>
                                            )}
                                            {canEdit && (
                                                <div className="w-full relative">
                                                    <input type="text" placeholder="URL" value={f.screenshotUrl || ''} onChange={e => handleUpdateFeedback(f.id, 'screenshotUrl', e.target.value)} className="w-full bg-[#0A0A0A] rounded border border-[#262626] p-1 text-[10px] text-center text-[#999999] focus:border-[#FF3D00] outline-none mb-1" />
                                                    <label className="cursor-pointer bg-[#262626] hover:bg-[#333] text-white text-[9px] font-bold uppercase rounded p-1 flex justify-center items-center gap-1 w-full">
                                                        <Upload className="w-3 h-3" /> Upload File
                                                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files && handleImageUpload(f.id, 'screenshotUrl', e.target.files[0])} />
                                                    </label>
                                                </div>
                                            )}
                                        </div>

                                        {hasImportedFeedback && (
                                            <div className="flex flex-col items-center gap-2">
                                                {f.updatedScreenshotUrl ? (
                                                    <a href={f.updatedScreenshotUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 group">
                                                        <ImageIcon className="w-5 h-5 text-[#FF3D00] group-hover:text-white" />
                                                        <span className="text-[9px] text-[#FF3D00] uppercase">View</span>
                                                    </a>
                                                ) : <span className="text-[9px] text-[#999999] uppercase">-</span>}
                                                {canEdit && f.isImported && (
                                                    <div className="w-full relative">
                                                        <label className="cursor-pointer bg-[#262626] hover:bg-[#333] text-[#FF3D00] text-[9px] font-bold uppercase rounded p-1 flex justify-center items-center gap-1 w-full border border-[#FF3D00]/30">
                                                            <Upload className="w-3 h-3" /> Update Image
                                                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files && handleImageUpload(f.id, 'updatedScreenshotUrl', e.target.files[0])} />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="px-4">
                                            {canEdit ? (
                                                <textarea value={f.notes || ''} onChange={e => handleUpdateFeedback(f.id, 'notes', e.target.value)} placeholder="Write feedback..." className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] p-3 rounded outline-none text-[13px] resize-none min-h-[60px] text-white placeholder-[#999999]/50" />
                                            ) : <span className="text-[13px] text-[#cccccc] whitespace-pre-wrap block">{f.notes || '-'}</span>}
                                        </div>

                                        <div>
                                            {canEdit ? (
                                                <select value={f.status} onChange={e => handleUpdateFeedback(f.id, 'status', e.target.value)} className="bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-2 py-1 rounded text-[12px] outline-none text-[#999999] w-full">
                                                    <option>Open</option>
                                                    <option>Addressed</option>
                                                    <option>Ignored</option>
                                                </select>
                                            ) : <span className="bg-[#0A0A0A] border border-[#262626] px-2 py-1 rounded text-[12px] text-[#999999]">{f.status}</span>}
                                        </div>

                                        {hasImportedFeedback && (
                                            <div>
                                                {canEdit && f.isImported ? (
                                                    <select value={f.finalStatus || 'Open'} onChange={e => handleUpdateFeedback(f.id, 'finalStatus', e.target.value)} className="bg-[#141414] border border-[#FF3D00]/50 text-white focus:border-[#FF3D00] px-2 py-1 rounded text-[12px] font-bold outline-none w-full">
                                                        <option value="Open">Select final state...</option>
                                                        <option value="Approved">Approved</option>
                                                        <option value="Approved with Revisions">Approved with Revisions</option>
                                                        <option value="Not Approved">Not Approved</option>
                                                    </select>
                                                ) : f.isImported ? (
                                                    <span className={`px-2 py-1 flex rounded font-bold text-[12px] border ${f.finalStatus === 'Approved' ? 'border-[#00E676] text-[#00E676]' : f.finalStatus?.includes('Not') ? 'border-[#FF3D00] text-[#FF3D00]' : 'border-[#262626] text-white'}`}>{f.finalStatus || 'None'}</span>
                                                ) : <span className="opacity-0">-</span>}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'survey' && (
                <div className="bg-[#141414] border border-[#262626] rounded-sm p-8">
                    <h2 className="text-xl font-bold tracking-tight text-white mb-6">Survey Questions Collaboration</h2>
                    <p className="text-[#999999] text-sm mb-6 max-w-2xl">
                        Define the questions that will be sent out in the Post-Review External Survey. All team members can collaborate on this list.
                    </p>
                    
                    <div className="space-y-4 mb-8">
                        {surveyQuestions.map((q, i) => (
                            <div key={i} className="bg-[#0A0A0A] border border-[#262626] p-4 flex gap-4 items-start">
                                <div className="text-[#FF3D00] font-mono text-xl font-bold leading-none">{i + 1}</div>
                                <div className="flex-1">
                                    <div className="text-white text-[15px] font-medium">{q.q}</div>
                                    <div className="text-[#999999] text-[11px] font-mono uppercase mt-2">Type: {q.type}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {canEdit && (
                        <form onSubmit={handleAddSurveyQuestion} className="border-t border-[#262626] pt-6 flex gap-4">
                            <input 
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                placeholder="Type a new survey question..."
                                className="flex-1 bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] p-4 text-[14px] outline-none text-white rounded-sm"
                            />
                            <button type="submit" className="cta-button !w-auto">Add Question</button>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}
