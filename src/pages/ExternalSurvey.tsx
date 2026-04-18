import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

export const ExternalSurvey = () => {
    const { reviewId } = useParams();
    const { user, profile, loading: authLoading, signIn } = useAuth();
    const [review, setReview] = useState<any>(null);
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    const [step, setStep] = useState<'design' | 'survey'>('design');
    const [responses, setResponses] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!reviewId) return;
        const fetchData = async () => {
            try {
                const revSnap = await getDoc(doc(db, 'reviews', reviewId));
                if (revSnap.exists()) {
                    setReview({ id: revSnap.id, ...revSnap.data() });
                    const projSnap = await getDoc(doc(db, 'projects', revSnap.data().projectId));
                    if (projSnap.exists()) {
                        setProject({ id: projSnap.id, ...projSnap.data() });
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        if (!authLoading && user) {
            fetchData();
        } else if (!authLoading && !user) {
            setLoading(false);
        }
    }, [reviewId, user, authLoading]);

    if (authLoading || loading) return <div className="p-8 font-mono text-center mt-20 text-[#999999]">Loading...</div>;

    if (!user) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 text-white">
                <h1 className="text-4xl font-sans font-bold mb-4">UX Design Review</h1>
                <p className="mb-8 font-mono text-[11px] tracking-widest uppercase opacity-60">Please sign in to view the design and provide feedback.</p>
                <button onClick={signIn} className="cta-button !w-auto min-w-[240px] rounded-sm">
                    Sign In with Google
                </button>
            </div>
        );
    }

    if (!review || !project) return <div className="p-8 font-mono text-center mt-20 text-[#999999]">Survey not found or access denied.</div>;
    
    if (submitted) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 text-white">
                <h1 className="text-4xl font-sans font-bold mb-4 text-[#00E676]">Thank You!</h1>
                <p className="mb-8 font-mono text-[11px] tracking-widest uppercase opacity-60">Your feedback has been recorded.</p>
                <Link to="/" className="uppercase font-bold tracking-widest text-xs hover:text-[#FF3D00] transition-colors border-b border-transparent hover:border-[#FF3D00]">Go to Dashboard</Link>
            </div>
        )
    }

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'feedback'), {
                reviewId,
                projectId: project.id,
                authorId: user.uid,
                status: 'Open',
                screenName: 'External Survey',
                notes: JSON.stringify(responses, null, 2),
                createdAt: new Date().toISOString()
            });
            setSubmitted(true);
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'feedback');
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col text-white">
            <header className="bg-[#141414] p-6 border-b border-[#262626] flex justify-between items-center">
                <h1 className="font-sans font-bold text-xl">{project.title} - Feedback</h1>
                <span className="font-mono text-[10px] uppercase text-[#999999]">Signed in as {profile?.name}</span>
            </header>
            
            <main className="flex-1 max-w-4xl w-full mx-auto p-8">
                {step === 'design' ? (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="bg-[#141414] p-8 border border-[#262626] rounded-sm">
                            <h2 className="text-2xl font-bold mb-4">Review the Design</h2>
                            <p className="mb-6 text-[#999999] text-sm leading-relaxed">{project.description}</p>
                            
                            {project.priorWorkLink && (
                                <a href={project.priorWorkLink} target="_blank" rel="noreferrer" className="inline-block mb-8 text-[#FF3D00] font-bold uppercase tracking-wider text-xs border-b border-[#FF3D00] pb-1">
                                    Open Design in New Tab
                                </a>
                            )}
                            
                            <div className="pt-8 border-t border-[#262626] flex justify-end">
                                <button onClick={() => setStep('survey')} className="cta-button !w-auto rounded-sm">
                                    I have reviewed the design
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in slide-in-from-right">
                        <div className="bg-[#141414] p-8 border border-[#262626] rounded-sm space-y-8">
                            <h2 className="text-2xl font-bold border-b border-[#262626] pb-4">Survey Questions</h2>
                            
                            {review.surveyQuestions && review.surveyQuestions.length > 0 ? (
                                review.surveyQuestions.map((q: any, i: number) => (
                                    <div key={i} className="space-y-4">
                                        <label className="font-bold text-[13px] uppercase tracking-wider text-[#999999] block">{i+1}. {q.q}</label>
                                        <textarea 
                                            rows={3}
                                            value={responses[`q${i}`] || ''}
                                            onChange={e => setResponses({...responses, [`q${i}`]: e.target.value})}
                                            className="w-full border border-[#262626] p-4 outline-none focus:border-[#FF3D00] bg-[#0A0A0A] rounded-sm text-sm text-white resize-none"
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="text-[#999999] font-mono text-sm italic">No specific survey questions configured. Please leave general feedback.</div>
                            )}

                            {!review.surveyQuestions?.length && (
                                <div className="space-y-4 pt-4">
                                    <label className="font-bold text-[13px] uppercase tracking-wider text-[#999999] block">Do you have any comments or suggestions?</label>
                                    <textarea 
                                        rows={4}
                                        value={responses.comments || ''}
                                        onChange={e => setResponses({...responses, comments: e.target.value})}
                                        className="w-full border border-[#262626] p-4 outline-none focus:border-[#FF3D00] bg-[#0A0A0A] rounded-sm text-sm text-white resize-none"
                                    />
                                </div>
                            )}

                            <div className="pt-8 border-t border-[#262626] flex justify-between items-center">
                                <button onClick={() => setStep('design')} className="uppercase font-mono text-[11px] font-bold tracking-widest text-[#999999] hover:text-white transition-colors">
                                    Back to Design
                                </button>
                                <button onClick={handleSubmit} disabled={submitting} className="cta-button !w-auto disabled:opacity-50 disabled:cursor-not-allowed rounded-sm">
                                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
