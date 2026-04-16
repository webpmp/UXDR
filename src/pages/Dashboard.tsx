import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { Plus, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { profile, user } = useAuth();
  const [metrics, setMetrics] = useState({ open: 0, approved: 0, completed: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    
    // Fetch metrics and projects
    const fetchData = async () => {
      try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let open = 0;
        let approved = 0;

        projects.forEach((p: any) => {
          if (p.status === 'Approved' || p.status === 'Approved-Changes Required') {
            approved++;
          } else {
            open++;
          }
        });

        setMetrics({ open, approved, completed: approved });
        
        let visibleProjects = projects;
        if (profile.role === 'Requestor') {
          visibleProjects = projects.filter((p: any) => p.requestorId === user?.uid);
        } else if (profile.role === 'Guest') {
          visibleProjects = projects.filter((p: any) => !p.disclosureRequired);
        }
        
        setRecentProjects(visibleProjects.slice(0, 5));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    }
    fetchData();
  }, [profile, user]);

  return (
    <div className="p-8">
      <header className="mb-10 flex justify-between items-end border-b border-[#262626] pb-8">
        <div>
          <h1 className="text-4xl font-sans font-bold mb-2">Welcome, {profile?.name.split(' ')[0]}</h1>
          <p className="text-[#999999] text-sm uppercase tracking-wider font-bold text-[11px]">{profile?.role}</p>
        </div>
        {profile?.role === 'Requestor' && (
          <Link to="/projects/new" className="bg-white text-black px-6 py-4 font-black uppercase text-xs tracking-wider transition hover:opacity-80 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Project Request
          </Link>
        )}
      </header>

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

      <h3 className="panel-title mb-4">Recent Projects</h3>
      <div className="bg-[#0A0A0A]">
        <div className="data-row bg-[#141414] border-[#262626] cursor-default font-bold grid-cols-[1fr_2fr_1fr_1fr] px-4 rounded-t-sm">
          <div className="text-xs text-[#999999] uppercase tracking-wider">Title</div>
          <div className="text-xs text-[#999999] uppercase tracking-wider">Status</div>
          <div className="text-xs text-[#999999] uppercase tracking-wider">Timeline</div>
          <div className="text-xs text-[#999999] uppercase tracking-wider">Created</div>
        </div>
        {recentProjects.length === 0 ? (
          <div className="p-8 text-center text-[#999999] text-sm border-t border-[#262626]">No recent projects found.</div>
        ) : (
          recentProjects.map(project => (
            <Link to={`/projects/${project.id}`} key={project.id} className="data-row grid-cols-[1fr_2fr_1fr_1fr] border-[#262626] px-4">
              <div className="font-semibold text-[16px] truncate">{project.title}</div>
              <div className="flex items-center">
                <span className="font-mono text-[10px] uppercase border border-[#262626] px-2 py-1 rounded text-[#999999]">{project.status}</span>
              </div>
              <div className="text-sm text-[#999999] truncate">{project.timeline || 'N/A'}</div>
              <div className="text-sm text-[#999999]">{new Date(project.createdAt).toLocaleDateString()}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
