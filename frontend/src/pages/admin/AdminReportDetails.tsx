import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Input, Textarea } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { ArrowLeft, Download, Eye, CheckCircle, XCircle, FileText, FileDown, Loader2 } from 'lucide-react';

function formatBytes(b:number){ if(b<1024) return `${b} B`; if(b<1024*1024) return `${(b/1024).toFixed(1)} KB`; return `${(b/1024/1024).toFixed(1)} MB`; }

function getErrorMessage(err: unknown, fallback: string): string {
  const r = err as { response?: { data?: { message?: string } } };
  return r?.response?.data?.message || fallback;
}

const IMAGE_TYPES = ['png','jpg','jpeg','webp'];
const TEXT_TYPES = ['txt','csv'];
const OFFICE_PREVIEW_TYPES = ['docx','xlsx','xls'];

function isPdfType(report: any) {
  return report?.fileType === 'pdf' || report?.mimeType === 'application/pdf';
}
function isImageType(report: any) {
  return IMAGE_TYPES.includes(report?.fileType?.toLowerCase());
}
function isTextType(report: any) {
  return TEXT_TYPES.includes(report?.fileType?.toLowerCase());
}
function isOfficePreviewType(report: any) {
  return OFFICE_PREVIEW_TYPES.includes(report?.fileType?.toLowerCase());
}
function isDownloadOnlyType(report: any) {
  return ['doc','ppt','pptx'].includes(report?.fileType?.toLowerCase());
}

