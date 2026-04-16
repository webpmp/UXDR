import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth, AvailabilityBlock } from '../contexts/AuthContext';
import { Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, subWeeks, addWeeks, parseISO, isSameWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const CalendarPage = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    
    // Defaulting to April 19 2026 so it shows the seeded week (Apr 20th - Apr 26th) instantly
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date('2026-04-20T12:00:00'), { weekStartsOn: 0 }));
    const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [projects, setProjects] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

    useEffect(() => {
        if (!profile || !user) return;
        
        let initialAvail = profile.availability || [];
        // Apply default logic if totally empty
        if (initialAvail.length === 0) {
            const today = new Date();
            const days = Array.from({ length: 28 }).map((_, i) => addDays(today, i));
            // Default: Weekends are unavailable, weekdays are available
            days.forEach(d => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                hours.forEach(hr => {
                    initialAvail.push({ date: dateStr, hour: hr, available: !isWeekend });
                });
            });
        }
        setAvailability(initialAvail);

        const fetchData = async () => {
            try {
                // Fetch projects the user can see
                let projQuery = query(collection(db, 'projects'));
                if (profile.role === 'Requestor') {
                    projQuery = query(collection(db, 'projects'), where('requestorId', '==', user.uid));
                }
                const projSnap = await getDocs(projQuery);
                const projMap: Record<string, any> = {};
                projSnap.docs.forEach(d => {
                    projMap[d.id] = { id: d.id, ...d.data() };
                });
                setProjects(projMap);

                // Fetch all reviews and filter locally for Requestors if needed based on project visibility
                const revSnap = await getDocs(query(collection(db, 'reviews')));
                let mappedReviews: any[] = revSnap.docs.map(d => ({id: d.id, ...d.data()}));
                
                // AUTO-SEEDER for demo environment if no reviews exist (Admin context usually)
                if (mappedReviews.length === 0 && profile.role === 'Admin') {
                    const projectsList = Object.values(projMap);
                    const findProj = (title: string) => projectsList.find(p => p.title === title)?.id;

                    const reviewsToSeed = [
                        // Week 1
                        { title: 'Atlas Design System Revamp', stage: 'Discovery', date: '2026-04-20T09:00:00Z' },
                        { title: 'Checkout Flow Optimization', stage: 'Discovery', date: '2026-04-21T11:00:00Z' },
                        { title: 'Confidential AI Assistant UX', stage: 'Discovery', date: '2026-04-22T14:00:00Z' },
                        { title: 'Mobile Navigation Redesign', stage: 'Discovery', date: '2026-04-23T15:30:00Z' },
                        // Week 2
                        { title: 'Atlas Design System Revamp', stage: 'Design', date: '2026-04-27T10:30:00Z' },
                        { title: 'Checkout Flow Optimization', stage: 'Design', date: '2026-04-28T13:00:00Z' },
                        { title: 'Confidential AI Assistant UX', stage: 'Design', date: '2026-04-29T15:00:00Z' },
                        { title: 'Mobile Navigation Redesign', stage: 'Design', date: '2026-04-30T09:30:00Z' },
                        // Week 3
                        { title: 'Atlas Design System Revamp', stage: 'Follow-up', date: '2026-05-04T13:30:00Z' },
                        { title: 'Checkout Flow Optimization', stage: 'Follow-up', date: '2026-05-05T09:00:00Z' },
                        { title: 'Confidential AI Assistant UX', stage: 'Follow-up', date: '2026-05-06T11:30:00Z' },
                        { title: 'Mobile Navigation Redesign', stage: 'Follow-up', date: '2026-05-07T16:00:00Z' },
                        // Week 4
                        { title: 'Atlas Design System Revamp', stage: 'Fit & Finish', date: '2026-05-11T14:00:00Z' },
                        { title: 'Checkout Flow Optimization', stage: 'Fit & Finish', date: '2026-05-12T10:00:00Z' },
                        { title: 'Confidential AI Assistant UX', stage: 'Fit & Finish', date: '2026-05-13T13:00:00Z' },
                        { title: 'Mobile Navigation Redesign', stage: 'Fit & Finish', date: '2026-05-14T15:00:00Z' }
                    ];

                    for (const r of reviewsToSeed) {
                        const pid = findProj(r.title);
                        if (pid) {
                            const { addDoc } = await import('firebase/firestore');
                            const newDoc = await addDoc(collection(db, 'reviews'), {
                                projectId: pid,
                                stageType: r.stage,
                                status: 'Scheduled',
                                scheduledTime: r.date,
                                facilitatorId: user.uid,
                                reviewerIds: []
                            });
                            mappedReviews.push({ id: newDoc.id, projectId: pid, stageType: r.stage, status: 'Scheduled', scheduledTime: r.date });
                        }
                    }
                }

                // Filter properly for requestors 
                if (profile.role === 'Requestor') {
                    mappedReviews = mappedReviews.filter(r => projMap[r.projectId]);
                } else if (profile.role === 'Guest') {
                     mappedReviews = []; // Guests don't see reviews on calendar
                }
                
                setReviews(mappedReviews);
            } catch (error) {
                handleFirestoreError(error, OperationType.LIST, 'reviews/projects');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile, user]);

    const toggleAvailability = (dateStr: string, hour: number) => {
        setAvailability(prev => {
            const copy = [...prev];
            const existingIdx = copy.findIndex(a => a.date === dateStr && a.hour === hour);
            if (existingIdx >= 0) {
                copy[existingIdx] = { ...copy[existingIdx], available: !copy[existingIdx].available };
            } else {
                copy.push({ date: dateStr, hour, available: false }); // Toggle from default (assumed true if not in array and weekday)
            }
            return copy;
        });
    };

    const copyPreviousWeek = () => {
        const prevWeekStart = subWeeks(currentWeekStart, 1);
        const newAvail = [...availability];
        
        for (let i = 0; i < 7; i++) {
            const prevDay = format(addDays(prevWeekStart, i), 'yyyy-MM-dd');
            const currDay = format(addDays(currentWeekStart, i), 'yyyy-MM-dd');
            
            // Remove existing config for currDay
            const filtered = newAvail.filter(a => a.date !== currDay);
            
            // Copy prevDay into currDay
            const extracted = newAvail.filter(a => a.date === prevDay).map(a => ({
                ...a,
                date: currDay
            }));
            
            newAvail.length = 0;
            newAvail.push(...filtered, ...extracted);
        }
        
        setAvailability(newAvail);
    };

    const saveAvailability = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { availability });
        } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 font-mono text-[#999999]">Loading Dual Calendar...</div>;

    const days = Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));

    // Get block status
    const getBlockStatus = (dateStr: string, hour: number) => {
        const block = availability.find(a => a.date === dateStr && a.hour === hour);
        if (block) return block.available;
        const d = parseISO(dateStr);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        return !isWeekend; // Default assumed true for weekdays
    };

    // Scheduled reviews in this week
    const weeklyReviews = reviews.filter(r => r.scheduledTime && r.status === 'Scheduled');

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <header className="flex justify-between items-end border-b border-[#262626] pb-6">
                <div>
                    <h1 className="text-3xl font-sans font-bold flex items-center gap-2 mb-2">
                        <CalendarIcon className="w-8 h-8 text-[#FF3D00]" /> 
                        Calendar
                    </h1>
                    <p className="text-[#999999] text-sm">Manage availability and view scheduled UX reviews.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={copyPreviousWeek} className="border border-[#262626] text-[#999999] bg-[#141414] px-4 py-3 font-bold uppercase text-[11px] tracking-wider flex items-center gap-2 hover:text-white transition-colors rounded-sm">
                        <Copy className="w-4 h-4" /> Copy Prev Week
                    </button>
                    <button 
                       onClick={saveAvailability} 
                       disabled={saving}
                       className="cta-button !w-auto flex items-center gap-2 rounded-sm disabled:opacity-50 !py-3"
                    >
                       {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save</>}
                    </button>
                </div>
            </header>

            <div className="flex justify-between items-center bg-[#141414] border border-[#262626] p-4 rounded-sm">
                <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="hover:text-white text-[#999999]">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="font-mono text-sm tracking-widest font-bold uppercase text-white">
                    Week of {format(currentWeekStart, 'MMMM d, yyyy')}
                </div>
                <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="hover:text-white text-[#999999]">
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>

            <div className="relative border border-[#262626] bg-[#0A0A0A] overflow-x-auto">
                <div className="grid grid-cols-8 divide-x divide-[#262626] min-w-[800px]">
                    {/* Header Row */}
                    <div className="h-12 bg-[#141414]"></div>
                    {days.map(day => {
                        const isToday = isSameDay(day, new Date());
                        return (
                            <div key={day.toISOString()} className="h-12 bg-[#141414] flex flex-col items-center justify-center border-b border-[#262626]">
                                <span className={`text-[11px] font-bold uppercase tracking-widest ${isToday ? 'text-[#FF3D00]' : 'text-[#999999]'}`}>
                                    {format(day, 'EEE')}
                                </span>
                                <span className={`text-sm ${isToday ? 'text-white font-bold' : 'text-[#999999]'}`}>
                                    {format(day, 'd')}
                                </span>
                            </div>
                        )
                    })}

                    {/* Time Rows */}
                    {hours.map(hour => (
                        <React.Fragment key={hour}>
                            <div className="h-16 flex items-start justify-end p-2 text-[10px] text-[#999999] border-b border-[#262626] pr-4">
                                {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                            </div>
                            
                            {days.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isAvailable = getBlockStatus(dateStr, hour);
                                
                                // Find reviews in this hour
                                const blockReviews = weeklyReviews.filter(r => {
                                    if (!r.scheduledTime) return false;
                                    const d = new Date(r.scheduledTime);
                                    // Make sure we use local time parsing for accurate display vs UTC string. 
                                    const localD = parseISO(r.scheduledTime).toString() !== 'Invalid Date' ? parseISO(r.scheduledTime) : d;
                                    return isSameDay(localD, day) && localD.getHours() === hour;
                                });

                                return (
                                    <div key={`${dateStr}-${hour}`} className="h-16 border-b border-[#262626] relative group">
                                        <div 
                                            onClick={() => toggleAvailability(dateStr, hour)}
                                            className={`absolute inset-0 m-[1px] rounded transition-colors cursor-pointer border border-transparent 
                                            ${isAvailable ? 'hover:bg-[#1A1A1A]' : 'bg-[#FF3D00]/10 border-[#FF3D00]/30 hover:bg-[#FF3D00]/20'}`}
                                            title={isAvailable ? "Available (Click to mark Not Available)" : "Not Available (Click to mark Available)"}
                                        >
                                            {!isAvailable && <div className="absolute top-1 left-1 text-[#FF3D00] text-[9px] font-bold uppercase tracking-tighter mix-blend-screen opacity-50">N/A</div>}
                                        </div>

                                        {/* Scheduled Review Overlays */}
                                        {blockReviews.map((r, idx) => {
                                            const proj = projects[r.projectId];
                                            if (!proj) return null;
                                            
                                            // Handle offset for 30min blocks
                                            const localD = new Date(r.scheduledTime);
                                            const minutes = localD.getMinutes();
                                            const topOffset = minutes === 30 ? '50%' : '2px';

                                            return (
                                                <div 
                                                    key={r.id} 
                                                    onClick={() => navigate(`/projects/${r.projectId}`)}
                                                    className="absolute inset-x-[2px] z-10 bg-[#FF3D00] text-white rounded p-1 cursor-pointer hover:brightness-110 shadow-lg shadow-black/50 overflow-hidden flex flex-col"
                                                    style={{ top: topOffset, height: 'calc(100% - 4px)' }}
                                                    title={`Review: ${proj.title}`}
                                                >
                                                    <span className="font-bold text-[10px] truncate flex justify-between items-center bg-black/20 p-[2px] rounded-sm tracking-tight mb-[2px]">
                                                        {format(localD, 'h:mm a')}
                                                    </span>
                                                    <span className="font-bold text-[10px] truncate leading-tight tracking-tight">{proj.title}</span>
                                                    <span className="text-[9px] opacity-90 leading-tight truncate">{r.stageType}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            
            <div className="flex gap-6 mt-4 opacity-70">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#141414] border border-[#262626] rounded-sm"></div>
                    <span className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Available Block</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#FF3D00]/10 border border-[#FF3D00]/30 rounded-sm"></div>
                    <span className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Unavailable</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#FF3D00] rounded-sm shadow-md"></div>
                    <span className="text-[11px] text-[#999999] uppercase tracking-wider font-bold">Scheduled Review</span>
                </div>
            </div>
        </div>
    )
}
