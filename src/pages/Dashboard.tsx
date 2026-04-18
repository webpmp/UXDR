import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { Plus, CheckCircle, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { QuickSearch } from '../components/QuickSearch';

import { TaskList } from '../components/TaskList';

export const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ open: 0, approved: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [membersMap, setMembersMap] = useState<Record<string, any[]>>({});

  const [myMemberProjectIds, setMyMemberProjectIds] = useState<string[]>([]);

  const canSeeProject = (p: any) => {
    if (profile?.role === 'Admin') return true;
    if (!p.disclosureRequired) return true;
    if (p.requestorId === user?.uid) return true;
    return myMemberProjectIds.includes(p.id);
  };

  useEffect(() => {
    if (!profile) return;
    
    // Fetch metrics and projects
    const fetchData = async () => {
      try {
        if (!user?.uid) return;
        // Fetch my memberships first
        const mq = query(collection(db, 'project_members'), where('userId', '==', user.uid));
        const mSnap = await getDocs(mq);
        const myIds = mSnap.docs.map(d => d.data().projectId);
        setMyMemberProjectIds(myIds);

        const uSnap = await getDocs(collection(db, 'users'));
        const uMap: Record<string, any> = {};
        uSnap.docs.forEach(d => uMap[d.id] = d.data());
        setUsersMap(uMap);

        const allMSnap = await getDocs(collection(db, 'project_members'));
        const mGroup: Record<string, any[]> = {};
        allMSnap.docs.forEach(d => {
            const m = d.data();
            if (!mGroup[m.projectId]) mGroup[m.projectId] = [];
            mGroup[m.projectId].push(m);
        });
        setMembersMap(mGroup);

        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const allProjects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const visibleProjects = allProjects.filter((p: any) => {
            if (profile?.role === 'Admin') return true;
            if (!p.disclosureRequired) return true;
            if (p.requestorId === user?.uid) return true;
            return myIds.includes(p.id);
        });

        // Filter projects current user is a member of for metrics
        const myProjects = allProjects.filter((p: any) => {
            if (profile?.role === 'Admin') return true;
            if (p.requestorId === user?.uid) return true;
            return myIds.includes(p.id);
        });

        let open = 0;
        let approved = 0;

        myProjects.forEach((p: any) => {
          if (p.status === 'Approved' || p.status === 'Approved-Changes Required') {
            approved++;
          } else {
            open++;
          }
        });

        // For completed reviews, fetch all reviews for these projects
        const rq = query(collection(db, 'reviews'));
        const rSnap = await getDocs(rq);
        const allReviews = rSnap.docs.map(d => d.data());
        
        const myProjectIds = new Set(myProjects.map(p => p.id));
        const completedReviews = allReviews.filter((r: any) => 
            myProjectIds.has(r.projectId) && (r.status === 'Completed' || r.status === 'Approved' || r.status === 'Approved with Revisions')
        ).length;

        setMetrics({ open, approved, completed: completedReviews });
        
        // Let's divide myProjects into 3 lists
        setRecentProjects(myProjects); // we'll filter this in render
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    }
    fetchData();
  }, [profile, user]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <div className="flex justify-start">
        <QuickSearch />
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#262626] pb-8 mb-8">
        <div>
          <h1 className="mb-2">System Dashboard</h1>
          <p className="text-[#999999] text-sm">Real-time metrics and recent UXDR activity.</p>
        </div>
        
        {profile?.role === 'Requestor' && (
          <Link to="/projects/new" className="bg-white text-black px-6 py-4 font-black uppercase text-xs tracking-wider transition hover:opacity-80 flex items-center gap-2 rounded-sm shrink-0">
            <Plus className="w-5 h-5" />
            New Project Request
          </Link>
        )}
      </header>

      <TaskList />

      <hr className="border-[#262626] my-8" />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-lg pointer-events-none">
           <div className="flex justify-between items-start mb-6">
              <span className="text-[11px] text-[#999999] uppercase tracking-wider">Open Projects</span>
              <Clock className="w-4 h-4 text-[#999999]" />
           </div>
           <div className="text-5xl font-extrabold">{metrics.open}</div>
        </div>
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-lg pointer-events-none">
           <div className="flex justify-between items-start mb-6">
              <span className="text-[11px] text-[#999999] uppercase tracking-wider">Approved</span>
              <CheckCircle className="w-4 h-4 text-[#00E676]" />
           </div>
           <div className="text-5xl font-extrabold">{metrics.approved}</div>
        </div>
        <div className="bg-[#141414] border border-[#262626] p-6 rounded-lg pointer-events-none">
           <div className="flex justify-between items-start mb-6">
              <span className="text-[11px] text-[#999999] uppercase tracking-wider">Reviews Completed</span>
              <CheckCircle className="w-4 h-4 text-[#999999]" />
           </div>
           <div className="text-5xl font-extrabold">{metrics.completed}</div>
        </div>
      </div>

      {(() => {
        const newProjects = recentProjects.filter(p => ['Intake', 'Pending'].includes(p.status));
        const inProgress = recentProjects.filter(p => !['Intake', 'Pending', 'Approved', 'Approved-Changes Required', 'Completed'].includes(p.status));
        const approved = recentProjects.filter(p => ['Approved', 'Approved-Changes Required', 'Completed'].includes(p.status));

        const renderTable = (list: any[], title: string, emptyMsg: string, isInProgress = false) => (
            <div className="mb-12">
              <div className="mb-4 flex justify-between items-end">
                <h3 className="panel-title mb-0">{title}</h3>
              </div>
              <div className="table--comfortable bg-[#0A0A0A]">
                <div className={`data-row bg-[#141414] border-[#262626] cursor-default font-bold rounded-t-sm ${isInProgress ? 'grid-cols-[2fr_120px_1.5fr_1.5fr_1.2fr]' : 'grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_1fr_1fr]'}`}>
                  <div className="text-xs text-[#999999] uppercase tracking-wider">Title</div>
                  <div className="text-xs text-[#999999] uppercase tracking-wider">Status</div>
                  {isInProgress ? (
                    <>
                      <div className="text-xs text-[#999999] uppercase tracking-wider">Facilitator</div>
                      <div className="text-xs text-[#999999] uppercase tracking-wider">Reviewers</div>
                      <div className="text-xs text-[#999999] uppercase tracking-wider">Requester</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-[#999999] uppercase tracking-wider">Timeline</div>
                      <div className="text-xs text-[#999999] uppercase tracking-wider">Request Date</div>
                    </>
                  )}
                </div>
                {list.length === 0 ? (
                  <div className="p-8 text-center text-[#999999] text-sm border-t border-[#262626]">{emptyMsg}</div>
                ) : (
                  list.slice(0, 5).map(project => {
                    const requestor = usersMap[project.requestorId];
                    const projectMembers = membersMap[project.id] || [];
                    const facilitators = projectMembers.filter(m => m.role === 'Facilitator');
                    const reviewers = projectMembers.filter(m => m.role === 'Reviewer');
                    
                    return (
                        <Link to={`/projects/${project.id}`} key={project.id} className={`data-row border-[#262626] hover:bg-[#141414] ${isInProgress ? 'grid-cols-[2fr_120px_1.5fr_1.5fr_1.2fr]' : 'grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_1fr_1fr]'}`}>
                        <div className="font-semibold text-[16px] truncate">{project.title}</div>
                        <div className="flex items-center">
                            <span className={`font-mono text-[10px] uppercase border px-2 py-1 rounded inline-block ${
                                ['Approved', 'Approved-Changes Required', 'Completed'].includes(project.status) ? 'border-[#00E676] text-[#00E676]' : 
                                project.status === 'Fit & Finish' ? 'border-[#FF3D00] text-[#FF3D00]' : 
                                ['Intake', 'Pending'].includes(project.status) ? 'border-orange-500 text-orange-500' :
                                'border-[#262626] text-[#999999]'
                            }`}>{project.status}</span>
                        </div>
                        {isInProgress ? (
                            <>
                                <div className="text-[12px] text-[#999999] flex items-center truncate pr-2">
                                    {facilitators.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {facilitators.map(f => (
                                                <span key={f.userId} className="text-[#FF3D00] truncate max-w-[120px]">
                                                    {usersMap[f.userId]?.name || 'Unknown'}
                                                </span>
                                            ))}
                                        </div>
                                    ) : <span className="text-[#333333]">Unassigned</span>}
                                </div>
                                <div className="text-[12px] text-[#999999] flex items-center truncate pr-2">
                                    {reviewers.length > 0 ? (
                                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                                            {reviewers.map(r => (
                                                <span key={r.userId} className="text-white/70 truncate max-w-[100px]">
                                                    {usersMap[r.userId]?.name || 'Unknown'}
                                                </span>
                                            ))}
                                        </div>
                                    ) : <span className="text-[#333333]">Unassigned</span>}
                                </div>
                                <div className="text-[12px] text-[#999999] flex items-center truncate">
                                    {requestor?.name || 'Unknown'}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-sm text-[#999999] truncate">{project.timeline || 'N/A'}</div>
                                <div className="text-sm text-[#999999]">{new Date(project.createdAt).toLocaleDateString()}</div>
                            </>
                        )}
                        </Link>
                    );
                  })
                )}
              </div>
            </div>
        );

        return (
            <>
                {renderTable(newProjects, "New Projects", "No new projects.")}
                {renderTable(inProgress, "In-Progress Reviews", "No in-progress projects.", true)}
                {renderTable(approved, "Approved Projects", "No approved projects.")}
            </>
        )
      })()}
    </div>
  )
}
