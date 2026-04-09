import type { AttachmentMetadata } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { isImageMimeType } from '@/lib/fileAttachments'

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ImageAttachment(props: { attachment: AttachmentMetadata }) {
    const { attachment } = props
    return (
        <div className="group relative overflow-hidden rounded-[20px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] shadow-[var(--app-shadow-xs)]">
            <img
                src={attachment.previewUrl}
                alt={attachment.filename}
                className="max-h-56 w-full max-w-full object-contain bg-[var(--app-subtle-bg)] transition-transform duration-200 group-hover:scale-[1.01]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 py-2.5">
                <span className="line-clamp-1 text-xs font-medium text-white/92">
                    {attachment.filename}
                </span>
            </div>
        </div>
    )
}

function FileAttachment(props: { attachment: AttachmentMetadata }) {
    const { attachment } = props
    return (
        <div className="flex items-center gap-3 rounded-[18px] border border-[var(--app-border)] bg-[var(--app-panel-elevated-bg)] px-3 py-2.5 shadow-[var(--app-shadow-xs)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--app-panel-muted-bg)]">
                <FileIcon fileName={attachment.filename} size={24} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--app-fg)]">
                    {attachment.filename}
                </div>
                <div className="mt-0.5 text-xs text-[var(--app-hint)]">
                    {formatFileSize(attachment.size)}
                </div>
            </div>
        </div>
    )
}

export function MessageAttachments(props: { attachments: AttachmentMetadata[] }) {
    const { attachments } = props
    if (!attachments || attachments.length === 0) return null

    const images = attachments.filter(a => isImageMimeType(a.mimeType) && a.previewUrl)
    const files = attachments.filter(a => !isImageMimeType(a.mimeType) || !a.previewUrl)

    return (
        <div className="mt-3 flex flex-col gap-3">
            {images.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {images.map(attachment => (
                        <ImageAttachment key={attachment.id} attachment={attachment} />
                    ))}
                </div>
            )}
            {files.length > 0 && (
                <div className="flex flex-col gap-2">
                    {files.map(attachment => (
                        <FileAttachment key={attachment.id} attachment={attachment} />
                    ))}
                </div>
            )}
        </div>
    )
}
