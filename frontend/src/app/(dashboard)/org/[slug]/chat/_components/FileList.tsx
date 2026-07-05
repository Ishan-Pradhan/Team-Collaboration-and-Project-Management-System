'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Paperclip } from 'lucide-react';
import { parseApiError } from '@/lib/axios';
import { useChannelFiles } from '@/hooks/useChannel';
import { getFiles } from '@/services/channel.service';
import { FileAttachmentCard } from './fileDisplay';
import type { Channel, Message } from '@/types/channel.types';

interface Props {
  channel: Channel;
}

export default function FileList({ channel }: Props) {
  const qc = useQueryClient();
  const { data: files, isLoading } = useChannelFiles(channel.id);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (!files || files.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await getFiles(channel.id, files[files.length - 1].createdAt);
      qc.setQueryData<Message[]>(['channels', channel.id, 'files'], (old) =>
        old ? [...old, ...older] : older
      );
    } catch (err) {
      toast.error(parseApiError(err).message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3 space-y-2">
      {files && files.length > 0 ? (
        <>
          {files.map((file) => (
            <div key={file.id} className="rounded-lg border border-border-subtle p-2">
              <div className="mb-1 flex items-baseline gap-2 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{file.sender?.name ?? 'Unknown'}</span>
                <span>{new Date(file.createdAt).toLocaleDateString()}</span>
              </div>
              <FileAttachmentCard message={file} channelId={channel.id} />
            </div>
          ))}
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="mx-auto block text-xs text-primary hover:underline disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-text-secondary">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <Paperclip size={24} className="text-text-muted" />
          </div>
          <p className="text-sm">No files shared in this channel yet.</p>
        </div>
      )}
    </div>
  );
}
