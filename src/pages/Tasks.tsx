import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Circle, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Tasks = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<{ id: string, title: string, completed: boolean, link?: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile || !user) return;
        
        const computeTasks = async () => {
            const newTasks: { id: string, title: string, completed: boolean, link?: string }[] = [];
            let taskIdCounter = 0;

            const addT = (title: string, completed: boolean, link?: string) => {
                newTasks.push({ id: `task_${taskIdCounter++}`, title, completed, link });
            };

            try {
                const hasAvailability = profile.availability && profile.availability.length > 0;
                
                if (profile.role === 'Admin') {
                    const pq = query(collection(db, 'projects'), where('status', 'in', ['Intake', 'Pending']));
                    const pSnap = await getDocs(pq);
                    
                    if (!pSnap.empty) {
                        const memberSnap = await getDocs(collection(db, 'project_members'));
                        const members = memberSnap.docs.map(d => d.data());
                        
                        pSnap.docs.forEach(pDoc => {
                            const pId = pDoc.id;
                            const pData = pDoc.data();
                            const hasFacilitator = members.some(m => m.projectId === pId && m.role === 'Facilitator');
                            addT(`Assign facilitator to new project request: ${pData.title}`, hasFacilitator, `/projects/${pId}`);
                        });
                    }
                }

                if (profile.role === 'Facilitator') {
                    addT('Update availability for the next 2 weeks', hasAvailability, '/calendar');
                    
                    const mq = query(collection(db, 'project_members'), where('userId', '==', user.uid), where('role', '==', 'Facilitator'));
                    const mSnap = await getDocs(mq);
                    const myProjectIds = mSnap.docs.map(d => d.data().projectId);
                    
                    if (myProjectIds.length > 0) {
                        const rq = query(collection(db, 'reviews'));
                        const rSnap = await getDocs(rq);
                        const reviews = rSnap.docs.map(d => ({id: d.id, ...d.data() as any}));
                        
                        const memberSnap = await getDocs(collection(db, 'project_members'));
                        const allMembers = memberSnap.docs.map(d => d.data());

                        myProjectIds.forEach(pid => {
                            const upcomingReviews = reviews.filter(r => r.projectId === pid && r.status === 'Scheduled');
                            if (upcomingReviews.length > 0) {
                                const hasReviewers = allMembers.some(m => m.projectId === pid && m.role === 'Reviewer');
                                addT(`Assign reviewers for upcoming reviews in project`, hasReviewers, `/projects/${pid}`);
                            }
                        });
                    }
                }

                if (profile.role === 'Reviewer') {
                    addT('Update availability for the next 2 weeks', hasAvailability, '/calendar');
                }

                if (profile.role === 'Requestor') {
                    const pq = query(collection(db, 'projects'), where('requestorId', '==', user.uid));
                    const pSnap = await getDocs(pq);
                    const hasOpenProject = pSnap.docs.some(d => {
                        const status = d.data().status;
                        return !['Completed', 'Approved', 'Approved-Changes Required'].includes(status);
                    });
                    
                    if (hasOpenProject) {
                        addT('Update availability for the next 2 weeks on the calendar', hasAvailability, '/calendar');
                    }
                }

                setTasks(newTasks);
            } catch (err) {
                console.error("Error computing tasks", err);
            } finally {
                setLoading(false);
            }
        };

        computeTasks();
    }, [profile, user]);

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Tasks...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <button onClick={() => navigate(-1)} className="text-[#999999] hover:text-white uppercase tracking-widest font-bold text-[11px] mb-4 flex items-center gap-2 transition-colors">
                 <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">All My Tasks</h1>
            {tasks.length === 0 ? (
                <div className="bg-[#141414] p-8 text-center text-[#999999] text-sm border border-[#262626] rounded-sm font-mono">
                    You have no tasks taking up your time.
                </div>
            ) : (
                <div className="bg-[#141414] border border-[#262626] p-6 rounded-lg">
                    <div className="space-y-4">
                        {tasks.map(t => (
                            <div key={t.id} className="flex items-center gap-4 p-4 bg-[#0A0A0A] border border-[#262626] rounded-sm group transition-colors">
                                {t.completed ? (
                                    <CheckCircle className="w-6 h-6 text-[#00E676] shrink-0" />
                                ) : (
                                    <Circle className="w-6 h-6 text-[#666666] shrink-0" />
                                )}
                                <span className={`text-[15px] font-medium ${t.completed ? 'text-[#666666] line-through' : 'text-white'}`}>
                                    {t.title}
                                </span>
                                {t.link && !t.completed && (
                                    <Link to={t.link} className="ml-auto text-[#FF3D00] text-sm font-bold uppercase tracking-wider hover:text-white transition-colors">
                                        Action
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
