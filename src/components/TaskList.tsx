import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TaskList = () => {
    const { profile, user } = useAuth();
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
                // Determine availability status for current week and next 2 weeks
                // Simplification for client logic
                const hasAvailability = profile.availability && profile.availability.length > 0;
                
                // Admin Tasks
                if (profile.role === 'Admin') {
                    const pq = query(collection(db, 'projects'), where('status', 'in', ['Intake', 'Pending']));
                    const pSnap = await getDocs(pq);
                    
                    if (!pSnap.empty) {
                        // Check if they need facilitators
                        // We fetch members to see if these have Facilitators
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
                    // Availability Task
                    addT('Update availability for the next 2 weeks', hasAvailability, '/calendar');
                    
                    // Assign reviewers ...
                    // Projects where I am facilitator
                    const mq = query(collection(db, 'project_members'), where('userId', '==', user.uid), where('role', '==', 'Facilitator'));
                    const mSnap = await getDocs(mq);
                    const myProjectIds = mSnap.docs.map(d => d.data().projectId);
                    
                    if (myProjectIds.length > 0) {
                        // Check reviews
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
                    // Check if open project exists
                    const pq = query(collection(db, 'projects'), where('requestorId', '==', user.uid));
                    const pSnap = await getDocs(pq);
                    const hasOpenProject = pSnap.docs.some(d => {
                        const status = d.data().status;
                        return !['Completed', 'Approved'].includes(status); // Still open
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

    if (loading) return null;
    
    // Uncompleted vs Completed logic isn't strictly requested to hide completed, but 'Add a checkmark next the task' means show them
    const displayTasks = tasks.slice(0, 10);

    if (displayTasks.length === 0) return null;

    return (
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-lg mb-12">
            <div className="flex justify-between items-center mb-6">
                <h3 className="panel-title mb-0">My Tasks</h3>
                {tasks.length > 10 && (
                    <Link to="/tasks" className="text-[#FF3D00] text-[11px] font-bold uppercase tracking-wider hover:text-white flex items-center gap-1">
                        View All Tasks <ArrowRight className="w-3 h-3" />
                    </Link>
                )}
            </div>
            <div className="space-y-2">
                {displayTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 bg-[#0A0A0A] border border-[#262626] rounded-sm group">
                        {t.completed ? (
                            <CheckCircle className="w-5 h-5 text-[#00E676] shrink-0" />
                        ) : (
                            <Circle className="w-5 h-5 text-[#666666] shrink-0" />
                        )}
                        <span className={`text-sm ${t.completed ? 'text-[#666666] line-through' : 'text-white'}`}>
                            {t.title}
                        </span>
                        {t.link && !t.completed && (
                            <Link to={t.link} className="ml-auto text-[#FF3D00] text-xs font-bold hover:underline">
                                Action
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
