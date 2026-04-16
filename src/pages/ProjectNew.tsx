import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '../lib/firestore-errors';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const ProjectNew = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        timeline: '',
        priorWorkLink: '',
        disclosureRequired: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'projects'), {
                ...formData,
                status: 'Intake',
                requestorId: user?.uid,
                createdAt: new Date().toISOString()
            });

            // Create initial Intake review stage automatically
            await addDoc(collection(db, 'reviews'), {
                projectId: docRef.id,
                stageType: 'Discovery',
                status: 'Pending',
            });

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
                <div className="flex items-center gap-3 pt-4 border-t border-[#262626]">
                    <input 
                        type="checkbox" 
                        id="disclosure"
                        className="w-4 h-4 accent-[#FF3D00] border-[#262626]"
                        checked={formData.disclosureRequired}
                        onChange={e => setFormData({...formData, disclosureRequired: e.target.checked})}
                    />
                    <label htmlFor="disclosure" className="font-semibold text-[13px] text-white">Requires strict disclosure (hide from Guests)</label>
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
