import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';

export const ProjectNew = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        timeline: '',
        priorWorkLink: '',
        disclosureRequired: false,
        requestDiscovery: false
    });
    
    const [members, setMembers] = useState<{firstName: string, lastName: string, email: string, role: string}[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteFirstName, setInviteFirstName] = useState('');
    const [inviteLastName, setInviteLastName] = useState('');
    const [inviteRole, setInviteRole] = useState('Participant');

    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (inviteEmail && inviteFirstName && inviteLastName) {
            setMembers([...members, { 
                firstName: inviteFirstName, 
                lastName: inviteLastName, 
                email: inviteEmail, 
                role: inviteRole 
            }]);
            setInviteEmail('');
            setInviteFirstName('');
            setInviteLastName('');
        }
    };

    const removeMember = (index: number) => {
        setMembers(members.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'projects'), {
                title: formData.title,
                description: formData.description,
                timeline: formData.timeline,
                priorWorkLink: formData.priorWorkLink,
                disclosureRequired: formData.disclosureRequired,
                status: 'Intake',
                requestorId: user?.uid,
                members,
                createdAt: new Date().toISOString()
            });

            // Explicitly add Requestor as a project member
            if (user?.uid) {
                const reqMemberId = `${user.uid}_${docRef.id}`;
                const { setDoc, doc } = await import('firebase/firestore');
                await setDoc(doc(db, 'project_members', reqMemberId), {
                    projectId: docRef.id,
                    userId: user.uid,
                    email: user.email || '',
                    role: 'Requestor',
                    source: 'system-default',
                    is_explicit: true
                });
            }

            // Create explicitly added members as project_members records
            for (const m of members) {
                // If it's just an invite, we might not have a userId yet, but let's try to find them by email
                const { query, getDocs, where } = await import('firebase/firestore');
                const uq = query(collection(db, 'users'), where('email', '==', m.email));
                const uSnap = await getDocs(uq);
                let uid = `invited_${Date.now()}`;
                if (!uSnap.empty) {
                    uid = uSnap.docs[0].id;
                }
                const mmid = `${uid}_${docRef.id}`;
                const { setDoc, doc } = await import('firebase/firestore');
                await setDoc(doc(db, 'project_members', mmid), {
                    projectId: docRef.id,
                    userId: uid,
                    email: m.email,
                    role: m.role,
                    source: 'explicit',
                    is_explicit: true
                });
            }

            if (formData.requestDiscovery) {
                await addDoc(collection(db, 'reviews'), {
                    projectId: docRef.id,
                    stageType: 'Discovery',
                    status: 'Pending',
                });
            }

            alert("Project request submitted. Please remember to update your availability on the Calendar for the next 2-3 weeks!");
            navigate(`/projects/${docRef.id}`);
        } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'projects');
            setLoading(false);
        }
    }

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <h1 className="panel-title mb-6">Request New Project Review</h1>
            <form onSubmit={handleSubmit} className="bg-[#141414] border border-[#262626] p-8 rounded-sm space-y-6">
                <div>
                    <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-2">Project Title</label>
                    <input 
                       required 
                       type="text" 
                       className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]" 
                       value={formData.title}
                       onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                </div>
                <div>
                    <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-2">Description</label>
                    <textarea 
                       required
                       rows={4} 
                       className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                       value={formData.description}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-2">Proposed Timeline</label>
                        <input 
                           type="text" 
                           placeholder="e.g. Q3 2026 or Next 2 weeks"
                           className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                           value={formData.timeline}
                           onChange={e => setFormData({...formData, timeline: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-2">Prior Work Link</label>
                        <input 
                           type="url" 
                           placeholder="https://..."
                           className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                           value={formData.priorWorkLink}
                           onChange={e => setFormData({...formData, priorWorkLink: e.target.value})}
                        />
                    </div>
                </div>

                {/* Team Members Invite Section */}
                <div className="pt-4 border-t border-[#262626]">
                    <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-4">Invite Team Members</label>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <input 
                                type="text" 
                                placeholder="First Name"
                                className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                                value={inviteFirstName}
                                onChange={e => setInviteFirstName(e.target.value)}
                            />
                        </div>
                        <div>
                            <input 
                                type="text" 
                                placeholder="Last Name"
                                className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                                value={inviteLastName}
                                onChange={e => setInviteLastName(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4 items-end mb-4">
                        <div className="flex-1">
                            <input 
                                type="email" 
                                placeholder="Email Address"
                                className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                            />
                        </div>
                        <div className="w-[150px]">
                            <select 
                                className="w-full bg-[#0A0A0A] text-white border border-[#262626] p-3 text-[14px] rounded outline-none focus:border-[#FF3D00]"
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value)}
                            >
                                <option value="Participant">Participant</option>
                                <option value="Guest">Guest</option>
                                <option value="Watcher">Watcher</option>
                            </select>
                        </div>
                        <button type="button" onClick={handleAddMember} className="bg-[#262626] hover:bg-[#333] text-white px-4 py-3 rounded-sm flex items-center gap-2 text-[14px] font-bold transition-colors">
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>

                    {members.length > 0 && (
                        <div className="space-y-2 mt-4 bg-[#0A0A0A] p-4 border border-[#262626] rounded-sm">
                            {members.map((m, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <div className="text-white">
                                        <span className="font-mono text-[10px] text-[#999999] uppercase mr-3 border border-[#262626] px-2 py-0.5 rounded">{m.role}</span>
                                        <span className="font-bold">{m.firstName} {m.lastName}</span> <span className="text-[#999999]">({m.email})</span>
                                    </div>
                                    <button type="button" onClick={() => removeMember(i)} className="text-[#FF3D00] hover:text-white transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-[#262626]">
                    <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-4">Discovery Review</label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-[#FF3D00] border-[#262626]"
                            checked={formData.requestDiscovery}
                            onChange={(e) => setFormData({...formData, requestDiscovery: e.target.checked})}
                        />
                        <div className="flex flex-col">
                            <span className={`text-[13px] font-bold ${formData.requestDiscovery ? 'text-white' : 'text-[#999999] group-hover:text-white'} transition-colors`}>Request Discovery Review</span>
                            <span className="text-[10px] text-[#666666]">An optional initial review phase before formal design starts.</span>
                        </div>
                    </label>
                </div>

                <div className="pt-4 border-t border-[#262626]">
                    <label className="text-[11px] text-[#999999] uppercase tracking-widest font-bold block mb-4">Disclosure Context</label>
                    <div className="flex gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input 
                                type="radio" 
                                name="disclosure"
                                className="w-4 h-4 accent-[#FF3D00] border-[#262626]"
                                checked={!formData.disclosureRequired}
                                onChange={() => setFormData({...formData, disclosureRequired: false})}
                            />
                            <div className="flex flex-col">
                                <span className={`text-[13px] font-bold ${!formData.disclosureRequired ? 'text-white' : 'text-[#999999] group-hover:text-white'} transition-colors`}>Public</span>
                                <span className="text-[10px] text-[#666666]">Visible to all authenticated users.</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input 
                                type="radio" 
                                name="disclosure"
                                className="w-4 h-4 accent-[#FF3D00] border-[#262626]"
                                checked={formData.disclosureRequired}
                                onChange={() => setFormData({...formData, disclosureRequired: true})}
                            />
                            <div className="flex flex-col">
                                <span className={`text-[13px] font-bold ${formData.disclosureRequired ? 'text-white' : 'text-[#999999] group-hover:text-white'} transition-colors`}>Confidential</span>
                                <span className="text-[10px] text-[#666666]">Requires explicit membership.</span>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div className="pt-6">
                    <button disabled={loading} type="submit" className="cta-button rounded-sm disabled:opacity-50">
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </form>
        </div>
    )
}
