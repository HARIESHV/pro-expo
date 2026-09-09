import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/field';
import { Badge } from '../../components/ui/badge';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/button';

function Card({ title, value, sub }: { title:string; value:number; sub?:string }){
  return <div className="rounded-2xl border bg-card p-5 text-center"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>;
}

export default function AdminMembers(){
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [page,setPage]=useState(1);

  const { data: stats } = useQuery({ queryKey:['admin-member-stats'], queryFn:()=>adminApi.memberStats().then(r=>r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey:['admin-members',search,status,page],
    queryFn:()=>adminApi.memberList({ search: search||undefined, status, page, limit:20 }).then(r=>r.data),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="text-xl font-bold">Members</h1>
      <p className="text-sm text-muted-foreground">Real database member/signup statistics</p>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card title="Total Members" value={stats?.totalMembers ?? 0} />
        <Card title="Active" value={stats?.totalActive ?? 0} />
        <Card title="Inactive" value={stats?.totalInactive ?? 0} />
        <Card title="New Today" value={stats?.newToday ?? 0} sub="signups today" />
        <Card title="New This Week" value={stats?.newWeek ?? 0} sub="last 7 days" />
        <Card title="New This Month" value={stats?.newMonth ?? 0} sub="this month" />
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search name or email" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} className="pl-8 w-56" />
          </div>
          <Select value={status} onChange={e=>{setStatus(e.target.value); setPage(1);}} className="w-32">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Signup Date</th>
                <th className="px-3 py-2.5">Role</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">Loading...</td></tr> : (data?.data||[]).length===0 ? <tr><td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No members</td></tr> : (data.data as any[]).map((m:any)=>(
                <tr key={m._id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2 text-sm font-medium">{m.firstName} {m.lastName}</td>
                  <td className="px-3 py-2 text-xs font-mono">{m.email}</td>
                  <td className="px-3 py-2 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{m.roles?.join(', ')}</Badge></td>
                  <td className="px-3 py-2"><Badge variant={m.status==='active'?'success':'destructive'}>{m.status}</Badge></td>
                  <td className="px-3 py-2 text-xs">{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{data?.total ?? 0} members • Page {data?.page ?? 1}/{data?.totalPages ?? 1}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={page>= (data?.totalPages??1)} onClick={()=>setPage(p=>p+1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
