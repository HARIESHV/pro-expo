import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeReportsApi, EmployeeReport } from '../../api/employeeReports';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toast';
import { Upload, Download, Eye, Clock, CheckCircle, XCircle, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

function formatBytes(b:number){ return b<1024?`${b} B`:`${(b/1024).toFixed(1)} KB`; }

export default function EmployeeReportsPage(){
  const qc = useQueryClient();
  const toast = useToast();
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState('general');
  const [file,setFile]=useState<File|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewed,setViewed]=useState<EmployeeReport|null>(null);

  const { data, isLoading } = useQuery({ queryKey:['my-reports'], queryFn:()=>employeeReportsApi.myReports().then(r=>r.data.data) });
  const reports: EmployeeReport[] = (data as any) || [];

  const submitMut = useMutation({
    mutationFn:()=>{
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('category', category);
      if(file) fd.append('file', file);
      return employeeReportsApi.submit(fd);
    },
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['my-reports']}); toast.success('Report submitted — Waiting for Admin Review'); setOpen(false); setTitle(''); setDescription(''); setFile(null); },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Submit failed')
  });

  const download = async (id:string, fileName:string)=>{
    try{
      const res = await employeeReportsApi.download(id);
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch(e:any){ toast.error(e.response?.data?.message || 'Download failed'); }
  };

  const canDownload = (r:EmployeeReport)=> r.status==='APPROVED';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">My Reports</h1>
          <p className="text-sm text-muted-foreground">Submit reports for Admin review — PDF, DOCX, XLSX, PPTX, TXT, CSV, images</p>
        </div>
        <Button onClick={()=>setOpen(true)}><Upload className="h-4 w-4" /> Submit Report</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : reports.length===0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-2 font-semibold">No reports yet</h3>
          <p className="text-sm text-muted-foreground">Submit your first report for admin review.</p>
          <Button className="mt-3" onClick={()=>setOpen(true)}>Submit Report</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5">File</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r=>(
                <tr key={r._id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[260px]">{r.description}</p>
                  </td>
                  <td className="px-3 py-2 text-xs"><span className="uppercase">{r.fileType}</span> • {formatBytes(r.fileSize)}<br/><span className="font-mono text-[11px]">{r.originalFileName}</span></td>
                  <td className="px-3 py-2 text-xs">{new Date(r.submittedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {r.status==='PENDING_REVIEW' && <Badge variant="warning"><Clock className="h-3 w-3" /> Waiting for Admin Review</Badge>}
                    {r.status==='APPROVED' && <Badge variant="success"><CheckCircle className="h-3 w-3" /> Approved by Admin — You can now access your report.</Badge>}
                    {(r.status==='REJECTED' || r.status==='PROCESS_ABORTED') && <div className="space-y-1"><Badge variant="destructive"><XCircle className="h-3 w-3" /> Rejected</Badge><p className="text-[11px] text-red-600">Process Aborted — This process has been stopped by the administrator.</p>{r.rejectionReason && <p className="text-[11px] text-muted-foreground">Reason: {r.rejectionReason}</p>}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={()=>setViewed(r)}><Eye className="h-3.5 w-3.5" /> View</Button>
                      <Button size="sm" disabled={!canDownload(r)} onClick={()=>download(r._id, r.originalFileName)} className={cn(canDownload(r)?'':'opacity-50')}><Download className="h-3.5 w-3.5" /> Download</Button>
                    </div>
                    {!canDownload(r) && (r.status==='REJECTED' || r.status==='PROCESS_ABORTED') && <p className="text-[11px] text-red-500 text-right mt-1 flex items-center justify-end gap-1"><AlertTriangle className="h-3 w-3" /> Not downloadable</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Report to Admin</DialogTitle>
            <DialogDescription>File will be securely stored and reviewed by Admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Report Title *</label>
              <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Q3 Financial Summary" maxLength={200} />
            </div>
            <div>
              <label className="text-sm font-medium">Description *</label>
              <Textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Detailed description" rows={3} maxLength={5000} />
            </div>
            <div>
              <label className="text-sm font-medium">Category/Type</label>
              <Input value={category} onChange={e=>setCategory(e.target.value)} placeholder="general, finance, operations" />
            </div>
            <div>
              <label className="text-sm font-medium">File * (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, Images)</label>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="mt-1 block w-full text-sm" />
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name} • {formatBytes(file.size)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!title.trim()||!description.trim()||!file||submitMut.isPending} onClick={()=>submitMut.mutate()}>{submitMut.isPending?'Uploading...':'Submit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewed} onOpenChange={v=>!v&&setViewed(null)}>
        {viewed && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{viewed.title}</DialogTitle>
              <DialogDescription>{viewed.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Status:</span> <Badge variant={viewed.status==='APPROVED'?'success':viewed.status==='PENDING_REVIEW'?'warning':'destructive'}>{viewed.status}</Badge></p>
              <p><span className="text-muted-foreground">File:</span> {viewed.originalFileName} ({viewed.fileType})</p>
              {viewed.status==='PENDING_REVIEW' && <p className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-800 text-sm">Waiting for Admin Review</p>}
              {viewed.status==='APPROVED' && <div className="space-y-2"><p className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-800 text-sm">Report Approved – You can now access your report.</p><Button size="sm" onClick={()=>download(viewed._id, viewed.originalFileName)}><Download className="h-3.5 w-3.5" /> Download Report</Button></div>}
              {(viewed.status==='REJECTED' || viewed.status==='PROCESS_ABORTED') && <div className="rounded-lg bg-red-50 border border-red-200 p-3"><p className="font-semibold text-red-700">Report Rejected – This process has been stopped by the administrator.</p><p className="text-sm text-red-600">Reason: {viewed.rejectionReason}</p>{viewed.adminComments && <p className="text-xs text-muted-foreground">Comments: {viewed.adminComments}</p>}</div>}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
