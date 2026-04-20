import { useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, setDoc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function BackgroundSyncWorker() {
    const { user, profile } = useAuth();
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (!user || !profile?.calendarConnection) return;

        async function processSync(reviewId: string, eventData: any) {
            const currentSyncMap = profile.calendarSyncMap || {};
            try {
                const res = await fetch('/api/calendar/sync-event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        provider: profile.calendarConnection.provider,
                        accessToken: profile.calendarConnection.accessToken,
                        refreshToken: profile.calendarConnection.refreshToken,
                        eventData
                    })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    const newMap = { ...currentSyncMap };
                    if (eventData.action === 'delete') {
                        delete newMap[reviewId];
                    } else {
                        newMap[reviewId] = {
                            hash: eventData.hash,
                            externalEventId: data.externalEventId,
                            status: 'synced',
                            lastSynced: new Date().toISOString()
                        };
                    }
                    await updateDoc(doc(db, 'users', user.uid), { calendarSyncMap: newMap });
                    await setDoc(doc(db, 'calendar_sync_jobs', `${user.uid}_${reviewId}`), { status: 'synced', completedAt: new Date().toISOString() }, { merge: true });
                } else {
                    throw new Error(data.error);
                }
            } catch (err: any) {
                const isAuthError = err.message.toLowerCase().includes('expire') || err.message.toLowerCase().includes('auth') || err.message.toLowerCase().includes('credential');
                
                if (isAuthError && profile.calendarConnection) {
                     await updateDoc(doc(db, 'users', user.uid), { 
                         'calendarConnection.status': 'error',
                         'calendarConnection.error': err.message 
                     });
                }

                const newMap = { ...currentSyncMap, [reviewId]: { ...(currentSyncMap[reviewId] || {}), status: 'error', error: err.message } };
                await updateDoc(doc(db, 'users', user.uid), { calendarSyncMap: newMap });
                await setDoc(doc(db, 'calendar_sync_jobs', `${user.uid}_${reviewId}`), { status: 'error', error: err.message }, { merge: true });
            }
        }

        const syncLoop = async () => {
            try {
                // 1. Fetch user's sync state map
                const syncMap = profile.calendarSyncMap || {};
                
                // 2. Fetch projects the user is a non-admin member of
                const membersSnap = await getDocs(query(collection(db, 'project_members'), where('userId', '==', user.uid)));
                const myProjects: Record<string, string> = {}; // projectId -> role
                membersSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.role !== 'Admin') {
                        myProjects[data.projectId] = data.role;
                    }
                });
                
                const validProjectIds = Object.keys(myProjects);
                if (validProjectIds.length === 0) return;

                // We can't use 'in' operator for > 10 items, but for this demo context we can just query all reviews and filter.
                const reviewsSnap = await getDocs(collection(db, 'reviews'));
                const myReviews = reviewsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter(r => validProjectIds.includes(r.projectId) && r.scheduledTime);

                const reviewIdsSet = new Set(myReviews.map(r => r.id));

                // 3. Check for deletions (in syncMap but not in myReviews)
                for (const rId of Object.keys(syncMap)) {
                    if (!reviewIdsSet.has(rId) && syncMap[rId].status === 'synced' && syncMap[rId].externalEventId) {
                        // Needs deletion
                        await processSync(rId, { action: 'delete', externalEventId: syncMap[rId].externalEventId });
                    }
                }

                // 4. Check for creations or updates
                for (const review of myReviews) {
                    const hash = `${review.scheduledTime}_${review.durationMinutes || 60}_${review.stageType}`;
                    const state = syncMap[review.id];
                    
                    if (!state || state.hash !== hash || state.status === 'error' || state.status === 'pending') {
                        // Needs sync
                        // Create/update job in collection
                        await setDoc(doc(db, 'calendar_sync_jobs', `${user.uid}_${review.id}`), {
                            userId: user.uid,
                            reviewId: review.id,
                            status: 'pending',
                            queuedAt: new Date().toISOString()
                        }, { merge: true });

                        // Get project title
                        const pSnap = await getDocs(query(collection(db, 'projects')));
                        const pDoc = pSnap.docs.find(d => d.id === review.projectId);
                        const title = pDoc ? pDoc.data().title : 'UXDR Review';

                        const startTime = new Date(review.scheduledTime);
                        const duration = review.durationMinutes || 60;
                        const endTime = new Date(startTime.getTime() + duration * 60000);

                        await processSync(review.id, {
                            action: state?.externalEventId ? 'update' : 'create',
                            externalEventId: state?.externalEventId,
                            title: `UXDR: ${title} (${review.stageType})`,
                            description: `You are assigned as ${myProjects[review.projectId]} for this review.`,
                            start: startTime.toISOString(),
                            end: endTime.toISOString(),
                            hash
                        });
                    }
                }
            } catch (err) {
                console.error("Background Sync Worker Error:", err);
            }
        };

        syncLoop();
        intervalRef.current = window.setInterval(syncLoop, 15000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user, profile]);

    return null;
}
