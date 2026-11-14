import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { DatePicker, DateTimePicker } from '@project/components/ui/date-picker';
import { useUpload } from 'zitejs/upload';
import { listMembers, type ListMembersOutputType } from 'zitejs/api';
import { Loader2, Paperclip, X } from 'lucide-react';
import { selectCls, run } from './kit';
import { cn } from '@project/components/lib/utils';

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <DatePicker value={value ? new Date(`${value}T12:00:00`) : undefined} onChange={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')} />;
}

export function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <DateTimePicker value={value ? new Date(value) : undefined} onChange={(d) => onChange(d ? d.toISOString() : '')} />;
}

export function FileField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { upload, isUploading } = useUpload();
  if (value) return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <Paperclip className="h-4 w-4" /><a href={value} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary underline">{decodeURIComponent(value.split('/').pop() || 'bijlage')}</a>
      <button type="button" onClick={() => onChange('')}><X className="h-4 w-4" /></button>
    </div>
  );
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      {isUploading ? 'Uploaden…' : 'Bestand kiezen'}
      <input type="file" className="hidden" disabled={isUploading} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = await run(upload(f));
        if (r) onChange(r.url);
      }} />
    </label>
  );
}

type Dir = ListMembersOutputType['members'];
let dirCache: Dir | null = null;
export function useDirectory() {
  const [members, setMembers] = useState<Dir>(dirCache || []);
  useEffect(() => {
    if (dirCache) return;
    listMembers({ directory: true }).then((r) => { dirCache = r.members; setMembers(r.members); }).catch(() => {});
  }, []);
  return members;
}

export function Select({ value, onChange, options, placeholder, className }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(selectCls, 'w-full', className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function MemberSelect({ value, onChange, placeholder = 'Kies medewerker', excludeId }: { value: string; onChange: (v: string) => void; placeholder?: string; excludeId?: string }) {
  const members = useDirectory();
  return <Select value={value} onChange={onChange} placeholder={placeholder} options={members.filter((m) => m.id !== excludeId).map((m) => ({ value: m.id, label: `${m.fullName}${m.department ? ` · ${m.department}` : ''}` }))} />;
}