export default function AdminReportDetails(){
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [approveOpen,setApproveOpen]=useState(false);
  const [rejectOpen,setRejectOpen]=useState(false);
  const [rejectionReason,setRejectionReason]=useState('');
  const [adminComments,setAdminComments]=useState('');
  const [blobPreviewUrl,setBlobPreviewUrl]=useState<string|null>(null);
  const [textPreview,setTextPreview]=useState<string|null>(null);
  const [viewError,setViewError]=useState('');
  const [isLoadingPreview,setIsLoadingPreview]=useState(false);

  const { data, isLoading } = useQuery({ queryKey:['admin-report',id], queryFn:()=>adminApi.getReport(id!).then(r=>r.data.data), enabled:!!id });
  const report:any = data;

  useEffect(() => {
    if (!report) return;

    setViewError('');
    setTextPreview(null);
    setIsLoadingPreview(false);
    if (blobPreviewUrl) URL.revokeObjectURL(blobPreviewUrl);
    setBlobPreviewUrl(null);

    const canStream = isPdfType(report) || isImageType(report) || isTextType(report);
    const canExtract = isOfficePreviewType(report);
    if (!canStream && !canExtract) {
      return;
    }

    setIsLoadingPreview(true);
    if (canStream) {
      adminApi.preview(report._id)
        .then((res) => {
          const blob = res.data as Blob;
          if (!blob || blob.size === 0) throw new Error('empty');
          const url = URL.createObjectURL(blob);
          setBlobPreviewUrl(url);
        })
        .catch((err) => {
          setViewError(getErrorMessage(err, 'Unable to load the file preview. It may have been deleted or is unreachable.'));
        })
        .finally(() => setIsLoadingPreview(false));
    } else if (canExtract) {
      adminApi.textPreview(report._id)
        .then((res) => setTextPreview(res.data?.data?.text ?? 'No text content available.'))
        .catch((err) => {
          setViewError(getErrorMessage(err, 'Unable to load the file preview.'));
        })
        .finally(() => setIsLoadingPreview(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?._id, report?.fileType]);

  const handleDownload = useCallback(async () => {
    if (!report) return;
    try {
      const res = await adminApi.download(report._id);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.originalFileName || 'report';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Download failed. The file may have been deleted from the server.'));
    }
  }, [report, toast]);

  const approveMut = useMutation({
    mutationFn:()=>adminApi.approve(id!),
    onSuccess:()=>{ toast.success('Report approved'); qc.invalidateQueries({queryKey:['admin-report',id]}); qc.invalidateQueries({queryKey:['admin-reports']}); setApproveOpen(false); },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Approve failed')
  });
  const rejectMut = useMutation({
    mutationFn:()=>adminApi.reject(id!,{rejectionReason, adminComments}),
    onSuccess:()=>{ toast.success('Report rejected'); qc.invalidateQueries({queryKey:['admin-report',id]}); setRejectOpen(false); setRejectionReason(''); setAdminComments(''); },
    onError:(e:any)=> toast.error(e.response?.data?.message||'Reject failed')
  });

  if(isLoading) return <div className="p-8">Loading...</div>;
  if(!report) return <div className="p-8">Not found</div>;

  const isPdf = isPdfType(report);
  const isImage = isImageType(report);
  const isText = isTextType(report);
  const isOfficePreview = isOfficePreviewType(report);
  const isDownloadOnly = isDownloadOnlyType(report);
  const canRenderViewer = isPdf || isImage || isText || isOfficePreview;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <Button variant="ghost" size="sm" onClick={()=>navigate('/admin/reports')}><ArrowLeft className="h-4 w-4" /> Back to Reports</Button>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border bg-card p-5 space-y-4">
          <div>
            <h1 className="text-lg font-bold">{report.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Employee</span><span className="font-medium">{report.submittedBy?.firstName} {report.submittedBy?.lastName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-mono text-xs">{report.submittedBy?.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span>{new Date(report.submittedAt).toLocaleString()}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground shrink-0">File</span><span className="truncate text-right">{report.originalFileName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="uppercase">{report.fileType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span>{formatBytes(report.fileSize)}</span></div>
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span><Badge variant={report.status==='APPROVED'?'success':report.status==='PENDING_REVIEW'?'warning':'destructive'}>{report.status}</Badge></div>
            {report.rejectionReason && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm"><p className="font-semibold text-red-700">Rejection Reason</p><p className="text-red-600">{report.rejectionReason}</p>{report.adminComments && <p className="mt-1 text-xs text-muted-foreground">Comments: {report.adminComments}</p>}</div>}
            {report.approvedAt && <div className="text-xs text-muted-foreground">Approved at {new Date(report.approvedAt).toLocaleString()} by {report.reviewedBy?.email}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> Download</Button>
          </div>
          {report.status==='PENDING_REVIEW' && (
            <div className="flex gap-2 pt-2">
              <Button onClick={()=>setApproveOpen(true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="h-4 w-4" /> Approve</Button>
              <Button variant="destructive" onClick={()=>setRejectOpen(true)} className="flex-1"><XCircle className="h-4 w-4" /> Reject</Button>
            </div>
          )}
          {report.status!=='PENDING_REVIEW' && (
            <p className="text-xs text-muted-foreground text-center">This report has been {report.status.toLowerCase()} — no further actions.</p>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl border bg-card p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Document Viewer</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownload}><Eye className="h-4 w-4" /> View / Download</Button>
              </div>
            </div>
            {isLoadingPreview && (
              <div className="rounded-xl border bg-muted flex items-center justify-center p-8" style={{minHeight: '240px'}}>
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading file preview...
                </div>
              </div>
            )}
            {!isLoadingPreview && viewError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                <p className="text-sm text-red-700">{viewError}</p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button size="sm" variant="outline" onClick={handleDownload}><Download className="h-4 w-4" /> Download File</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Secure download — admin access is audited.</p>
              </div>
            )}
            {!isLoadingPreview && !viewError && isPdf && blobPreviewUrl && (
              <div className="rounded-xl border bg-white overflow-hidden" style={{height: '70vh'}}>
                <iframe src={blobPreviewUrl} title="PDF Preview" className="w-full h-full border-0" />
              </div>
            )}
            {!isLoadingPreview && !viewError && isImage && blobPreviewUrl && (
              <div className="rounded-xl border bg-muted flex items-center justify-center p-4" style={{minHeight: '50vh'}}>
                <img src={blobPreviewUrl} alt={report.originalFileName} className="max-w-full max-h-[65vh] object-contain rounded" />
              </div>
            )}
            {!isLoadingPreview && !viewError && isText && blobPreviewUrl && (
              <div className="rounded-xl border bg-white overflow-hidden" style={{height: '60vh'}}>
                <iframe src={blobPreviewUrl} title="Text Preview" className="w-full h-full border-0" />
              </div>
            )}
            {!isLoadingPreview && !viewError && isOfficePreview && textPreview !== null && (
              <div className="rounded-xl border bg-white overflow-hidden" style={{height: '60vh'}}>
                <pre className="w-full h-full overflow-auto p-4 text-xs leading-relaxed whitespace-pre-wrap font-mono">{textPreview}</pre>
              </div>
            )}
            {!isLoadingPreview && !viewError && !canRenderViewer && (
              <div className="rounded-xl border bg-muted p-8 text-center">
                <p className="text-sm text-muted-foreground">Direct preview is not available for .{report.fileType} files. Please download to view the file.</p>
                <div className="mt-3 flex justify-center">
                  <Button size="sm" onClick={handleDownload} className="inline-flex items-center gap-2"><FileDown className="h-4 w-4" /> Download File</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Secure download — admin access is audited.</p>
              </div>
            )}
            {!isLoadingPreview && !viewError && canRenderViewer && !blobPreviewUrl && textPreview === null && !isDownloadOnly && (
              <div className="rounded-xl border bg-muted p-8 text-center">
                <p className="text-sm text-muted-foreground">Preview could not be loaded. Please download the file instead.</p>
                <div className="mt-3 flex justify-center">
                  <Button size="sm" onClick={handleDownload} className="inline-flex items-center gap-2"><Download className="h-4 w-4" /> Download File</Button>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Zoom and navigation are available inside the document viewer. Use Download for the original file.</p>
          </div>
        </div>
      </div>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Report?</DialogTitle>
            <DialogDescription>Are you sure you want to approve this report? Employee will get download access and email notification.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setApproveOpen(false)}>Cancel</Button>
            <Button onClick={()=>approveMut.mutate()} disabled={approveMut.isPending} className="bg-emerald-600 hover:bg-emerald-700">{approveMut.isPending?'Approving...':'Confirm Approve'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
            <DialogDescription>Provide a reason. Employee will see Process Aborted and cannot download.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Rejection Reason *</label>
              <Input value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} placeholder="e.g., Missing data, incorrect format" />
            </div>
            <div>
              <label className="text-sm font-medium">Admin Comments (optional)</label>
              <Textarea value={adminComments} onChange={e=>setAdminComments(e.target.value)} placeholder="Additional guidance" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectionReason.trim() || rejectMut.isPending} onClick={()=>rejectMut.mutate()}>{rejectMut.isPending?'Rejecting...':'Confirm Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}