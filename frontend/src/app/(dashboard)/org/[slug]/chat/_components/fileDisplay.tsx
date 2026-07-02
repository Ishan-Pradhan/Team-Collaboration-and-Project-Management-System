import { Download, File, FileText, Image as ImageIcon } from 'lucide-react';
import { getFileDownloadUrl } from '@/services/channel.service';
import type { Message } from '@/types/channel.types';

export function fileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon size={14} className="text-blue-500" />;
  if (type === 'application/pdf') return <FileText size={14} className="text-red-500" />;
  return <File size={14} className="text-gray-400" />;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileAttachmentCardProps {
  message: Message;
  channelId: string;
}

export function FileAttachmentCard({ message, channelId }: FileAttachmentCardProps) {
  if (!message.fileUrl || !message.fileType || !message.fileName) return null;

  if (message.fileType.startsWith('image/')) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer" className="mt-1 block w-fit">
        <img
          src={message.fileUrl}
          alt={message.fileName}
          className="max-h-48 max-w-xs rounded-lg border border-border-subtle object-cover"
        />
      </a>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-muted/40 px-3 py-2">
      {fileIcon(message.fileType)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{message.fileName}</p>
        <p className="text-xs text-text-secondary">{formatBytes(message.fileSize ?? 0)}</p>
      </div>
      <a
        href={getFileDownloadUrl(channelId, message.id)}
        download={message.fileName}
        className="rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
        title="Download"
      >
        <Download size={14} />
      </a>
    </div>
  );
}
