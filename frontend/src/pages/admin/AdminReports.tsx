import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Link } from 'react-router-dom';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/field';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/toast';
import { Search, Eye, Download, FileText, Loader2 } from 'lucide-react';

function formatDate(v: string){ return new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function formatBytes(b:number){ if(!b && b!==0) return '—'; if(b<1024) return `${b} B`; if(b<1e6) return `${(b/1024).toFixed(1)} KB`; return `${(b/1e6).toFixed(1)} MB`; }

export default function AdminReports(){
  const [status,setStatus]=useState('All');
  const [search,setSearch]=useState('');
  const [fileType,setFileType]=useState('');
  const [sort,setSort]=useState('newest');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [page,setPage]=useState(1);
  const [downloadingId,setDownloadingId]=useState<string|null>(null);
  const toast = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey:['admin-reports',status,search,fileType,sort,dateFrom,dateTo,page],
    queryFn:()=>adminApi.listReports({status: status==='All'?undefined:status, search: search||undefined, fileType: fileType||undefined, sort, dateFrom: dateFrom||undefined, dateTo: dateTo||undefined, page, limit:20}).then(r=>r.data),
  });

  const reports = data?.data || [];

  const handleDownload = useCallback(async (r: any) => {
    if (downloadingId) return;
    setDownloadingId(r._id);
    try {
      const res = await adminApi.download(r._id);
      const blob = res.data as unknown as Blob;
      if (!blob || blob.size === 0) throw new Error('empty');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.originalFileName || 'report';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Download failed. The file may have been deleted from the server.';
      toast.error(msg);
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId, toast]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Report Review</h1>
          <p className="text-sm text-muted-foreground">Total: {data?.total ?? 0} • Pending: review required</p>
        </div>
        <Button variant="outline" onClick={()=>refetch()}>Refresh</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search title, employee, email" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} className="pl-8 w-56" />
          </div>
          <Select value={status} onChange={e=>{setStatus(e.target.value); setPage(1);}} className="w-36">
            <option value="All">All</option>
            <option value="PENDING_REVIEW">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PROCESS_ABORTED">Aborted</option>
          </Select>
          <Select value={fileType} onChange={e=>{setFileType(e.target.value); setPage(1);}} className="w-32">
            <option value="">All Types</option>
            <option value="pdf">PDF</option>
            <option value="doc">DOC</option>
            <option value="docx">DOCX</option>
            <option value="xls">XLS</option>
            <option value="xlsx">XLSX</option>
            <option value="ppt">PPT</option>
            <option value="pptx">PPTX</option>
            <option value="txt">TXT</option>
            <option value="csv">CSV</option>
          </Select>
          <Select value={sort} onChange={e=>setSort(e.target.value)} className="w-28">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </Select>
          <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-36" placeholder="From" />
          <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-36" placeholder="To" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Report Title</th>
                <th className="px-3 py-2.5">File Name</th>
                <th className="px-3 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Size</th>
                <th className="px-3 py-2.5">Uploaded</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading...</td></tr> : reports.length===0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No reports found</td></tr> : reports.map((r:any)=>(
                <tr key={r._id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2 text-sm font-medium max-w-[180px] truncate">{r.title}</td>
                  <td className="px-3 py-2 text-sm max-w-[220px]">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate" title={r.originalFileName}>{r.originalFileName || '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">{r.submittedBy?.firstName} {r.submittedBy?.lastName}</td>
                  <td className="px-3 py-2 text-xs uppercase">{r.fileType}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatBytes(r.fileSize)}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(r.submittedAt)}</td>
                  <td className="px-3 py-2"><Badge variant={r.status==='APPROVED'?'success':r.status==='PENDING_REVIEW'?'warning':'destructive'}>{r.status}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/reports/${r._id}`} title="View report" className="inline-flex h-7 items-center gap-1 px-2 rounded-md border text-xs font-medium hover:bg-muted"><Eye className="h-3.5 w-3.5" /> View</Link>
                      <button
                        type="button"
                        title="Download file"
                        onClick={()=>handleDownload(r)}
                        disabled={downloadingId===r._id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50"
                      >
                        {downloadingId===r._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <span>Page {data?.page ?? 1} of {data?.totalPages ?? 1} • {data?.total ?? 0} reports</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page>= (data?.totalPages??1)} onClick={()=>setPage(p=>p+1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}