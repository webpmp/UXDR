import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QuickSearch = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
        }
    };

    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-3xl">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#999999] group-focus-within:text-[#FF3D00] transition-colors" />
            <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search projects, people, or review stages..."
                className="w-full bg-[#141414] border border-[#262626] py-5 pl-14 pr-4 text-[16px] text-white outline-none rounded focus:border-[#FF3D00] transition-all shadow-2xl"
            />
        </form>
    );
};
