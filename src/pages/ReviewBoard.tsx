import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, DownloadCloud, Image as ImageIcon } from 'lucide-react';

export const ReviewBoard = () => {
    const { id, reviewId } = useParams();
    const { user, profile } = useAuth();
    const [review, setReview] = useState<any>(null);
    const [project, setProject] = useState<any>(null);
    const [feedback, setFeedback] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id || !reviewId) return;
        const fetchData = async () => {
            try {
                const projSnap = await getDoc(doc(db, 'projects', id));
                if (projSnap.exists()) setProject({ id: projSnap.id, ...projSnap.data() });

                const revSnap = await getDoc(doc(db, 'reviews', reviewId));
                if (revSnap.exists()) setReview({ id: revSnap.id, ...revSnap.data() });

                const fq = query(collection(db, 'feedback'), where('reviewId', '==', reviewId));
                const feedSnap = await getDocs(fq);
                setFeedback(feedSnap.docs.map(d => ({id: d.id, ...d.data()})));
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `reviews/${reviewId}`);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, reviewId]);

    const handleAddRow = async () => {
        try {
            const newFeedback = {
                reviewId,
                projectId: id,
                authorId: user?.uid,
                status: 'Open',
                screenName: '',
                screenshotUrl: '',
                notes: '',
                createdAt: new Date().toISOString()
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

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Review Board...</div>;
    if (!review) return <div className="p-8 font-mono text-[#999999]">Review stage not found.</div>;

    const canEdit = ["Facilitator", "Admin", "Reviewer", "Requestor"].includes(profile?.role || '');

    return (
        <div className="p-8 min-h-screen bg-[#0A0A0A]">
            <Link to={`/projects/${id}`} className="inline-flex items-center gap-2 text-[#999999] text-sm uppercase font-bold tracking-wider mb-8 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Project
            </Link>

            <header className="mb-8 flex justify-between items-end border-b border-[#262626] pb-6">
                <div>
                    <h1 className="text-3xl font-sans font-bold mb-2">{project?.title} - {review.stageType}</h1>
                    <span className="font-mono text-[10px] text-[#999999] uppercase tracking-widest border border-[#262626] px-2 py-1 rounded">Status: {review.status}</span>
                </div>
                {canEdit && (
                    <div className="flex gap-4">
                        <button className="border border-[#262626] text-[#999999] bg-[#141414] px-4 py-3 font-bold uppercase text-[11px] tracking-wider flex items-center gap-2 hover:text-white transition-colors rounded-sm">
                            <DownloadCloud className="w-4 h-4" /> Import Previous
                        </button>
                        <button onClick={handleAddRow} className="cta-button flex-none w-auto flex items-center gap-2 rounded-sm py-3 px-4">
                            <Plus className="w-4 h-4" /> Add Feedback Row
                        </button>
                    </div>
                )}
            </header>

            <div className="bg-[#141414] border border-[#262626] rounded-sm overflow-x-auto">
                <div className="min-w-[800px]">
                    <div className="data-row cursor-default grid-cols-[200px_100px_400px_1fr] md:grid-cols-[200px_100px_1fr_150px] px-6 bg-[#0A0A0A] border-[#262626] border-b-0 rounded-t-sm">
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Screen Name</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold text-center">Screenshot</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Feedback Notes</div>
                        <div className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Status</div>
                    </div>
                    {feedback.length === 0 ? (
                        <div className="p-12 text-center text-[#999999] text-[13px] border-t border-[#262626]">No feedback entries yet.</div>
                    ) : (
                        feedback.map(f => (
                            <div key={f.id} className="data-row grid-cols-[200px_100px_400px_1fr] md:grid-cols-[200px_100px_1fr_150px] items-start border-b border-[#262626] last:border-b-0 cursor-default px-6 hover:bg-[#1a1a1a]">
                                <div>
                                    {canEdit ? (
                                        <input 
                                            value={f.screenName || ''}
                                            onChange={e => handleUpdateFeedback(f.id, 'screenName', e.target.value)}
                                            placeholder="Home Page..."
                                            className="w-full bg-transparent border-b border-transparent focus:border-[#FF3D00] outline-none text-[14px] font-medium text-white placeholder-[#999999]/50"
                                        />
                                    ) : (
                                        <span className="text-[14px] font-medium text-white">{f.screenName || '-'}</span>
                                    )}
                                </div>
                                <div className="flex justify-center">
                                    {canEdit ? (
                                        <input 
                                           title="Screenshot URL"
                                           placeholder="URL"
                                           value={f.screenshotUrl || ''}
                                           onChange={e => handleUpdateFeedback(f.id, 'screenshotUrl', e.target.value)}
                                           className="w-full max-w-[80px] bg-[#0A0A0A] rounded border border-[#262626] focus:border-[#FF3D00] p-1 outline-none text-[10px] text-center text-[#999999]"
                                        />
                                    ) : f.screenshotUrl ? (
                                        <a href={f.screenshotUrl} target="_blank" rel="noreferrer"><ImageIcon className="w-5 h-5 text-[#999999] hover:text-[#FF3D00] mx-auto" /></a>
                                    ) : '-'}
                                </div>
                                <div className="px-4">
                                    {canEdit ? (
                                        <textarea 
                                            value={f.notes || ''}
                                            onChange={e => handleUpdateFeedback(f.id, 'notes', e.target.value)}
                                            placeholder="Write feedback..."
                                            className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] p-3 rounded outline-none text-[13px] resize-none min-h-[60px] text-white placeholder-[#999999]/50"
                                        />
                                    ) : (
                                        <span className="text-[13px] text-[#cccccc] whitespace-pre-wrap block">{f.notes || '-'}</span>
                                    )}
                                </div>
                                <div>
                                    {canEdit ? (
                                        <select 
                                            value={f.status}
                                            onChange={e => handleUpdateFeedback(f.id, 'status', e.target.value)}
                                            className="bg-[#0A0A0A] border border-[#262626] focus:border-[#FF3D00] px-2 py-1 rounded text-[12px] outline-none text-[#999999] w-full max-w-[120px]"
                                        >
                                            <option value="Open">Open</option>
                                            <option value="Addressed">Addressed</option>
                                            <option value="Ignored">Ignored</option>
                                        </select>
                                    ) : (
                                        <span className="bg-[#0A0A0A] border border-[#262626] px-2 py-1 rounded text-[12px] text-[#999999] outline-none inline-block">{f.status}</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
