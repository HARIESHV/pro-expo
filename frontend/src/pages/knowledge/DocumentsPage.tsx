import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { documentsApi } from '../../api/documents';
import { Document } from '../../types';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  Search,
  Trash2,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Loader2,
  Clock,
  FileUp,
  Eye,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button, IconButton } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/field';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { EmptyState, LoadingState } from '../../components/ui/states';
import { useToast } from '../../components/ui/toast';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Spinner } from '../../components/ui/misc';

const STATUS_CONFIG = {
  pending: { label: 'Pending', dot: 'bg-warning' },
  processing: { label: 'Processing', dot: 'bg-orange-500 animate-pulse' },
  completed: { label: 'Completed', dot: 'bg-success' },
  failed: { label: 'Failed', dot: 'bg-destructive' },
} as const;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function TypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(t)) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  if (['pdf', 'docx', 'doc', 'txt', 'md'].includes(t)) return <FileText className="h-4 w-4 text-primary" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewed, setViewed] = useState<Document | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    clearTimeout(debouncedSearch.current);
    debouncedSearch.current = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(debouncedSearch.current);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', search, statusFilter],
    queryFn: () => documentsApi.getDocuments({ search: search || undefined, status: statusFilter || undefined, limit: 100 }),
  });

  const documents: Document[] = data?.data?.data?.documents || [];

  const { data: viewedData } = useQuery({
    queryKey: ['document', viewed?._id],
    queryFn: () => documentsApi.getDocument(viewed!._id),
    enabled: !!viewed,
  });

  useEffect(() => {
    if (focusId && documents.length > 0) {
      const doc = documents.find((d) => d._id === focusId);
      if (doc) {
        setViewed(doc);
        setSearchParams({}, { replace: true });
      }
    }
  }, [focusId, documents, setSearchParams]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name.replace(/\.[^.]+$/, ''));
      return documentsApi.uploadDocument(fd);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      const uploadedDocument = res.data.data?.document;
      if (uploadedDocument) setViewed(uploadedDocument);
      toast.success('Document uploaded');
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(apiErr?.response?.data?.message ?? apiErr?.message ?? 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.deleteDocument,
    onSuccess: (_res, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.removeQueries({ queryKey: ['document', deletedId] });
      queryClient.removeQueries({ queryKey: ['document-analysis', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setViewed(null);
      toast.success('AI document/chat deleted successfully');
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(apiErr.response?.data?.message || apiErr.message || 'Unable to delete document');
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: documentsApi.reprocessDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Reprocessing started');
    },
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      Array.from(files).forEach((f) => uploadMutation.mutate(f));
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const statusCounts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.processingStatus] = (acc[d.processingStatus] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = [...documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const viewMeta = viewedData?.data?.data?.document?.metadata ?? viewed?.metadata ?? {};
  const viewedDoc = viewedData?.data?.data?.document ?? viewed;
  const metadataEntries = Object.entries(viewMeta).filter(([, v]) => v != null && v !== '');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-base font-semibold tracking-tight text-foreground">Documents</h1>
          <p className="text-xs text-muted-foreground">Your team's knowledge base</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="doc-search"
            type="text"
            placeholder="Search documents…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-56 pl-8 sm:w-64"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
        <Button
          id="upload-doc-btn"
          onClick={() => setUploadOpen(true)}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          Upload
        </Button>
      </div>

      {/* Summary strip */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="tabular">{documents.length} documents</span>
        {statusCounts.completed > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {statusCounts.completed} indexed
          </span>
        )}
        {statusCounts.processing > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {statusCounts.processing} processing
          </span>
        )}
        {statusCounts.failed > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            {statusCounts.failed} failed
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState label="Loading documents…" />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title={search || statusFilter ? 'No documents match your filters' : 'No documents yet'}
            description={
              search || statusFilter
                ? 'Try clearing the search or status filter.'
                : 'Upload your first document to start building the knowledge base.'
            }
            action={
              search || statusFilter ? (
                <Button variant="outline" size="sm" onClick={() => { setSearchInput(''); setSearch(''); setStatusFilter(''); }}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5" /> Upload document
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Size</th>
                  <th className="px-3 py-2.5 font-medium">Chunks</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((doc, idx) => {
                  const st = STATUS_CONFIG[doc.processingStatus] ?? STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={doc._id}
                      className={cn(
                        'group border-b border-border/60 transition-colors last:border-b-0 hover:bg-secondary/50 cursor-pointer',
                        idx % 2 === 1 && 'bg-muted/15'
                      )}
                      onClick={() => setViewed(doc)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <TypeIcon type={doc.documentType} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-foreground">{doc.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{doc.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] uppercase text-muted-foreground">{doc.documentType}</td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground tabular">{formatBytes(doc.fileSize)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground tabular">{doc.chunksCount}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="muted" dot={doc.processingStatus === 'failed' ? 'destructive' : doc.processingStatus === 'completed' ? 'success' : doc.processingStatus === 'processing' ? 'primary' : 'warning'}>
                          {st.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{formatDate(doc.createdAt)}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {doc.processingStatus === 'failed' && (
                            <IconButton
                              size="icon-sm"
                              aria-label="Retry processing"
                              title="Retry processing"
                              onClick={() => reprocessMutation.mutate(doc._id)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </IconButton>
                          )}
                          <IconButton
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100"
                            aria-label="Delete document"
                            title="Delete"
                            onClick={() => {
                              setDeleteTargetId(doc._id);
                              setDeleteTargetTitle(doc.title);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span>Showing {sorted.length} of {documents.length}</span>
            <span>Uploaded files are indexed for RAG-powered answers</span>
          </div>
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              PDF, DOCX, XLSX, CSV, TXT supported. Files are automatically chunked and indexed.
            </DialogDescription>
          </DialogHeader>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors',
              isDragging && 'border-primary bg-primary/5'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              {uploadMutation.isPending ? 'Uploading…' : 'Multiple files supported'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (e.target.files?.length) setUploadOpen(false);
                e.target.value = '';
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={() => { setUploadOpen(false); navigate('/search-home'); }}>
              <Sparkles className="h-3.5 w-3.5" /> Ask about new docs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document viewer */}
      <Dialog open={!!viewed} onOpenChange={(v) => !v && setViewed(null)}>
        {viewedDoc && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2.5 pr-6">
                <TypeIcon type={viewedDoc.documentType} />
                <DialogTitle className="text-base">{viewedDoc.title}</DialogTitle>
              </div>
              <DialogDescription className="truncate">{viewedDoc.fileName}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border pb-3 text-[12px] text-muted-foreground">
                <span className="uppercase">{viewedDoc.documentType}</span>
                <span className="tabular">{formatBytes(viewedDoc.fileSize)}</span>
                <span className="tabular">{viewedDoc.chunksCount} chunks</span>
                <span>Uploaded {formatDate(viewedDoc.createdAt)}</span>
                {viewedDoc.uploadedBy?.email && (
                  <span className="truncate">by {viewedDoc.uploadedBy.email}</span>
                )}
                <Badge
                  variant={viewedDoc.processingStatus === 'failed' ? 'destructive' : viewedDoc.processingStatus === 'completed' ? 'success' : viewedDoc.processingStatus === 'processing' ? 'primary' : 'warning'}
                  dot={viewedDoc.processingStatus === 'failed' ? 'destructive' : viewedDoc.processingStatus === 'completed' ? 'success' : 'primary'}
                >
                  {(STATUS_CONFIG[viewedDoc.processingStatus] ?? STATUS_CONFIG.pending).label}
                </Badge>
                {viewedDoc.analysisStatus === 'completed' && (
                  <Badge variant="success" dot="success">Analysis Completed</Badge>
                )}
                {viewedDoc.analysisStatus === 'failed' && (
                  <Badge variant="destructive" dot="destructive">Analysis Failed</Badge>
                )}
              </div>

              {viewedDoc.description && (
                <p className="text-[13px] leading-relaxed text-secondary-foreground">{viewedDoc.description}</p>
              )}

              {viewedDoc.tags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewedDoc.tags.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {metadataEntries.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Extracted metadata</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {metadataEntries.slice(0, 12).map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-border bg-surface px-2.5 py-2">
                        <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
                        <p className="mt-0.5 truncate font-mono text-[12px] text-secondary-foreground">
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-wrap">
              {viewedDoc.processingStatus === 'failed' && (
                <Button variant="outline" className="mr-auto" onClick={() => reprocessMutation.mutate(viewedDoc._id)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Reprocess
                </Button>
              )}
              <Button variant="outline" onClick={() => { setViewed(null); navigate(`/chat?documentId=${encodeURIComponent(viewedDoc._id)}`); }}>
                <Sparkles className="h-3.5 w-3.5" /> Analyze in chat
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteTargetId(viewedDoc._id);
                  setDeleteTargetTitle(viewedDoc.title);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete document"
        description={`Are you sure you want to delete "${deleteTargetTitle}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteMutation.mutate(deleteTargetId, {
              onSuccess: () => {
                setDeleteConfirmOpen(false);
                setDeleteTargetId(null);
                setDeleteTargetTitle('');
              },
            });
          }
        }}
      />
    </div>
  );
}